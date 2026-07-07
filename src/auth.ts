import { AuthError, HttpError } from "./errors.js";
import { BASE_URL, fetchWithAuth, getAuthHeaders } from "./http.js";
import type { AuthResult, Merchant } from "./types.js";

const CLIENT_ID = "go-biz-web-new";

export async function loginWithPassword(email: string, password: string, uniqueId: string): Promise<AuthResult> {
  const headers = { "Content-Type": "application/json", ...getAuthHeaders(uniqueId, undefined) };

  const reqRes = await fetch(`${BASE_URL}/goid/login/request`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, login_type: "password", client_id: CLIENT_ID }),
  });
  const reqData = (await reqRes.json()) as { errors?: Array<{ message?: string }> };
  if (reqData.errors?.length) {
    throw new AuthError(`Email validation failed: ${reqData.errors[0]?.message}`);
  }

  const tokenRes = await fetch(`${BASE_URL}/goid/token`, {
    method: "POST",
    headers,
    body: JSON.stringify({ client_id: CLIENT_ID, grant_type: "password", data: { email, password } }),
  });
  const tokenData = (await tokenRes.json()) as AuthResult & { errors?: Array<{ message?: string }> };
  if (tokenData.access_token) {
    return { access_token: tokenData.access_token, refresh_token: tokenData.refresh_token, expires_in: tokenData.expires_in };
  }
  if (tokenData.errors?.length) {
    throw new AuthError(`Login failed: ${tokenData.errors[0]?.message ?? "Incorrect password or account issue"}`);
  }

  return { access_token: tokenData.access_token, refresh_token: tokenData.refresh_token, expires_in: tokenData.expires_in };
}

async function requestOtpToken(body: Record<string, unknown>, uniqueId: string): Promise<string> {
  const headers = { "Content-Type": "application/json", ...getAuthHeaders(uniqueId, undefined) };
  const res = await fetch(`${BASE_URL}/goid/login/request`, {
    method: "POST",
    headers,
    body: JSON.stringify({ client_id: CLIENT_ID, ...body }),
  });
  const data = (await res.json()) as { data?: { otp_token?: string }; errors?: Array<{ message?: string }> };
  if (data.errors?.length) {
    throw new AuthError(`OTP request failed: ${data.errors[0]?.message}`);
  }
  const otpToken = data.data?.otp_token;
  if (!otpToken) {
    throw new AuthError("OTP request failed: no otp_token returned by the server.");
  }
  return otpToken;
}

export async function requestLoginOtp(email: string, uniqueId: string): Promise<string> {
  return requestOtpToken({ email }, uniqueId);
}

export async function requestPhoneOtp(phoneNumber: string, countryCode = "62", uniqueId: string): Promise<string> {
  return requestOtpToken({ phone_number: phoneNumber, country_code: countryCode }, uniqueId);
}

export async function loginWithOtp(otp: string, otpToken: string, uniqueId: string): Promise<AuthResult> {
  const headers = { "Content-Type": "application/json", ...getAuthHeaders(uniqueId, undefined) };
  const res = await fetch(`${BASE_URL}/goid/token`, {
    method: "POST",
    headers,
    body: JSON.stringify({ client_id: CLIENT_ID, grant_type: "otp", data: { otp, otp_token: otpToken } }),
  });
  const data = (await res.json()) as AuthResult & { errors?: Array<{ message?: string }> };
  if (data.access_token) {
    return { access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in };
  }
  if (data.errors?.length) {
    throw new AuthError(`OTP login failed: ${data.errors[0]?.message ?? "Invalid or expired OTP"}`);
  }
  throw new AuthError(`OTP login failed: unexpected response (HTTP ${res.status}).`);
}

export async function getUserMerchants(token: string, uniqueId?: string): Promise<Merchant[]> {
  const res = await fetch(`${BASE_URL}/v1/users/me`, {
    method: "GET",
    headers: { ...getAuthHeaders(uniqueId || crypto.randomUUID(), token), "Content-Type": "application/json" },
  });
  if (!res.ok) {
    let bodyRaw = "";
    try { bodyRaw = await res.clone().text(); } catch {}
    console.error(`[getUserMerchants] URL: /v1/users/me | HTTP ${res.status} | BODY: ${bodyRaw}`);
    throw new HttpError(`HTTP ${res.status}: ${res.statusText}`, res.status);
  }
  const data = (await res.json()) as { user?: { merchant_id?: string; full_name?: string } };
  const mId = data.user?.merchant_id;
  if (!mId) {
    throw new AuthError("Failed to fetch user merchant_id.");
  }
  return [{ id: mId, merchant_name: data.user?.full_name ?? "My Merchant" }];
}

export async function isTokenValid(token: string): Promise<boolean> {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/v1/merchants/search`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: 0, to: 1, _source: ["id"] }),
    });
    return res.status !== 401;
  } catch {
    return false;
  }
}
