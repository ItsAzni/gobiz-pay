import { describe, it, expect } from "vitest";
import { convertCRC16, buildDynamicQris } from "../src/qris.js";

describe("qris", () => {
  it("convertCRC16 menghasilkan 4 hex uppercase", () => {
    const crc = convertCRC16("000201010211");
    expect(crc).toMatch(/^[0-9A-F]{4}$/);
  });

  it("buildDynamicQris menyisipkan nominal dan CRC valid", () => {
    const staticQris = "0002010102115802ID5901X6304";
    const out = buildDynamicQris(staticQris, 50000);
    // field 54 = nominal (tag 54, 2-digit length, value 50000)
    expect(out).toMatch(/5405\/?50000/);
    expect(out).toContain("50000");
    // CRC field 6304 di akhir, 4 hex
    expect(out.slice(-8)).toMatch(/6304[0-9A-F]{4}$/);
    // verifikasi CRC cocok
    const payload = out.slice(0, -4);
    expect(convertCRC16(payload)).toBe(out.slice(-4));
  });

  it("buildDynamicQris throws QrisError for invalid format", () => {
    expect(() => buildDynamicQris("bukanqris", 1000)).toThrow(/Invalid QRIS format/);
  });
});
