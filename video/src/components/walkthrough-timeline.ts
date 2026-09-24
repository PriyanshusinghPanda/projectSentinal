/**
 * walkthrough-timeline.ts — pure math for the browser-walkthrough overlay.
 *
 * This file has NO React/Remotion imports on purpose: it holds the deterministic
 * functions that turn a recorded step timeline (the `actions.json` written by
 * `scripts/record-walkthrough.mjs`) into per-frame cursor position, zoom
 * transform, and active caption. Keeping it pure means it can be unit-tested in
 * plain Node, and both `Cursor`, `ClickPulse`, `ZoomPan`, and `BrowserWalkthrough`
 * read from the same source of truth, so the synthetic cursor, the click pulse,
 * and the zoom all stay glued to the same point on the page.
 *
 * Coordinate space: pixels in the recording, which is captured at the SAME size
 * as the Remotion composition (e.g. 1920×1080). So step (x,y) map 1:1 onto frame
 * coordinates, measured from the top-left.
 */

export type WalkAction =
  | "navigate"
  | "wait"
  | "move"
  | "hover"
  | "click"
  | "type"
  | "scroll";

export interface WalkStep {
  /** Milliseconds from the start of the recording when this step begins. */
  startMs: number;
  /** How long the step occupies the timeline. */
  durationMs: number;
  /**
   * One of `WalkAction`. Typed as a widened string so an imported `actions.json`
   * (where TS infers `string`) assigns cleanly to `WalkData` with no cast, while
   * the union still gives editor autocomplete when authoring by hand.
   */
  action: WalkAction | (string & {});
  /** Target point on the page (present for move/hover/click/type, optional for scroll). */
  x?: number;
  y?: number;
  /** Typed text, for `type` steps. */
  value?: string;
  /** Caption text shown while this step is on screen. */
  label?: string;
}

export interface WalkData {
  fps: number;
  /** public/-relative path to the recording, e.g. "walkthrough/recording.mp4". */
  video: string;
  size: { width: number; height: number };
  steps: WalkStep[];
  durationMs: number;
}

/* ----------------------------- easing ----------------------------- */

export function easeInOutCubic(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/* --------------------------- cursor path --------------------------- */

/** Steps that move the pointer (everything with a real target point). */
export function pointerSteps(steps: WalkStep[]): Required<
  Pick<WalkStep, "startMs" | "x" | "y">
>[] {
  return steps
    .filter((s) => s.x != null && s.y != null && s.action !== "navigate")
    .map((s) => ({ startMs: s.startMs, x: s.x as number, y: s.y as number }));
}

/**
 * Cursor position at time `ms`. The cursor rests on the previous target, then
 * eases to the next target so it ARRIVES exactly as that step fires (a click
 * lands under the pointer, not after it). Travel time is capped so long idle
 * gaps don't produce slow drifting motion.
 */
export function cursorAt(
  steps: WalkStep[],
  ms: number,
  opts?: { maxTravelMs?: number; minTravelMs?: number },
): { x: number; y: number; pressing: boolean } | null {
  const pts = pointerSteps(steps);
  if (pts.length === 0) return null;

  const maxTravel = opts?.maxTravelMs ?? 650;
  const minTravel = opts?.minTravelMs ?? 220;

  // Before the first target, sit at it (cursor pre-positioned, no teleport-in).
  if (ms <= pts[0].startMs) {
    return { x: pts[0].x, y: pts[0].y, pressing: false };
  }
  // After the last target, hold there.
  const last = pts[pts.length - 1];
  if (ms >= last.startMs) {
    return { x: last.x, y: last.y, pressing: nearClick(steps, ms) };
  }

  // Find the segment [from -> to] surrounding `ms`.
  let from = pts[0];
  let to = pts[1];
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].startMs > ms) {
      from = pts[i - 1];
      to = pts[i];
      break;
    }
  }

  const gap = to.startMs - from.startMs;
  const travel = clamp(gap * 0.7, minTravel, maxTravel);
  const travelStart = to.startMs - travel;

  if (ms <= travelStart) {
    return { x: from.x, y: from.y, pressing: false };
  }
  const t = easeInOutCubic((ms - travelStart) / travel);
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    pressing: false,
  };
}

/** True within a short window around any click, used to dip the cursor. */
function nearClick(steps: WalkStep[], ms: number): boolean {
  return steps.some(
    (s) => s.action === "click" && ms >= s.startMs && ms <= s.startMs + 140,
  );
}

/* --------------------------- click pulses -------------------------- */

export interface PulseState {
  x: number;
  y: number;
  /** 0→1 progress of the ring expansion. */
  progress: number;
}

/** All click pulses currently visible at `ms` (usually 0 or 1). */
export function pulsesAt(
  steps: WalkStep[],
  ms: number,
  pulseMs = 520,
): PulseState[] {
  const out: PulseState[] = [];
  for (const s of steps) {
    if (s.action !== "click" || s.x == null || s.y == null) continue;
    const t = (ms - s.startMs) / pulseMs;
    if (t >= 0 && t <= 1) out.push({ x: s.x, y: s.y, progress: t });
  }
  return out;
}

/* ------------------------------ zoom ------------------------------- */

export interface ZoomState {
  scale: number;
  /** Transform applied with transform-origin 0 0: translate(tx,ty) scale(scale). */
  tx: number;
  ty: number;
}

/**
 * Auto-zoom transform at time `ms`. We zoom toward click/type targets (where the
 * action is) and ease back to the full frame during navigation, scrolling, and
 * idle gaps — the "punch in on what matters" move that reads as Loom/Screen
 * Studio. The transform is clamped so zooming never reveals empty space past the
 * recording edges.
 */
export function zoomAt(
  steps: WalkStep[],
  ms: number,
  cfg: {
    width: number;
    height: number;
    zoom?: number;
    /** Ramp in/out duration for the zoom, ms. */
    rampMs?: number;
    /** Keep zoomed if the next focus starts within this gap, ms. */
    bridgeMs?: number;
  },
): ZoomState {
  const W = cfg.width;
  const H = cfg.height;
  const Z = cfg.zoom ?? 1.35;
  const ramp = cfg.rampMs ?? 320;
  const bridge = cfg.bridgeMs ?? 700;

  const foci = steps.filter(
    (s) =>
      (s.action === "click" || s.action === "type" || s.action === "hover") &&
      s.x != null &&
      s.y != null,
  );

  if (foci.length === 0) {
    return { scale: 1, tx: 0, ty: 0 };
  }

  // Determine the active focus and a 0→1 zoom strength via ramp in/out, with
  // bridging so back-to-back foci stay zoomed and just pan between targets.
  let strength = 0;
  let cx = W / 2;
  let cy = H / 2;

  for (let i = 0; i < foci.length; i++) {
    const f = foci[i];
    const inStart = f.startMs - ramp;
    const holdEnd = f.startMs + f.durationMs;
    const next = foci[i + 1];
    const bridged = next && next.startMs - holdEnd <= bridge;
    const outEnd = bridged ? holdEnd : holdEnd + ramp;

    if (ms < inStart || ms > outEnd) continue;

    cx = f.x as number;
    cy = f.y as number;

    if (ms < f.startMs) {
      strength = easeInOutCubic((ms - inStart) / ramp);
    } else if (ms <= holdEnd) {
      strength = 1;
      // Pan smoothly toward the next focus while bridged.
      if (bridged && next) {
        const blend = easeInOutCubic(
          clamp((ms - f.startMs) / Math.max(1, holdEnd - f.startMs), 0, 1),
        );
        cx = lerp(f.x as number, next.x as number, blend);
        cy = lerp(f.y as number, next.y as number, blend);
      }
    } else {
      strength = bridged ? 1 : easeInOutCubic(1 - (ms - holdEnd) / ramp);
    }
    break;
  }

  const scale = lerp(1, Z, clamp(strength, 0, 1));
  // Center (cx,cy) in the frame, then clamp so edges never pull inside.
  let tx = W / 2 - cx * scale;
  let ty = H / 2 - cy * scale;
  tx = clamp(tx, W * (1 - scale), 0);
  ty = clamp(ty, H * (1 - scale), 0);
  return { scale, tx, ty };
}

/* ---------------------------- captions ----------------------------- */

/** The caption label active at `ms` (the latest step whose window covers it). */
export function captionAt(steps: WalkStep[], ms: number): string | null {
  let label: string | null = null;
  for (const s of steps) {
    if (!s.label) continue;
    if (ms >= s.startMs && ms <= s.startMs + s.durationMs) label = s.label;
  }
  return label;
}

export const msToFrames = (ms: number, fps: number) =>
  Math.round((ms / 1000) * fps);
export const framesToMs = (frame: number, fps: number) =>
  (frame / fps) * 1000;
