/**
 * Scene — a full-frame wrapper giving every scene a consistent background,
 * padding, and centered content column. Wrap each scene's body in <Scene>.
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { theme } from "./theme";

export const Scene: React.FC<{
  children: React.ReactNode;
  /** Override the background (e.g. for a code-focused scene). */
  background?: string;
  /** Vertical alignment of content. Default centers. */
  align?: "center" | "top";
  padding?: number;
}> = ({ children, background, align = "center", padding = theme.space(12) }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: background ?? theme.colors.bg,
        fontFamily: theme.font.family,
        color: theme.colors.fg,
        padding,
        display: "flex",
        flexDirection: "column",
        justifyContent: align === "center" ? "center" : "flex-start",
        alignItems: "center",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
