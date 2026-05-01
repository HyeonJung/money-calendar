import type { Metadata } from "next";
import { HotDealsExplorer } from "@/components/hot-deals-explorer";
import { getHotDeals } from "@/lib/hot-deals";

export const metadata: Metadata = {
  title: "핫딜 | 머니캘린더",
  description: "공개 핫딜 소스에서 수집한 최신 할인 정보를 한곳에서 확인하세요.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HotDealsPage() {
  const hotDeals = await getHotDeals(60);

  return <HotDealsExplorer deals={hotDeals} />;
}
