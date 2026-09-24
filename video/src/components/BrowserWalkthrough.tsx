/**
 * BrowserWalkthrough — the Loom-style scene. Feed it the `actions.json` produced
 * by `scripts/record-walkthrough.mjs` and it composites the whole thing:
 *
 *   <ZoomPan>                 ← punches in on the action
 *     <ScreenRecording/>      ← the real captured browser
 *     <Cursor/>               ← synthetic pointer, eased between targets
 *     <ClickPulse/>           ← tap ripples
 *   </ZoomPan>
 *   <Caption/>                ← stable lower-third, swaps per step
 *   <Audio/>                  ← optional narration
 *
 * Drop it into your <Series> like any other scene. Its duration should be about
 * `data.durationMs` converted to frames (the recorder prints this for you).
 */
import React from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ScreenRecording } from "./ScreenRecording";
import { Cursor } from "./Cursor";
import { ClickPulse } from "./ClickPulse";
import { ZoomPan } from "./ZoomPan";
import { Caption } from "./Caption";
import { captionAt, framesToMs, type WalkData } from "./walkthrough-timeline";

export const BrowserWalkthrough: React.FC<{
  data: WalkData;
  /** Optional narration track (public/-relative), e.g. "vo/walkthrough.mp3". */
  audioSrc?: string;
  zoom?: number;
  showCaptions?: boolean;
  showCursor?: boolean;
}> = ({ data, audioSrc, zoom = 1.35, showCaptions = true, showCursor = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const label = captionAt(data.steps, framesToMs(frame, fps));

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ZoomPan steps={data.steps} zoom={zoom}>
        <ScreenRecording src={data.video} />
        <ClickPulse steps={data.steps} />
        {showCursor && <Cursor steps={data.steps} />}
      </ZoomPan>

      {showCaptions && label && (
        // key on the label so the caption re-springs each time the text changes.
        <Caption key={label}>{label}</Caption>
      )}

      {audioSrc && <Audio src={staticFile(audioSrc)} />}
    </AbsoluteFill>
  );
};
