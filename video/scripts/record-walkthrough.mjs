#!/usr/bin/env node
/**
 * record-walkthrough.mjs — drive a real browser through a scripted flow, record
 * the viewport, and emit the timeline the Remotion overlay needs.
 *
 * Why this shape: Playwright records the PAGE (not the OS cursor), so the raw
 * video has no pointer. We therefore (a) capture the on-page coordinates of each
 * action's target and (b) build a deterministic timeline from the step durations
 * — then the Remotion side draws an eased cursor, click pulses, and auto-zoom on
 * top. Pacing is driven by the script's own waits, so the timeline maps cleanly
 * onto video time; insert explicit `wait` steps to control rhythm.
 *
 * Usage:
 *   npm i -D playwright            # then: npx playwright install chromium
 *   node scripts/record-walkthrough.mjs scripts/walkthrough.config.json
 *
 * Output (into config.outDir, default ./public/walkthrough):
 *   recording.mp4   — the captured viewport (h264; falls back to .webm if no ffmpeg)
 *   actions.json    — { fps, video, size, steps[], durationMs } for BrowserWalkthrough
 *
 * IMPORTANT: record at the SAME size as your Remotion composition (default
 * 1920×1080) so overlay coordinates line up 1:1 with the page.
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { writeFileSync } from "node:fs";
import path from "node:path";

const configPath = process.argv[2] || "scripts/walkthrough.config.json";
const cfg = JSON.parse(readFileSync(configPath, "utf8"));

const size = cfg.viewport ?? { width: 1920, height: 1080 };
const fps = cfg.fps ?? 30;
const outDir = path.resolve(cfg.outDir ?? "public/walkthrough");
const headless = cfg.headless ?? true;
const channel = cfg.channel ?? null; // e.g. "chrome" to use system Chrome
const rawDir = path.join(outDir, ".raw");

mkdirSync(outDir, { recursive: true });
mkdirSync(rawDir, { recursive: true });

// Default per-action timeline durations (ms) when a step omits its own.
const DUR = {
  navigate: 1500,
  wait: 1000,
  move: 700,
  hover: 900,
  click: 700,
  type: (text) => Math.max(900, (text?.length ?? 0) * 90 + 300),
  scroll: 1000,
};

const centerOf = async (page, selector) => {
  const el = page.locator(selector).first();
  await el.waitFor({ state: "visible", timeout: 15000 });
  const box = await el.boundingBox();
  if (!box) throw new Error(`No bounding box for selector: ${selector}`);
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
};

async function run() {
  const browser = await chromium.launch({ headless, channel: channel ?? undefined });
  const context = await browser.newContext({
    viewport: size,
    deviceScaleFactor: 1,
    recordVideo: { dir: rawDir, size },
  });
  const page = await context.newPage();

  const steps = [];
  let cursorMs = 0; // running timeline cursor

  // Initial navigation counts as the first beat.
  if (cfg.url) {
    await page.goto(cfg.url, { waitUntil: "domcontentloaded" });
    const d = cfg.navMs ?? DUR.navigate;
    steps.push({ startMs: cursorMs, durationMs: d, action: "navigate", label: cfg.startLabel ?? null });
    cursorMs += d;
    await page.waitForTimeout(d);
  }

  for (const s of cfg.steps ?? []) {
    const action = s.action;
    let x, y;

    try {
      if (action === "wait") {
        const d = s.ms ?? DUR.wait;
        steps.push({ startMs: cursorMs, durationMs: d, action, label: s.label ?? null });
        cursorMs += d;
        await page.waitForTimeout(d);
        continue;
      }

      if (action === "navigate") {
        const d = s.ms ?? DUR.navigate;
        await page.goto(s.url, { waitUntil: "domcontentloaded" });
        steps.push({ startMs: cursorMs, durationMs: d, action, label: s.label ?? null });
        cursorMs += d;
        await page.waitForTimeout(d);
        continue;
      }

      if (action === "scroll") {
        const d = s.ms ?? DUR.scroll;
        const to = s.to ?? 600;
        await page.mouse.wheel(0, to);
        await page.waitForTimeout(250);
        steps.push({ startMs: cursorMs, durationMs: d, action, label: s.label ?? null });
        cursorMs += d;
        await page.waitForTimeout(d - 250);
        continue;
      }

      // Pointer actions: resolve target, log coords, move the real mouse there.
      ({ x, y } = await centerOf(page, s.selector));
      await page.mouse.move(x, y, { steps: 12 });

      if (action === "move" || action === "hover") {
        const d = s.ms ?? DUR[action];
        if (action === "hover") await page.hover(s.selector).catch(() => {});
        steps.push({ startMs: cursorMs, durationMs: d, action, x, y, label: s.label ?? null });
        cursorMs += d;
        await page.waitForTimeout(d);
        continue;
      }

      if (action === "click") {
        const d = s.ms ?? DUR.click;
        steps.push({ startMs: cursorMs, durationMs: d, action, x, y, label: s.label ?? null });
        await page.click(s.selector).catch(() => page.mouse.click(x, y));
        cursorMs += d;
        await page.waitForTimeout(d);
        continue;
      }

      if (action === "type") {
        const text = s.text ?? "";
        const d = s.ms ?? DUR.type(text);
        steps.push({ startMs: cursorMs, durationMs: d, action, x, y, value: text, label: s.label ?? null });
        await page.click(s.selector).catch(() => {});
        if (s.clear) await page.fill(s.selector, "").catch(() => {});
        await page.type(s.selector, text, { delay: 55 }).catch(async () => {
          await page.keyboard.type(text, { delay: 55 });
        });
        cursorMs += d;
        await page.waitForTimeout(300);
        continue;
      }

      console.warn(`Unknown action "${action}" — skipped.`);
    } catch (err) {
      console.warn(`Step failed (${action} ${s.selector ?? ""}): ${err.message}`);
      // Still advance the timeline so later steps stay aligned with the video.
      const d = s.ms ?? 800;
      steps.push({ startMs: cursorMs, durationMs: d, action, x, y, label: s.label ?? null });
      cursorMs += d;
      await page.waitForTimeout(d);
    }
  }

  // Finalize the video: it's written on context.close().
  const video = page.video();
  await context.close();
  await browser.close();

  const rawPath = await video.path();
  const mp4Path = path.join(outDir, "recording.mp4");
  const webmPath = path.join(outDir, "recording.webm");

  let videoRel = "walkthrough/recording.mp4";
  try {
    execFileSync("ffmpeg", ["-y", "-i", rawPath, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", mp4Path], { stdio: "ignore" });
  } catch {
    console.warn("ffmpeg not available or failed — keeping .webm. Remotion OffthreadVideo can play it.");
    renameSync(rawPath, webmPath);
    videoRel = "walkthrough/recording.webm";
  }
  // Clean the raw capture dir.
  try { rmSync(rawDir, { recursive: true, force: true }); } catch {}

  const data = {
    fps,
    video: videoRel,
    size,
    steps,
    durationMs: cursorMs,
  };
  const actionsPath = path.join(outDir, "actions.json");
  writeFileSync(actionsPath, JSON.stringify(data, null, 2));

  const totalFrames = Math.round((cursorMs / 1000) * fps);
  console.log(`\n✓ Recorded ${steps.length} steps, ${(cursorMs / 1000).toFixed(1)}s`);
  console.log(`  video:   ${path.join(outDir, path.basename(videoRel))}`);
  console.log(`  timeline: ${actionsPath}`);
  console.log(`  → set the BrowserWalkthrough scene to ~${totalFrames} frames at ${fps}fps\n`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
