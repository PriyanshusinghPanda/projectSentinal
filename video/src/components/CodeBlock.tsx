/**
 * CodeBlock — monospaced code with lightweight syntax colors, line-by-line
 * reveal, and optional line highlighting. Good for showing the actual API a
 * concept maps to (e.g. `new WebSocket(url)`).
 *
 * The highlighter is intentionally minimal (keywords / strings / comments /
 * numbers) and language-agnostic-ish; it covers JS/TS/Python well enough for
 * explainer snippets. Keep snippets SHORT — 4–10 lines reads on screen, 30 does
 * not.
 */
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "./theme";

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "new", "class", "import", "from", "export", "default", "async", "await",
  "def", "print", "true", "false", "null", "undefined", "None", "True", "False",
  "this", "self", "in", "of", "=>",
]);

type Token = { text: string; color: string };

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  // Whole-line comment.
  const commentIdx = line.search(/\/\/|#/);
  let code = line;
  let comment = "";
  if (commentIdx >= 0) {
    code = line.slice(0, commentIdx);
    comment = line.slice(commentIdx);
  }
  // Split keeping delimiters: words, strings, punctuation, whitespace.
  const parts = code.match(/("[^"]*"|'[^']*'|`[^`]*`|\w+|\W)/g) ?? [];
  for (const part of parts) {
    if (/^["'`]/.test(part)) {
      tokens.push({ text: part, color: theme.colors.accent2 });
    } else if (KEYWORDS.has(part)) {
      tokens.push({ text: part, color: theme.colors.accent });
    } else if (/^\d+$/.test(part)) {
      tokens.push({ text: part, color: theme.colors.warn });
    } else {
      tokens.push({ text: part, color: theme.colors.fg });
    }
  }
  if (comment) tokens.push({ text: comment, color: theme.colors.muted });
  return tokens;
}

export const CodeBlock: React.FC<{
  /** Code as a single string with newlines. */
  code: string;
  /** Frame each line starts revealing; lines stagger after `delay`. */
  delay?: number;
  /** Per-line reveal step in frames. */
  step?: number;
  /** 1-based line numbers to highlight. */
  highlight?: number[];
  title?: string;
  fontSize?: number;
}> = ({ code, delay = 0, step = 4, highlight = [], title, fontSize = theme.font.size.code }) => {
  const frame = useCurrentFrame();
  const lines = code.replace(/\n$/, "").split("\n");

  return (
    <div
      style={{
        background: theme.colors.codeBg,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.md,
        overflow: "hidden",
        boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
        minWidth: 760,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: `${theme.space(1.5)}px ${theme.space(2.5)}px`,
          background: theme.colors.surface,
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <Dot c="#FF5F56" />
        <Dot c="#FFBD2E" />
        <Dot c="#27C93F" />
        {title && (
          <span
            style={{
              marginLeft: theme.space(1.5),
              color: theme.colors.muted,
              fontSize: theme.font.size.label,
              fontFamily: theme.font.mono,
            }}
          >
            {title}
          </span>
        )}
      </div>
      <div style={{ padding: theme.space(3), fontFamily: theme.font.mono, fontSize }}>
        {lines.map((line, i) => {
          const lineStart = delay + i * step;
          const opacity = interpolate(frame, [lineStart, lineStart + 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const x = interpolate(frame, [lineStart, lineStart + 8], [12, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const isHi = highlight.includes(i + 1);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                opacity,
                transform: `translateX(${x}px)`,
                background: isHi ? `${theme.colors.accent}22` : "transparent",
                borderLeft: `3px solid ${isHi ? theme.colors.accent : "transparent"}`,
                paddingLeft: theme.space(1.5),
                lineHeight: 1.65,
              }}
            >
              <span
                style={{
                  color: theme.colors.border,
                  width: 36,
                  flexShrink: 0,
                  userSelect: "none",
                }}
              >
                {i + 1}
              </span>
              <span style={{ whiteSpace: "pre" }}>
                {tokenizeLine(line).map((t, j) => (
                  <span key={j} style={{ color: t.color }}>
                    {t.text}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Dot: React.FC<{ c: string }> = ({ c }) => (
  <span style={{ width: 12, height: 12, borderRadius: "50%", background: c }} />
);
