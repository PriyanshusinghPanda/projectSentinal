import { insight, type RingComponent } from "@/lib/insights";
import { RingsView } from "./RingsView";

export const dynamic = "force-dynamic";

export default function Rings() {
  const data = insight<{ meta: { iterations: number; suspicious_txns: number }; components: RingComponent[] }>("rings", { meta: { iterations: 0, suspicious_txns: 0 }, components: [] });
  return <RingsView meta={data.meta} components={data.components} />;
}
