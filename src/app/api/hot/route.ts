import { getHotSnapshot } from "@/lib/indicators/hot";

/** Hot indicators snapshot, polled by the dashboard. Upstream calls are cached per source. */
export async function GET() {
  const snapshot = await getHotSnapshot();
  return Response.json(snapshot, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  });
}
