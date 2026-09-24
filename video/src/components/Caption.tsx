/**
 * Caption — a lower-third caption / subtitle line. Pair with narration for
 * accessibility and silent autoplay. Sits near the bottom of the frame.
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { useEntrance } from "../hooks/useEntrance";
import { theme } from "./theme";

export const Caption: React.FC<{
  children: React.ReactNode;
  delay?: number;
  /** Distance from the bottom edge in px. */
  bottom?: number;
}> = ({ children, delay = 0, bottom = theme.space(10) }) => {
  const p = useEntrance({ delay });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center" }}>
      <div
        style={{
          marginBottom: bottom,
          maxWidth: 1500,
          textAlign: "center",
          fontSize: theme.font.size.caption,
          fontWeight: theme.font.weight.medium,
          color: theme.colors.bg,
          background: "rgba(32,28,24,0.9)",
          border: "1px solid rgba(32,28,24,0.9)",
          boxShadow: "0 12px 32px -12px rgba(32,28,24,0.45)",
          borderRadius: theme.radius.pill,
          padding: `${theme.space(1.5)}px ${theme.space(4)}px`,
          backdropFilter: "blur(6px)",
          opacity: p,
          transform: `translateY(${(1 - p) * 14}px)`,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};
