/**
 * Title — animated title/heading card.
 * KineticText — word-by-word kinetic typography for punchy motion-graphics beats.
 */
import React from "react";
import { useEntrance } from "../hooks/useEntrance";
import { useStagger } from "../hooks/useStagger";
import { theme } from "./theme";

export const Title: React.FC<{
  children: React.ReactNode;
  subtitle?: string;
  delay?: number;
  size?: keyof typeof theme.font.size;
  color?: string;
}> = ({ children, subtitle, delay = 0, size = "title", color }) => {
  const p = useEntrance({ delay, config: "smooth" });
  const ps = useEntrance({ delay: delay + 6 });
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontSize: theme.font.size[size],
          fontFamily: theme.font.display,
          fontWeight: theme.font.weight.regular,
          color: color ?? theme.colors.fg,
          letterSpacing: -0.5,
          lineHeight: 1.05,
          opacity: p,
          transform: `translateY(${(1 - p) * 28}px)`,
        }}
      >
        {children}
      </div>
      {subtitle && (
        <div
          style={{
            marginTop: theme.space(2),
            fontSize: theme.font.size.body,
            color: theme.colors.muted,
            opacity: ps,
            transform: `translateY(${(1 - ps) * 16}px)`,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
};

export const KineticText: React.FC<{
  /** The phrase; each word animates in sequence. */
  text: string;
  delay?: number;
  size?: keyof typeof theme.font.size;
  accentWords?: string[];
}> = ({ text, delay = 0, size = "hero", accentWords = [] }) => {
  const words = text.split(" ");
  const delayFor = useStagger({ base: delay, step: 4 });
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: `0 ${theme.space(2)}px`,
        maxWidth: 1400,
        lineHeight: 1.1,
      }}
    >
      {words.map((word, i) => (
        <Word
          key={i}
          delay={delayFor(i)}
          size={size}
          accent={accentWords.includes(word.replace(/[.,!?]/g, ""))}
        >
          {word}
        </Word>
      ))}
    </div>
  );
};

const Word: React.FC<{
  children: React.ReactNode;
  delay: number;
  size: keyof typeof theme.font.size;
  accent: boolean;
}> = ({ children, delay, size, accent }) => {
  const p = useEntrance({ delay, config: "pop" });
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: theme.font.size[size],
        fontFamily: theme.font.display,
        fontWeight: theme.font.weight.regular,
        fontStyle: accent ? "italic" : "normal",
        color: accent ? theme.colors.accent : theme.colors.fg,
        opacity: p,
        transform: `translateY(${(1 - p) * 30}px) scale(${0.8 + p * 0.2})`,
      }}
    >
      {children}
    </span>
  );
};
