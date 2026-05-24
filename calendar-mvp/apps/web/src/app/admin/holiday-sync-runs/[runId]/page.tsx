import { HolidayRunDetailClient } from "@/components/holiday-admin-client";

export default async function HolidayRunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return <HolidayRunDetailClient runId={runId} />;
}
