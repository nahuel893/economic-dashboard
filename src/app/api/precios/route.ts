import type { NextRequest } from "next/server";
import { searchSepa } from "@/lib/sources/prices";

/** Longer queries add nothing to a product name search. */
const MAX_QUERY = 80;

/** Product search for the Precios tab's search box: `?q=leche` → the day and up to a dozen matching products. */
export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").slice(0, MAX_QUERY);
  try {
    return Response.json(await searchSepa(query), {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" },
    });
  } catch (error) {
    console.error(`[precios] search failed: ${error instanceof Error ? error.message : String(error)}`);
    return Response.json({ error: "Los precios de SEPA no están disponibles en este momento." }, { status: 503 });
  }
}
