/**
 * Node — a labeled box (Client, Server, Service, Database…). The core building
 * block of technical/educational diagrams.
 *
 * Positioned by its CENTER (cx, cy) so Arrow and Packet can connect to it with
 * the same coordinate system. Render nodes inside a relative/absolute container
 * sized to the frame (the Scene already centers; use a 1920×1080 inner stage,
 * or pass coordinates relative to an AbsoluteFill).
 */
import React from "react";
import { useEntrance } from "../hooks/useEntrance";
import { theme } from "./theme";

export type NodeProps = {
  label: string;
  sublabel?: string;
  /** Center coordinates within the stage. */
  cx: number;
  cy: number;
  width?: number;
  height?: number;
  /** Emoji or short glyph shown above the label. */
  icon?: string;
  accent?: string;
  delay?: number;
};

export const NODE_DEFAULT_W = 320;
export const NODE_DEFAULT_H = 200;

export const Node: React.FC<NodeProps> = ({
  label,
  sublabel,
  cx,
  cy,
  width = NODE_DEFAULT_W,
  height = NODE_DEFAULT_H,
  icon,
  accent = theme.colors.accent,
  delay = 0,
}) => {
  const p = useEntrance({ delay, config: "gentle" });
  return (
    <div
      style={{
        position: "absolute",
        left: cx - width / 2,
        top: cy - height / 2,
        width,
        height,
        background: theme.colors.surface,
        border: `2px solid ${accent}`,
        borderRadius: theme.radius.lg,
        boxShadow: `0 14px 36px -18px rgba(32,28,24,0.35), 0 0 0 6px ${accent}14`,
        padding: "18px 22px",
        boxSizing: "border-box",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: theme.space(1),
        opacity: p,
        transform: `scale(${0.85 + p * 0.15})`,
      }}
    >
      {icon && <div style={{ fontSize: 56, lineHeight: 1 }}>{icon}</div>}
      <div
        style={{
          fontSize: 44,
          fontFamily: theme.font.display,
          fontWeight: theme.font.weight.regular,
          lineHeight: 1.05,
          whiteSpace: "nowrap",
          color: theme.colors.fg,
        }}
      >
        {label}
      </div>
      {sublabel && (
        <div style={{ fontSize: 21, lineHeight: 1.3, color: theme.colors.muted }}>
          {sublabel}
        </div>
      )}
    </div>
  );
};
