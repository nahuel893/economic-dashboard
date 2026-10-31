import type { Indicator } from "./types";

/** Runs one indicator loader and turns a failure into an error slot instead of throwing. */
export async function settle<T>(source: string, load: () => Promise<T>): Promise<Indicator<T>> {
  try {
    return { status: "ok", source, data: await load() };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[indicators] ${source} failed: ${message}`);
    return { status: "error", source, message };
  }
}
