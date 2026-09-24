/**
 * useEntrance — the workhorse animation hook.
 *
 * Returns a 0→1 progress value that springs in at `delay` frames and (optionally)
 * springs back out before the scene ends. Use the returned progress to drive
 * opacity, translate, scale, etc. This keeps every entrance in the video
 * consistent and eased (never linear).
 *
 * Example:
 *   const p = useEntrance({ delay: 6 });
 *   style={{ opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}
 */
import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { theme } from "../components/theme";

type SpringName = keyof typeof theme.springs;

export function useEntrance(opts?: {
  delay?: number;
  config?: SpringName;
  /** If set, element eases back out starting this many frames before the end. */
  exitAt?: number;
  /** Total frames of the host Sequence; required if using exitAt. */
  durationInFrames?: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delay = opts?.delay ?? 0;
  const config = theme.springs[opts?.config ?? "gentle"];

  const enter = spring({
    frame: frame - delay,
    fps,
    config,
    durationInFrames: 22,
  });

  if (opts?.exitAt != null && opts?.durationInFrames != null) {
    const exitStart = opts.durationInFrames - opts.exitAt;
    const exit = interpolate(frame, [exitStart, opts.durationInFrames], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return Math.min(enter, exit);
  }

  return enter;
}

/** Convenience: progress over an explicit frame window with smooth easing. */
export function useProgress(start: number, end: number) {
  const frame = useCurrentFrame();
  return interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}
