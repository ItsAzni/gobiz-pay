import { EventEmitter } from "node:events";
import { GoPayMerchant } from "./client.js";
import { GoBizError } from "./errors.js";
import type { GoBizOptions, HistoryEntry, PaymentEvent } from "./types.js";

export class GoPayWatcher extends EventEmitter {
  private readonly _merchant: GoPayMerchant;
  private readonly _interval: number;
  private _timer: NodeJS.Timeout | null = null;
  private _seenIds = new Set<string>();
  private _seeded = false;
  private _listeners = 0;
  private _polling = false;
  private _startTime: number;

  constructor(merchant: GoPayMerchant, intervalMs = 7_000) {
    super();
    this._merchant = merchant;
    this._interval = intervalMs;
    this._startTime = Date.now() - 10000;
  }

  private _startPoller(): void {
    if (this._timer) return;
    void this._poll();
    this._timer = setInterval(() => void this._poll(), this._interval);
  }

  private _stopPoller(): void {
    if (!this._timer) return;
    clearInterval(this._timer);
    this._timer = null;
  }

  async poll(): Promise<void> {
    return this._poll();
  }

  private async _poll(): Promise<void> {
    if (this._polling) return;
    this._polling = true;

    try {
      const result = await this._merchant.getHistory({ days: 1, size: 20 });
      if (!result.status || !result.data?.histories) return;

      for (const entry of result.data.histories) {
        const raw = entry.raw || {};
        const txId =
          (raw.transaction_id as string) ??
          (raw.id as string) ??
          (raw.order_id as string) ??
          `${entry.time}_${entry.amount?.displayed_text}`;

        if (!txId || this._seenIds.has(txId)) continue;
        this._seenIds.add(txId);

        const txTimeStr = (raw.transaction_time as string) || (raw.settlement_time as string);
        const isNewPayment = txTimeStr ? new Date(txTimeStr).getTime() >= this._startTime : false;

        if (!this._seeded && !isNewPayment) continue;

        const rawAmount = raw.gross_amount;
        const amount = typeof rawAmount === "number" ? rawAmount / 100 : parseFloat(String(rawAmount ?? 0));
        this.emit("payment", { amount, txId, entry } satisfies PaymentEvent);
      }

      if (!this._seeded) {
        this._seeded = true;
      }

      if (this._seenIds.size > 500) {
        const arr = [...this._seenIds];
        this._seenIds = new Set(arr.slice(arr.length - 500));
      }
    } catch (e) {
      if (e instanceof GoBizError) {
        console.error(`[GoPayWatcher] Polling error: ${e.message}`);
        this.emit("error", e);
      }
    } finally {
      this._polling = false;
    }
  }

  waitForPayment(
    amount: number,
    opts: { timeout?: number; tolerance?: number } = {},
  ): Promise<PaymentEvent> {
    const { timeout = 5 * 60_000, tolerance = 0 } = opts;
    return new Promise<PaymentEvent>((resolve, reject) => {
      this._listeners++;
      this._startPoller();

      const onPayment = (data: PaymentEvent) => {
        if (Math.abs(data.amount - amount) <= tolerance) {
          cleanup();
          resolve(data);
        }
      };

      const cleanup = () => {
        clearTimeout(timeoutHandle);
        this.off("payment", onPayment);
        this._listeners = Math.max(0, this._listeners - 1);
        if (this._listeners === 0) this._stopPoller();
      };

      const timeoutHandle = setTimeout(() => {
        cleanup();
        reject(new GoBizError(`Timeout waiting for payment of Rp ${amount}`));
      }, timeout);

      this.on("payment", onPayment);
    });
  }

  public reset(): void {
    this._seenIds.clear();
    this._seeded = false;
    this._startTime = Date.now() - 10000;
  }
}

let sharedWatcher: GoPayWatcher | null = null;
export function getGoPayWatcher(options?: GoBizOptions, intervalMs = 7_000): GoPayWatcher {
  if (!sharedWatcher) {
    const m = new GoPayMerchant(options);
    sharedWatcher = new GoPayWatcher(m, intervalMs);
  }
  return sharedWatcher;
}