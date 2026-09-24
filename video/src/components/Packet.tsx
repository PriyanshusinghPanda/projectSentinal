/**
 * Packet — a labeled dot that travels from (x1,y1) to (x2,y2) over a frame
 * window. THE primitive for "a message crossing the wire" (TCP segments,
 * WebSocket frames, requests/responses). Fire several with staggered ranges to
 * show continuous, full-duplex traffic.
 */
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "./theme";

export const Packet: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Frame to start moving. */
  start: number;
  /** How many frames the trip takes. */
  duration?: number;
  color?: string;
  label?: string;
  size?: number;
  /** Arc height; positive bows upward. */
  bow?: number;
}> = ({
  x1,
  y1,
  x2,
  y2,
  start,
  duration = 30,
  color = theme.colors.accent,
  label,
  size = 22,
  bow = 0,
}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Quadratic bezier position for a slight arc.
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2 - bow;
  const x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
  const y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;

  // Fade in at launch, fade out on arrival.
  const opacity = interpolate(
    t,
    [0, 0.08, 0.92, 1],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  if (frame < start) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
        display: "flex",
        alignItems: "center",
        gap: theme.space(1),
        opacity,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 18px ${color}`,
        }}
      />
      {label && (
        <div
          style={{
            fontSize: theme.font.size.label,
            color: theme.colors.fg,
            background: theme.colors.surfaceAlt,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.sm,
            padding: `2px ${theme.space(1.5)}px`,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};
