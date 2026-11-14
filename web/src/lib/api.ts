export interface HealthPayload {
  status: string;
  service: string;
  environment: string;
}

export type HealthResult =
  | { ok: true; url: string; data: HealthPayload }
  | { ok: false; url: string; error: string };

/**
 * Resolve the FastAPI base URL at request time.
 * Prefers Railway Private Networking (`API_INTERNAL_URL`) for server-side fetches.
 */
export function getApiBaseUrl(): string {
  return (
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:8000"
  ).replace(/\/+$/, "");
}

/**
 * Fetch health metadata from the FastAPI service without throwing during SSR/builds.
 */
export async function fetchApiHealth(): Promise<HealthResult> {
  const baseUrl = getApiBaseUrl();
  const target = `${baseUrl}/health`;

  try {
    const response = await fetch(target, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      return {
        ok: false,
        url: target,
        error: `HTTP ${response.status} ${response.statusText}`,
      };
    }

    const data = (await response.json()) as HealthPayload;
    return { ok: true, url: target, data };
  } catch (error) {
    return {
      ok: false,
      url: target,
      error: error instanceof Error ? error.message : "Unknown fetch error",
    };
  }
}
