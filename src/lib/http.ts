/** Error thrown by `request`; `code` is the API's error code (see i18n `errors`). */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
  }
}

export async function request<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(url, {
    method: init?.method,
    headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(typeof body.error === "string" ? body.error : "generic", response.status);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export function errorCode(error: unknown): string {
  return error instanceof ApiError ? error.code : "generic";
}
