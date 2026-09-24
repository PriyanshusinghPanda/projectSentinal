/**
 * BarChart — horizontal bars that grow in, with value labels. For simple
 * comparisons in infographic scenes (e.g. latency: polling vs websockets).
 */
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "./theme";

type Bar = { label: string; value: number; color?: string };

export const BarChart: React.FC<{
  data: Bar[];
  /** Max value for scaling; defaults to the largest value. */
  max?: number;
  width?: number;
  barHeight?: number;
  delay?: number;
  /** Stagger between bars in frames. */
  step?: number;
  unit?: string;
}> = ({ data, max, width = 900, barHeight = 64, delay = 0, step = 8, unit = "" }) => {
  const frame = useCurrentFrame();
  const peak = max ?? Math.max(...data.map((d) => d.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: theme.space(3), width }}>
      {data.map((d, i) => {
        const start = delay + i * step;
        const grow = interpolate(frame, [start, start + 24], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: (x) => 1 - Math.pow(1 - x, 3),
        });
        const pct = (d.value / peak) * grow;
        const color = d.color ?? theme.colors.accent;
        return (
          <div key={i}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: theme.space(1),
                fontSize: theme.font.size.label,
                color: theme.colors.muted,
              }}
            >
              <span>{d.label}</span>
              <span style={{ color: theme.colors.fg, fontVariantNumeric: "tabular-nums" }}>
                {Math.round(d.value * grow).toLocaleString()}
                {unit}
              </span>
            </div>
            <div
              style={{
                height: barHeight,
                background: theme.colors.surface,
                borderRadius: theme.radius.sm,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${pct * 100}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${color}AA, ${color})`,
                  borderRadius: theme.radius.sm,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
