#!/usr/bin/env node
/**
 * record-hq.mjs — high-quality variant of record-walkthrough.mjs.
 *
 * Differences from the stock recorder (same config schema, same actions.json output):
 *  - Capture: Chrome DevTools screencast of lossless PNG frames instead of Playwright's
 *    low-bitrate VP8 recordVideo, encoded with x264 at CRF 12 → crisp UI text.
 *  - Timing: every step's startMs is taken from the wall clock relative to the first
 *    captured frame, so the overlay (cursor, clicks, zoom, captions) cannot drift from
 *    the video no matter how long selectors or network take.
 *
 * Usage: node scripts/record-hq.mjs scripts/<config>.json
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const cfg = JSON.parse(readFileSync(process.argv[2], "utf8"));
const size = cfg.viewport ?? { width: 1920, height: 1080 };
const fps = cfg.fps ?? 30;
const outDir = path.resolve(cfg.outDir);
const framesDir = path.join(outDir, ".frames");
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

const DUR = { navigate: 1500, wait: 1000, move: 700, hover: 900, click: 700, scroll: 1000 };

async function run() {
  const browser = await chromium.launch({ headless: cfg.headless ?? true, args: ["--force-color-profile=srgb", "--hide-scrollbars"] });
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, reducedMotion: "no-preference" });
  const page = await context.newPage();

  // Warm the page (compile routes, load fonts) so the first recorded beat isn't a blank dev-server compile.
  if (cfg.warm) for (const u of cfg.warm) { await page.goto(u, { waitUntil: "networkidle" }).catch(() => {}); }
  await page.goto(cfg.url, { waitUntil: "networkidle" });
  if (cfg.beforeRecord?.scrollTo !== undefined) await page.evaluate((y) => window.scrollTo(0, y), cfg.beforeRecord.scrollTo);
  await page.waitForTimeout(400);

  // ── screencast ────────────────────────────────────────────────────────────
  const cdp = await context.newCDPSession(page);
  const frames = []; // { file, t } t = seconds (monotonic, from Chrome)
  let t0Chrome = null;
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    const t = metadata.timestamp;
    if (t0Chrome === null) t0Chrome = t;
    const file = path.join(framesDir, `f${String(frames.length).padStart(6, "0")}.png`);
    writeFileSync(file, Buffer.from(data, "base64"));
    frames.push({ file, t: t - t0Chrome });
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "png", maxWidth: size.width, maxHeight: size.height, everyNthFrame: 1 });
  // wait for the first frame so wall-clock t0 aligns with video t0
  while (!frames.length) await page.waitForTimeout(20);
  const t0 = Date.now();
  const now = () => Date.now() - t0;

  const steps = [];
  const push = (s) => steps.push(s);
  push({ startMs: 0, durationMs: cfg.navMs ?? DUR.navigate, action: "navigate", label: cfg.startLabel ?? null });
  await page.waitForTimeout(cfg.navMs ?? DUR.navigate);

  for (const s of cfg.steps ?? []) {
    const a = s.action;
    const start = now();
    try {
      if (a === "wait") {
        push({ startMs: start, action: a, label: s.label ?? null });
        await page.waitForTimeout(s.ms ?? DUR.wait);
      } else if (a === "navigate") {
        push({ startMs: start, action: a, label: s.label ?? null });
        await page.goto(s.url, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(s.ms ?? DUR.navigate);
      } else if (a === "scroll") {
        push({ startMs: start, action: a, label: s.label ?? null });
        await page.evaluate(([to, smooth]) => window.scrollTo({ top: to, behavior: smooth ? "smooth" : "auto" }), [s.to ?? 600, true]);
        await page.waitForTimeout(s.ms ?? DUR.scroll);
      } else {
        const el = page.locator(s.selector).first();
        await el.waitFor({ state: "visible", timeout: 20000 });
        await el.scrollIntoViewIfNeeded().catch(() => {});
        const box = await el.boundingBox();
        const x = Math.round(box.x + box.width / 2), y = Math.round(box.y + box.height / 2);
        push({ startMs: now(), action: a, x, y, label: s.label ?? null });
        await page.mouse.move(x, y, { steps: 10 });
        if (a === "hover") await el.hover().catch(() => {});
        if (a === "click") await el.click().catch(() => page.mouse.click(x, y));
        await page.waitForTimeout(s.ms ?? DUR[a] ?? 800);
      }
    } catch (err) {
      console.warn(`step failed (${a} ${s.selector ?? ""}): ${err.message.split("\n")[0]}`);
      push({ startMs: start, action: "wait", label: s.label ?? null });
      await page.waitForTimeout(s.ms ?? 800);
    }
  }
  const totalMs = now();
  await cdp.send("Page.stopScreencast").catch(() => {});
  await page.waitForTimeout(300);
  await browser.close();

  // durations from successive starts (wall-clock)
  steps.forEach((s, i) => (s.durationMs = (i + 1 < steps.length ? steps[i + 1].startMs : totalMs) - s.startMs));

  // ── encode: variable-timestamp PNGs → constant-fps H.264 ───────────────────
  const list = [];
  frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].t : totalMs / 1000;
    list.push(`file '${f.file}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
  });
  list.push(`file '${frames.at(-1).file}'`);
  const listPath = path.join(framesDir, "list.txt");
  writeFileSync(listPath, list.join("\n"));
  const mp4 = path.join(outDir, "recording.mp4");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listPath,
    "-vf", `fps=${fps},scale=${size.width}:${size.height}:flags=lanczos,format=yuv420p`,
    "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-tune", "stillimage", "-movflags", "+faststart", mp4]);
  rmSync(framesDir, { recursive: true, force: true });

  const rel = path.relative(path.resolve("public"), mp4);
  writeFileSync(path.join(outDir, "actions.json"), JSON.stringify({ fps, video: rel, size, steps, durationMs: totalMs }, null, 2));
  console.log(`✓ ${path.basename(outDir)}: ${steps.length} steps, ${(totalMs / 1000).toFixed(1)}s, ${frames.length} source frames → ${Math.round((totalMs / 1000) * fps)} frames @${fps}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
