/**
 * WhiteboardPath — an SVG path that "draws itself on," for the whiteboard
 * animation style. Supply any SVG path `d` string; it strokes on over a window.
 * Combine several with staggered delays to build up a hand-drawn illustration.
 *
 * Tip: the classic whiteboard look uses a dark stroke on a light background and
 * a marker-like cap. Set the Scene background to a light color for this style.
 */
import React, { useRef, useState, useEffect } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "./theme";

export const WhiteboardPath: React.FC<{
  d: string;
  delay?: number;
  duration?: number;
  color?: string;
  width?: number;
  /** SVG viewBox, e.g. "0 0 800 400". */
  viewBox?: string;
  svgWidth?: number;
  svgHeight?: number;
  fill?: string;
}> = ({
  d,
  delay = 0,
  duration = 30,
  color = "#1B2333",
  width = 6,
  viewBox = "0 0 800 400",
  svgWidth = 800,
  svgHeight = 400,
  fill = "none",
}) => {
  const frame = useCurrentFrame();
  const ref = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(1000);

  useEffect(() => {
    if (ref.current) setLen(ref.current.getTotalLength());
  }, [d]);

  const draw = interpolate(frame, [delay, delay + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <svg width={svgWidth} height={svgHeight} viewBox={viewBox}>
      <path
        ref={ref}
        d={d}
        fill={draw > 0.98 ? fill : "none"}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={len}
        strokeDashoffset={(1 - draw) * len}
      />
    </svg>
  );
};
