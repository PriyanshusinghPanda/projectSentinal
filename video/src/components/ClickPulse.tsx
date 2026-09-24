/**
 * ClickPulse — an expanding ring at each click target, the visual "tap" feedback
 * that tells the viewer where the action landed. Reads click steps from the same
 * timeline as the cursor so the ripple fires exactly under the pointer. Lives
 * inside <ZoomPan> alongside the cursor.
 */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { pulsesAt, framesToMs, type WalkStep } from "./walkthrough-timeline";
import { theme } from "./theme";

export const ClickPulse: React.FC<{
  steps: WalkStep[];
  color?: string;
  /** Max ring radius in px. */
  radius?: number;
}> = ({ steps, color = theme.colors.accent, radius = 46 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pulses = pulsesAt(steps, framesToMs(frame, fps));

  return (
    <>
      {pulses.map((p, i) => {
        const r = radius * p.progress;
        const opacity = 0.55 * (1 - p.progress);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              width: r * 2,
              height: r * 2,
              marginLeft: -r,
              marginTop: -r,
              borderRadius: "50%",
              border: `3px solid ${color}`,
              boxShadow: `0 0 16px ${color}`,
              opacity,
              pointerEvents: "none",
            }}
          />
        );
      })}
    </>
  );
};
