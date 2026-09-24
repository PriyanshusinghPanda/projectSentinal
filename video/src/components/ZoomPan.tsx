/**
 * ZoomPan — wraps the recording + overlays and punches the frame in toward
 * whatever the user is interacting with, then eases back out during navigation
 * and idle moments. This "auto-zoom on the action" is the other half (with the
 * eased cursor) of the Loom/Screen-Studio feel: it directs attention without the
 * viewer having to hunt the frame for what changed.
 *
 * Everything inside is scaled together, so the cursor and click pulses stay
 * locked to the page under zoom. Captions should be placed OUTSIDE this wrapper
 * so they remain stable lower-thirds in screen space.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { zoomAt, framesToMs, type WalkStep } from "./walkthrough-timeline";

export const ZoomPan: React.FC<{
  steps: WalkStep[];
  children: React.ReactNode;
  /** Peak zoom factor (1 = no zoom). 1.3–1.5 reads well. */
  zoom?: number;
  /** Ramp in/out duration in ms. */
  rampMs?: number;
}> = ({ steps, children, zoom = 1.35, rampMs = 320 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const z = zoomAt(steps, framesToMs(frame, fps), {
    width,
    height,
    zoom,
    rampMs,
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transformOrigin: "0 0",
          transform: `translate(${z.tx}px, ${z.ty}px) scale(${z.scale})`,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
