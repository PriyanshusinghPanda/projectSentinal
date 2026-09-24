/**
 * Stage — a fixed 1920×1080 absolute coordinate space for diagram scenes.
 * Node/Arrow/Packet are positioned by absolute coordinates; render them inside
 * a <Stage> so those coordinates always mean the same thing regardless of the
 * Scene's padding. Use a <Stage> directly as the scene body (it fills the frame)
 * rather than nesting it inside <Scene>'s centered column.
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { theme } from "./theme";

export const STAGE_W = 1920;
export const STAGE_H = 1080;

export const Stage: React.FC<{ children: React.ReactNode; background?: string }> = ({
  children,
  background,
}) => (
  <AbsoluteFill
    style={{
      backgroundColor: background ?? theme.colors.bg,
      fontFamily: theme.font.family,
      color: theme.colors.fg,
    }}
  >
    <div style={{ position: "absolute", inset: 0 }}>{children}</div>
  </AbsoluteFill>
);
