/**
 * Cursor — a synthetic mouse pointer that moves smoothly between the recorded
 * action targets. Playwright records the page, not the OS cursor, so the raw
 * video has no pointer at all; this draws one and eases it between targets so it
 * ARRIVES exactly as each click/type fires. That eased arrival (rather than a
 * teleport) is most of what makes a capture read as a hand-made Loom walkthrough.
 *
 * It lives INSIDE the <ZoomPan> layer so it stays glued to the page when the
 * frame punches in. A small press-dip on click adds tactile feel.
 */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { cursorAt, framesToMs, type WalkStep } from "./walkthrough-timeline";
import { theme } from "./theme";

export const Cursor: React.FC<{
  steps: WalkStep[];
  /** On-screen size of the pointer in px (before any zoom scaling). */
  size?: number;
  color?: string;
}> = ({ steps, size = 28, color = theme.colors.fg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pos = cursorAt(steps, framesToMs(frame, fps));
  if (!pos) return null;

  const press = pos.pressing ? 0.86 : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width: size,
        height: size,
        // The pointer tip is the hotspot (top-left of the glyph), so no centering.
        transform: `scale(${press})`,
        transformOrigin: "top left",
        pointerEvents: "none",
        filter: "drop-shadow(0 3px 5px rgba(0,0,0,0.45))",
      }}
    >
      <svg viewBox="0 0 24 24" width={size} height={size}>
        {/* Classic arrow pointer: white fill, dark outline so it reads on any bg. */}
        <path
          d="M3 2 L3 19 L8 14.5 L11 21 L14 19.5 L11 13 L18 13 Z"
          fill={color}
          stroke="#0B1020"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
