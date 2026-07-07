import { HttpError } from "./errors.js";

export const BASE_URL = "https://api.gobiz.co.id";
export const ANALYTICS_URL = "https://api.gojekapi.com/merchant-analytics/v2/merchants/transactions";
export const JOURNAL_URL = "https://api.gobiz.co.id/journals/search";

export function getAuthHeaders(uniqueId: string, accessToken?: string): Record<string, string> {
  return {
    "accept": "application/json, text/plain, */*",
    "accept-language": "id",
    "authentication-type": "go-id",
    "authorization": accessToken ? `Bearer ${accessToken}` : "Bearer",
    "cache-control": "no-cache",
    "content-type": "application/json",
    "gojek-country-code": "ID",
    "gojek-timezone": "Asia/Jakarta",
    "pragma": "no-cache",
    "sec-ch-ua": "\"Brave\";v=\"149\", \"Chromium\";v=\"149\", \"Not)A;Brand\";v=\"24\"",
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": "\"Android\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "cross-site",
    "sec-gpc": "1",
    "x-appid": "go-biz-web-dashboard",
    "x-appversion": "platform-v3.108.1-66161c15",
    "x-deviceos": "Web",
    "x-phonemake": "Linux 64-bit",
    "x-phonemodel": "Chrome 149.0.0.0 on Linux 64-bit",
    "x-platform": "Web",
    "x-uniqueid": uniqueId,
    "x-user-locale": "en-US",
    "x-user-type": "merchant",
    "referrer": "https://portal.gofoodmerchant.co.id/",
    "origin": "https://portal.gofoodmerchant.co.id",
  };
}

export function generateUniqueId(): string {
  return crypto.randomUUID();
}

export async function fetchWithAuth(
  url: string,
  token: string | undefined,
  init: RequestInit = {},
  uniqueId?: string,
): Promise<Response> {
  const headers = { ...getAuthHeaders(uniqueId || generateUniqueId(), token), ...(init.headers as Record<string, string>) };
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    let detail = res.statusText;
    let bodyRaw = "";
    try {
      bodyRaw = await res.clone().text();
      const body = JSON.parse(bodyRaw) as { errors?: Array<{ message?: string }> };
      detail = body.errors?.[0]?.message ?? res.statusText;
    } catch {
      /* body bukan JSON */
    }
    console.error(`[fetchWithAuth] URL: ${url} | HTTP ${res.status} | BODY: ${bodyRaw}`);
    throw new HttpError(`HTTP ${res.status}: ${detail}`, res.status);
  }
  return res;
}
