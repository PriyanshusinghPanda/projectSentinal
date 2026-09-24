/**
 * Counter — an animated number that counts up to a target. The staple of
 * infographic scenes ("10,000 concurrent connections").
 */
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "./theme";

export const Counter: React.FC<{
  to: number;
  from?: number;
  delay?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  label?: string;
  color?: string;
  size?: number;
  align?: "left" | "center";
}> = ({
  to,
  from = 0,
  delay = 0,
  duration = 40,
  prefix = "",
  suffix = "",
  decimals = 0,
  label,
  color = theme.colors.accent,
  size = theme.font.size.hero,
  align = "center",
}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [delay, delay + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (x) => 1 - Math.pow(1 - x, 3), // easeOutCubic
  });
  const value = from + (to - from) * t;
  const display = value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (
    <div style={{ textAlign: align }}>
      <div
        style={{
          fontSize: size,
          fontWeight: theme.font.weight.semibold,
          color,
          letterSpacing: -size * 0.03,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {prefix}
        {display}
        {suffix}
      </div>
      {label && (
        <div style={{ fontSize: theme.font.size.body, color: theme.colors.muted }}>
          {label}
        </div>
      )}
    </div>
  );
};
