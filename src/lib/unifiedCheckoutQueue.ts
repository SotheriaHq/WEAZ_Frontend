export type UnifiedCheckoutPaymentMethod = 'PAYSTACK' | 'FLUTTERWAVE' | 'BANK_TRANSFER';

export interface UnifiedCheckoutQueuedLine {
  checkoutIntentId: string;
  sessionId: string;
  sourceTitle: string;
}

export interface UnifiedCheckoutSummary {
  items: Array<{ name: string; quantity: number; price: number }>;
  subtotal: number;
  shippingCost: number;
  discount: number;
  grandTotal: number;
  shippingName: string;
  shippingCity: string;
  shippingState: string;
}

export interface UnifiedCheckoutQueueState {
  paymentMethod: UnifiedCheckoutPaymentMethod;
  email: string;
  paymentData: Record<string, unknown>;
  lines: UnifiedCheckoutQueuedLine[];
  summary?: UnifiedCheckoutSummary;
}

const STORAGE_KEY = 'threadly.unifiedCheckout.queue.v1';

const hasSessionStorage = () => {
  try {
    return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
  } catch {
    return false;
  }
};

const parseQueue = (raw: string | null): UnifiedCheckoutQueueState | null => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<UnifiedCheckoutQueueState>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.lines)) return null;
    if (typeof parsed.email !== 'string' || !parsed.email.trim()) return null;
    if (typeof parsed.paymentMethod !== 'string') return null;

    return {
      paymentMethod: parsed.paymentMethod as UnifiedCheckoutPaymentMethod,
      email: parsed.email,
      paymentData:
        parsed.paymentData && typeof parsed.paymentData === 'object'
          ? parsed.paymentData
          : {},
      lines: parsed.lines
        .map((line) => ({
          checkoutIntentId: String(line?.checkoutIntentId ?? ''),
          sessionId: String(line?.sessionId ?? ''),
          sourceTitle: String(line?.sourceTitle ?? ''),
        }))
        .filter((line) => line.checkoutIntentId.length > 0),
      summary:
        parsed.summary && typeof parsed.summary === 'object'
          ? (parsed.summary as UnifiedCheckoutSummary)
          : undefined,
    };
  } catch {
    return null;
  }
};

export const unifiedCheckoutQueue = {
  load(): UnifiedCheckoutQueueState | null {
    if (!hasSessionStorage()) return null;
    return parseQueue(window.sessionStorage.getItem(STORAGE_KEY));
  },

  save(state: UnifiedCheckoutQueueState) {
    if (!hasSessionStorage()) return;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },

  clear() {
    if (!hasSessionStorage()) return;
    window.sessionStorage.removeItem(STORAGE_KEY);
  },

  shiftNextLine(): UnifiedCheckoutQueuedLine | null {
    const current = this.load();
    if (!current || current.lines.length === 0) return null;

    const [next, ...rest] = current.lines;
    this.save({
      ...current,
      lines: rest,
    });
    return next;
  },
};
