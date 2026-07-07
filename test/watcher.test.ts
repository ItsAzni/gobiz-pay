import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { GoPayWatcher, getGoPayWatcher } from "../src/watcher.js";
import type { HistoryEntry, PaymentEvent } from "../src/types.js";

function makeEntry(amount: number, id: string): HistoryEntry {
  return {
    type: "payin",
    amount: { displayed_text: `Rp ${amount}` },
    time: "",
    raw: { gross_amount: amount * 100, transaction_id: id },
  };
}

describe("GoPayWatcher", () => {
  let merchant: { getHistory: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    merchant = { getHistory: vi.fn() };
  });
  afterEach(() => vi.useRealTimers());

  it("seed does not emit an event, then a new transaction emits payment", async () => {
    merchant.getHistory
      .mockResolvedValueOnce({ status: true, data: { histories: [makeEntry(50000, "A")] } })
      .mockResolvedValueOnce({ status: true, data: { histories: [makeEntry(50000, "A"), makeEntry(50000, "B")] } });

    const w = new GoPayWatcher(merchant as any, 1000);
    const events: PaymentEvent[] = [];
    w.on("payment", (e) => events.push(e));

    await (w as any).poll(); // seed
    await (w as any).poll(); // detect B

    expect(events).toHaveLength(1);
    expect(events[0]!.txId).toBe("B");
    expect(events[0]!.amount).toBe(50000);
  });

  it("waitForPayment resolves when amount matches", async () => {
    merchant.getHistory
      .mockResolvedValueOnce({ status: true, data: { histories: [] } })
      .mockResolvedValueOnce({ status: true, data: { histories: [makeEntry(50000, "X")] } });
    const w = new GoPayWatcher(merchant as any, 50);
    const p = w.waitForPayment(50000, { timeout: 2000, tolerance: 0 });
    await (w as any).poll(); // seed
    await (w as any).poll(); // detect
    const res = await p;
    expect(res.amount).toBe(50000);
  });

  it("waitForPayment rejects on timeout", async () => {
    merchant.getHistory.mockResolvedValue({ status: true, data: { histories: [] } });
    const w = new GoPayWatcher(merchant as any, 50);
    await expect(w.waitForPayment(50000, { timeout: 200 })).rejects.toThrow(/Timeout/);
  });

  it("getGoPayWatcher returns a singleton", () => {
    const a = getGoPayWatcher();
    const b = getGoPayWatcher();
    expect(a).toBe(b);
  });
});
