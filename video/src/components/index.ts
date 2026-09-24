// Barrel export — import any component from "../components".
export { theme } from "./theme";
export type { Theme } from "./theme";
export { Scene } from "./Scene";
export { Stage, STAGE_W, STAGE_H } from "./Stage";
export { Title, KineticText } from "./Title";
export { Caption } from "./Caption";
export { Node, NODE_DEFAULT_W, NODE_DEFAULT_H } from "./Node";
export type { NodeProps } from "./Node";
export { Arrow } from "./Arrow";
export { Packet } from "./Packet";
export { CodeBlock } from "./CodeBlock";
export { Counter } from "./Counter";
export { BarChart } from "./BarChart";
export { WhiteboardPath } from "./WhiteboardPath";

// Browser walkthrough (Loom-style screen recording) ---------------------------
export { ScreenRecording } from "./ScreenRecording";
export { Cursor } from "./Cursor";
export { ClickPulse } from "./ClickPulse";
export { ZoomPan } from "./ZoomPan";
export { BrowserWalkthrough } from "./BrowserWalkthrough";
export {
  cursorAt,
  pulsesAt,
  zoomAt,
  captionAt,
  pointerSteps,
  easeInOutCubic,
  msToFrames,
  framesToMs,
} from "./walkthrough-timeline";
export type {
  WalkData,
  WalkStep,
  WalkAction,
  ZoomState,
  PulseState,
} from "./walkthrough-timeline";
