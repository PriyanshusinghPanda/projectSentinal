import React from "react";
import { AbsoluteFill, Series } from "remotion";
import "./fonts";
import { BrowserWalkthrough, theme, type WalkData } from "./components";
import { ArchitectureScene, Fade, OutroScene, ProblemScene, ResultsScene, SectionCard, TigerGraphScene, TitleScene, s } from "./scenes/Scenes";
import consoleRec from "../public/rec/console/actions.json";
import hhg005 from "../public/rec/hhg005/actions.json";
import hhg014 from "../public/rec/hhg014/actions.json";

const recFrames = (d: { durationMs: number }) => Math.round((d.durationMs / 1000) * 60);

/** Scene list: [component, duration in frames @60fps]. Order = storyboard. */
export const SCENES: [React.ReactNode, number][] = [
  [<TitleScene key="t" />, s(7)],
  [<ProblemScene key="p" />, s(18)],
  [<ArchitectureScene key="a" />, s(33)],
  [<SectionCard key="c1" n="Live demo" title="The analyst's console" sub="Real recordings of the running app on the 20 exam cases" />, s(3.5)],
  [<BrowserWalkthrough key="w1" data={consoleRec as WalkData} zoom={1} />, recFrames(consoleRec)],
  [<BrowserWalkthrough key="w2" data={hhg005 as WalkData} zoom={1.28} />, recFrames(hhg005)],
  [<BrowserWalkthrough key="w3" data={hhg014 as WalkData} zoom={1.28} />, recFrames(hhg014)],
  [<TigerGraphScene key="g" />, s(26)],
  [<ResultsScene key="r" />, s(22)],
  [<OutroScene key="o" />, s(10)],
];

export const TOTAL_FRAMES = SCENES.reduce((a, [, d]) => a + d, 0);

export const Video: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: theme.colors.bg }}>
    <Series>
      {SCENES.map(([node, dur], i) => (
        <Series.Sequence key={i} durationInFrames={dur}>
          <Fade len={dur}>{node}</Fade>
        </Series.Sequence>
      ))}
    </Series>
  </AbsoluteFill>
);
