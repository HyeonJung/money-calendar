import { MobileEventDetail } from "@/components/mobile-client";

export default async function MobileEditEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <MobileEventDetail eventId={eventId} edit />;
}
