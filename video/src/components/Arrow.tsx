/**
 * Arrow — an animated connector between two points (x1,y1) → (x2,y2).
 * Draws itself on over a short window and ends in an arrowhead. Use it to wire
 * up Nodes in a diagram. For something traveling ALONG the wire, use Packet.
 *
 * Coordinates are in the same stage space as Node centers, so connect e.g.
 * from the right edge of one node to the left edge of another.
 */
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "./theme";

export const Arrow: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
  width?: number;
  delay?: number;
  /** Curve the line: vertical offset of the control point. 0 = straight. */
  bow?: number;
  dashed?: boolean;
  label?: string;
}> = ({
  x1,
  y1,
  x2,
  y2,
  color = theme.colors.muted,
  width = 4,
  delay = 0,
  bow = 0,
  dashed = false,
  label,
}) => {
  const frame = useCurrentFrame();
  const draw = interpolate(frame, [delay, delay + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 - bow;
  const path = `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
  const id = `arrow-${Math.round(x1)}-${Math.round(y1)}-${Math.round(x2)}-${Math.round(y2)}`;

  return (
    <svg
      style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      width={1}
      height={1}
    >
      <defs>
        <marker
          id={id}
          markerWidth="12"
          markerHeight="12"
          refX="9"
          refY="6"
          orient="auto"
        >
          <path d="M2,2 L10,6 L2,10 Z" fill={color} />
        </marker>
      </defs>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={dashed ? "10 10" : "1000"}
        strokeDashoffset={dashed ? 0 : (1 - draw) * 1000}
        markerEnd={draw > 0.92 ? `url(#${id})` : undefined}
        opacity={dashed ? draw : 1}
      />
      {label && draw > 0.6 && (
        <text
          x={mx}
          y={my - 12}
          fill={theme.colors.muted}
          fontSize={theme.font.size.label}
          fontFamily={theme.font.family}
          textAnchor="middle"
        >
          {label}
        </text>
      )}
    </svg>
  );
};
