import { describe, it, expect } from "vitest";
import { formatRupiah, formatDateTime } from "../src/format.js";

describe("format", () => {
  it("formatRupiah adds Rp and thousands separators", () => {
    expect(formatRupiah(50000)).toBe("Rp 50.000");
    expect(formatRupiah(0)).toBe("Rp 0");
  });

  it("formatDateTime formats ISO to DD MMM YYYY - HH:mm:ss", () => {
    const iso = "2026-07-07T10:30:00+07:00";
    const out = formatDateTime(iso, "Asia/Jakarta");
    expect(out).toMatch(/^\d{2} \w{3} \d{4} - \d{2}:\d{2}:\d{2}$/);
  });

  it("formatDateTime returns empty string for falsy input", () => {
    expect(formatDateTime("", "Asia/Jakarta")).toBe("");
  });
});
