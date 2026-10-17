import type { Metadata } from "next";
import { DashboardView } from "@/features/dashboard/dashboard-view";

// The root layout's title template only applies to child segments, so set the full title here.
export const metadata: Metadata = { title: { absolute: "Dashboard · Applicant Tracker" } };

export default function DashboardPage() {
  return <DashboardView />;
}
