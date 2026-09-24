"use client";
import { MotionConfig } from "framer-motion";

/** App-wide motion policy: honour the OS "reduce motion" setting everywhere. */
export function Providers({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
