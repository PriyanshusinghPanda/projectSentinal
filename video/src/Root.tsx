import React from "react";
import { Composition } from "remotion";
import { TOTAL_FRAMES, Video } from "./Video";

export const RemotionRoot: React.FC = () => (
  <Composition id="Demo" component={Video} durationInFrames={TOTAL_FRAMES} fps={60} width={1920} height={1080} />
);
