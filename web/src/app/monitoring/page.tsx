import { insight, type MonitoringSummary } from "@/lib/insights";
import { MonitoringView } from "./MonitoringView";

export const dynamic = "force-dynamic";

export default function Monitoring() {
  return <MonitoringView s={insight<MonitoringSummary | null>("monitoring", null)} />;
}
