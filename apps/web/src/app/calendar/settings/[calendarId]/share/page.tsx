import { SettingsClient } from "@/components/settings-client";

export default async function CalendarSharePage({ params }: { params: Promise<{ calendarId: string }> }) {
  const { calendarId } = await params;
  return <SettingsClient calendarId={calendarId} initialTab="share" />;
}
