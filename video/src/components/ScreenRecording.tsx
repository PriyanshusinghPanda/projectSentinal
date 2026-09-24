/**
 * ScreenRecording — plays the captured browser recording as a full-frame layer.
 *
 * Uses <OffthreadVideo> (not <Video>) because it is far more reliable during
 * `remotion render`: each frame is extracted exactly, so the recording stays in
 * sync with the cursor/zoom overlays. The recording is produced at the same size
 * as the composition by `scripts/record-walkthrough.mjs`, so it fills the frame
 * 1:1 and overlay coordinates line up with what's on screen.
 */
import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";

export const ScreenRecording: React.FC<{
  /** public/-relative path, e.g. "walkthrough/recording.mp4". */
  src: string;
  /** Trim: start playback this many seconds into the file. */
  startFrom?: number;
  muted?: boolean;
}> = ({ src, startFrom, muted = true }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <OffthreadVideo
        src={staticFile(src)}
        startFrom={startFrom}
        muted={muted}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </AbsoluteFill>
  );
};
