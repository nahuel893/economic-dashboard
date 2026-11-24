const DEFAULT_TIMEOUT_MS = 8000;

type FetchJsonOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { method = "GET", body } = options;
  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; economic-dashboard)",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`${method} ${new URL(url).host} responded ${response.status}`);
  }
  return (await response.json()) as T;
}

/** Workbooks can weigh several MB (the OEDE wages one is about 11 MB), well past the JSON timeout. */
const FILE_TIMEOUT_MS = 30_000;

/** Like fetchJson, for a page or a file. */
export async function fetchFile(url: string): Promise<Response> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; economic-dashboard)" },
    signal: AbortSignal.timeout(FILE_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`GET ${new URL(url).host} responded ${response.status}`);
  return response;
}
