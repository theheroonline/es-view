export interface HttpRequestResult {
  status: number;
  ok: boolean;
  body: string;
}

export async function requestHttp(
  url: string,
  options: { method: string; headers?: Record<string, string>; body?: string }
): Promise<HttpRequestResult> {
  const response = await fetch(url, {
    method: options.method,
    headers: options.headers,
    body: options.body,
  });

  return {
    status: response.status,
    ok: response.ok,
    body: await response.text(),
  };
}