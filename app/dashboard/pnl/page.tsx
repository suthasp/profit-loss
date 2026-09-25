import type { Metadata } from "next";
import { PnlDashboard } from "@/components/pnl/PnlDashboard";

export const metadata: Metadata = {
  title: "P&L Dashboard",
};

export default function PnlDashboardPage() {
  return <PnlDashboard />;
}
