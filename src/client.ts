import { ConfigError, HttpError } from "./errors.js";
import { BASE_URL, ANALYTICS_URL, JOURNAL_URL, fetchWithAuth } from "./http.js";
import { loginWithPassword, getUserMerchants, requestLoginOtp, requestPhoneOtp, loginWithOtp } from "./auth.js";
import { loadEnv, readCache, writeCache, defaultCachePath } from "./config.js";
import { formatRupiah, formatDateTime } from "./format.js";
import type {
  GoBizOptions,
  HistoryQuery,
  HistoryResult,
  HistoryEntry,
  AnalyticsResponse,
  JournalResponse,
} from "./types.js";

export class GoPayMerchant {
  public token: string | null;
  public merchantId: string | null;
  private _initialized = false;
  private readonly cachePath: string;
  private readonly timezone: string;
  private _otpToken: string | undefined;
  private _uniqueId: string;

  constructor(options: GoBizOptions = {}) {
    this.token = options.token ?? null;
    this.merchantId = options.merchantId ?? null;
    this.cachePath = options.cachePath ?? defaultCachePath();
    this.timezone = options.timezone ?? "Asia/Jakarta";

    const cache = readCache(this.cachePath);
    this._uniqueId = cache.unique_id ?? crypto.randomUUID();
  }

  async init(): Promise<void> {
    if (this._initialized) return;

    const cache = readCache(this.cachePath);
    if (!this.token && cache.gopay_token) {
      this.token = cache.gopay_token;
    }

    if (!this.token) {
      await this.login();
    }

    if (!this.merchantId && cache.gopay_merchant_id) {
      this.merchantId = cache.gopay_merchant_id;
    }

    const envMerchantId = loadEnv().GOPAY_MERCHANT_ID || process.env.GOPAY_MERCHANT_ID;
    if (!this.merchantId && envMerchantId) {
      this.merchantId = envMerchantId;
      const updated = readCache(this.cachePath);
      updated.gopay_merchant_id = this.merchantId;
      writeCache(updated, this.cachePath);
    }

    if (!this.merchantId) {
      const merchants = await getUserMerchants(this.token!, this._uniqueId);
      this.merchantId = merchants[0]!.id;
      const updated = readCache(this.cachePath);
      updated.gopay_merchant_id = this.merchantId;
      writeCache(updated, this.cachePath);
    }

    this._initialized = true;
  }

  private async login(): Promise<void> {
    const env = loadEnv();
    const email = env.GOPAY_EMAIL ?? process.env.GOPAY_EMAIL;
    if (!email) throw new ConfigError("[GoPayMerchant] GOPAY_EMAIL not found in env.");
    const password = env.GOPAY_PASSWORD ?? process.env.GOPAY_PASSWORD;
    if (!password) throw new ConfigError("[GoPayMerchant] GOPAY_PASSWORD not found in env.");
    const auth = await loginWithPassword(email, password, this._uniqueId);
    this.token = auth.access_token;
    const cache = readCache(this.cachePath);
    cache.gopay_token = this.token;
    cache.unique_id = this._uniqueId;
    writeCache(cache, this.cachePath);
  }

  async loginWithOtp(otp: string): Promise<void> {
    if (!this._otpToken) throw new ConfigError("[GoPayMerchant] Call requestLoginOtp() before loginWithOtp().");
    const auth = await loginWithOtp(otp, this._otpToken, this._uniqueId);
    this.token = auth.access_token;
    this._otpToken = undefined;
    const cache = readCache(this.cachePath);
    cache.gopay_token = this.token;
    cache.unique_id = this._uniqueId;
    writeCache(cache, this.cachePath);
    this._initialized = false;
  }

  async requestPhoneOtp(phoneNumber: string, countryCode = "62"): Promise<void> {
    this._otpToken = await requestPhoneOtp(phoneNumber, countryCode, this._uniqueId);
  }

  async loginWithPhone(otp: string): Promise<void> {
    if (!this._otpToken) throw new ConfigError("[GoPayMerchant] Call requestPhoneOtp() before loginWithPhone().");
    const auth = await loginWithOtp(otp, this._otpToken, this._uniqueId);
    this.token = auth.access_token;
    this._otpToken = undefined;
    const cache = readCache(this.cachePath);
    cache.gopay_token = this.token;
    cache.unique_id = this._uniqueId;
    writeCache(cache, this.cachePath);
    this._initialized = false;
  }

  async requestLoginOtp(): Promise<void> {
    const env = loadEnv();
    const email = env.GOPAY_EMAIL ?? process.env.GOPAY_EMAIL;
    if (!email) throw new ConfigError("[GoPayMerchant] GOPAY_EMAIL not found in env for requestLoginOtp.");
    this._otpToken = await requestLoginOtp(email, this._uniqueId);
  }

  async getTransactionsAnalytics(opts: HistoryQuery = {}): Promise<AnalyticsResponse> {
    await this.init();
    const { days = 1, size = 50 } = opts;
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - days * 86_400_000);
    const url = new URL(ANALYTICS_URL);
    url.searchParams.set("from", "0");
    url.searchParams.set("size", String(size));
    url.searchParams.set("statuses", "SETTLEMENT,CAPTURE,REFUND,PARTIAL_REFUND");
    url.searchParams.set("payment_types", "QRIS,GOPAY,OFFLINE_CREDIT_CARD,OFFLINE_DEBIT_CARD,CREDIT_CARD");
    url.searchParams.set("start_time", startTime.toISOString());
    url.searchParams.set("end_time", endTime.toISOString());
    url.searchParams.set("merchant_ids", this.merchantId!);

    try {
      const res = await fetchWithAuth(url.toString(), this.token ?? undefined, { method: "GET" }, this._uniqueId);
      return (await res.json()) as AnalyticsResponse;
    } catch (e) {
      if (is401(e)) {
        this._initialized = false;
        this.token = null;
        await this.init();
        const res = await fetchWithAuth(url.toString(), this.token ?? undefined, { method: "GET" }, this._uniqueId);
        return (await res.json()) as AnalyticsResponse;
      }
      throw e;
    }
  }

  async getTransactionsJournal(opts: HistoryQuery = {}): Promise<JournalResponse> {
    await this.init();
    const { days = 1, size = 50 } = opts;
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - days * 86_400_000);
    const body = {
      from: 0,
      size,
      sort: { time: { order: "desc" } },
      included_categories: { incoming: ["transaction_share", "action"] },
      query: [
        {
          op: "and",
          clauses: [
            { op: "not", clauses: [{ op: "or", clauses: [
              { field: "metadata.source", op: "in", value: ["GOSAVE_ONLINE", "GoSave", "GODEALS_ONLINE"] },
              { field: "metadata.gopay.source", op: "in", value: ["GOSAVE_ONLINE", "GoSave", "GODEALS_ONLINE"] },
            ] }] },
            { field: "metadata.transaction.status", op: "in", value: ["settlement", "capture", "refund", "partial_refund"] },
            { field: "metadata.transaction.payment_type", op: "in", value: ["qris", "gopay", "offline_credit_card", "offline_debit_card", "credit_card"] },
            { field: "metadata.transaction.transaction_time", op: "gte", value: startTime.toISOString() },
            { field: "metadata.transaction.transaction_time", op: "lte", value: endTime.toISOString() },
            { field: "metadata.transaction.merchant_id", op: "equal", value: this.merchantId },
          ],
        },
      ],
    };

    try {
      const res = await fetchWithAuth(JOURNAL_URL, this.token ?? undefined, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, this._uniqueId);
      return (await res.json()) as JournalResponse;
    } catch (e) {
      if (is401(e)) {
        this._initialized = false;
        this.token = null;
        await this.init();
        const res = await fetchWithAuth(JOURNAL_URL, this.token ?? undefined, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }, this._uniqueId);
        return (await res.json()) as JournalResponse;
      }
      throw e;
    }
  }

  async getHistory(opts: HistoryQuery = {}): Promise<HistoryResult> {
    await this.init();
    const data = await this.getTransactionsAnalytics(opts);
    if (data && Array.isArray(data.transactions) && data.transactions.length > 0) {
      return { status: true, data: { histories: data.transactions.map((tx) => this.toEntry(tx)) } };
    }
    const journal = await this.getTransactionsJournal(opts);
    if (journal && Array.isArray(journal.data) && journal.data.length > 0) {
      const histories = journal.data
        .map((item) => item.metadata?.transaction)
        .filter((tx): tx is Record<string, unknown> => Boolean(tx))
        .map((tx) => this.toEntry(tx));
      if (histories.length > 0) {
        return { status: true, data: { histories } };
      }
    }
    return { status: false, message: "No transaction data found." };
  }

  private toEntry(tx: Record<string, unknown>): HistoryEntry {
    const rawAmount = typeof tx.gross_amount === "number" ? tx.gross_amount / 100 : 0;
    return {
      type: "payin",
      amount: { displayed_text: formatRupiah(rawAmount) },
      time: formatDateTime(tx.transaction_time as string | undefined, this.timezone),
      raw: tx,
    };
  }
}

function is401(e: unknown): e is HttpError {
  return e instanceof HttpError && e.status === 401;
}
