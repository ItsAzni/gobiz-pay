import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { GoPayMerchant } from "../src/client.js";
import { readCache, writeCache, defaultCachePath } from "../src/config.js";

describe("GoPayMerchant", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    writeCache({}, defaultCachePath());
  });

  it("init logs in when no token or cache is present", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/goid/login/request")) {
        return new Response(JSON.stringify({}), { status: 200 });
      }
      if (url.includes("/goid/token")) {
        return new Response(
          JSON.stringify({ access_token: "AT", refresh_token: "RT", expires_in: 3600 }),
          { status: 200 },
        );
      }
      if (url.includes("/v1/users/me")) {
        return new Response(JSON.stringify({ user: { merchant_id: "M-1", full_name: "Toko A" } }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });

    const m = new GoPayMerchant();
    process.env.GOPAY_EMAIL = "a@b.com";
    process.env.GOPAY_PASSWORD = "secret";
    await m.init();
    expect(m.merchantId).toBe("M-1");
  });

  it("getHistory returns status false when no data", async () => {
    const m = new GoPayMerchant({ token: "T", merchantId: "M-1" });
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("merchant-analytics")) {
        return new Response(JSON.stringify({ transactions: [] }), { status: 200 });
      }
      if (url.includes("/journals/search")) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });
    const res = await m.getHistory({ days: 1, size: 10 });
    expect(res.status).toBe(false);
  });

  it("getHistory throws HttpError on 500", async () => {
    const m = new GoPayMerchant({ token: "T", merchantId: "M-1" });
    fetchMock.mockResolvedValue(new Response("err", { status: 500, statusText: "Server Error" }));
    await expect(m.getHistory()).rejects.toThrow(/HTTP 500/);
  });

  it("loginWithOtp accepts token even when status is 401 (GoBiz quirk)", async () => {
    const m = new GoPayMerchant();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/goid/login/request")) {
        return new Response(JSON.stringify({ data: { otp_token: "TKN" } }), { status: 200 });
      }
      if (url.includes("/goid/token")) {
        // GoBiz returns the token in the body with a non-2xx status on success
        return new Response(
          JSON.stringify({ access_token: "OT", refresh_token: "RT", dbl_enabled: true }),
          { status: 401 },
        );
      }
      return new Response("{}", { status: 200 });
    });
    await m.requestLoginOtp();
    await m.loginWithOtp("123456");
    expect(m.token).toBe("OT");
  });
});

