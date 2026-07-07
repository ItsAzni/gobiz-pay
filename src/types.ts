export interface GoBizOptions {
  token?: string;
  merchantId?: string;
  cachePath?: string;
  timezone?: string;
}

export interface AuthResult {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface Merchant {
  id: string;
  merchant_name: string;
}

export interface HistoryQuery {
  days?: number;
  size?: number;
}

export interface HistoryEntry {
  type: "payin";
  amount: { displayed_text: string };
  time: string;
  raw: Record<string, unknown>;
}

export interface HistoryResult {
  status: boolean;
  data?: { histories: HistoryEntry[] };
  message?: string;
}

// Response from /merchant-analytics/v2/merchants/transactions (partial)
export interface AnalyticsResponse {
  transactions?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

// Response from /journals/search (partial)
export interface JournalResponse {
  data?: Array<{ metadata?: { transaction?: Record<string, unknown> } }>;
  [key: string]: unknown;
}

export interface PaymentEvent {
  amount: number;
  txId: string;
  entry: HistoryEntry;
}
