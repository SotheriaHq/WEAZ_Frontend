export type UnifiedCheckoutPaymentMethod = 'PAYSTACK' | 'FLUTTERWAVE' | 'BANK_TRANSFER';

export interface UnifiedCheckoutQueuedLine {
  checkoutIntentId: string;
  sessionId: string;
  sourceTitle: string;
  price: number;
  validationSessionId?: string;
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

interface UnifiedCheckoutStandardLane {
  attempted: boolean;
  paid: boolean;
  failed: boolean;
  items: Array<{ name: string; quantity: number; price: number }>;
  subtotal: number;
  shippingCost: number;
  discount: number;
}

export interface UnifiedCheckoutQueueState {
  paymentMethod: UnifiedCheckoutPaymentMethod;
  email: string;
  paymentData: Record<string, unknown>;
  lines: UnifiedCheckoutQueuedLine[];
  currentLine?: UnifiedCheckoutQueuedLine | null;
  successfulCustomLines?: UnifiedCheckoutQueuedLine[];
  failedCustomLines?: UnifiedCheckoutQueuedLine[];
  standardLane?: UnifiedCheckoutStandardLane;
  shippingName?: string;
  shippingCity?: string;
  shippingState?: string;
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

    const normalizeLine = (
      line: Partial<UnifiedCheckoutQueuedLine> | null | undefined,
    ): UnifiedCheckoutQueuedLine | null => {
      const checkoutIntentId = String(line?.checkoutIntentId ?? '');
      if (!checkoutIntentId) return null;
      const validationSessionId = String(line?.validationSessionId ?? '').trim();

      return {
        checkoutIntentId,
        sessionId: String(line?.sessionId ?? ''),
        sourceTitle: String(line?.sourceTitle ?? ''),
        price: Number.isFinite(Number(line?.price)) ? Number(line?.price) : 0,
        ...(validationSessionId ? { validationSessionId } : {}),
      };
    };

    const normalizedLines = parsed.lines
      .map((line) => normalizeLine(line))
      .filter((line): line is UnifiedCheckoutQueuedLine => Boolean(line));

    const normalizedCurrentLine =
      parsed.currentLine && typeof parsed.currentLine === 'object'
        ? normalizeLine(parsed.currentLine)
        : null;

    const normalizedSuccessfulCustomLines = Array.isArray(parsed.successfulCustomLines)
      ? parsed.successfulCustomLines
          .map((line) => normalizeLine(line))
          .filter((line): line is UnifiedCheckoutQueuedLine => Boolean(line))
      : [];

    const normalizedFailedCustomLines = Array.isArray(parsed.failedCustomLines)
      ? parsed.failedCustomLines
          .map((line) => normalizeLine(line))
          .filter((line): line is UnifiedCheckoutQueuedLine => Boolean(line))
      : [];

    const parsedStandardLane =
      parsed.standardLane && typeof parsed.standardLane === 'object'
        ? (parsed.standardLane as Partial<UnifiedCheckoutStandardLane>)
        : null;

    const standardLane: UnifiedCheckoutStandardLane | undefined = parsedStandardLane
      ? {
          attempted: Boolean(parsedStandardLane.attempted),
          paid: Boolean(parsedStandardLane.paid),
          failed: Boolean(parsedStandardLane.failed),
          items: Array.isArray(parsedStandardLane.items)
            ? parsedStandardLane.items
                .map((item) => ({
                  name: String(item?.name ?? ''),
                  quantity: Number.isFinite(Number(item?.quantity))
                    ? Number(item?.quantity)
                    : 0,
                  price: Number.isFinite(Number(item?.price)) ? Number(item?.price) : 0,
                }))
                .filter((item) => item.name.length > 0 && item.quantity > 0)
            : [],
          subtotal: Number.isFinite(Number(parsedStandardLane.subtotal))
            ? Number(parsedStandardLane.subtotal)
            : 0,
          shippingCost: Number.isFinite(Number(parsedStandardLane.shippingCost))
            ? Number(parsedStandardLane.shippingCost)
            : 0,
          discount: Number.isFinite(Number(parsedStandardLane.discount))
            ? Number(parsedStandardLane.discount)
            : 0,
        }
      : undefined;

    return {
      paymentMethod: parsed.paymentMethod as UnifiedCheckoutPaymentMethod,
      email: parsed.email,
      paymentData:
        parsed.paymentData && typeof parsed.paymentData === 'object'
          ? parsed.paymentData
          : {},
      lines: normalizedLines,
      currentLine: normalizedCurrentLine,
      successfulCustomLines: normalizedSuccessfulCustomLines,
      failedCustomLines: normalizedFailedCustomLines,
      standardLane,
      shippingName: String(parsed.shippingName ?? parsed.summary?.shippingName ?? ''),
      shippingCity: String(parsed.shippingCity ?? parsed.summary?.shippingCity ?? ''),
      shippingState: String(parsed.shippingState ?? parsed.summary?.shippingState ?? ''),
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

  startNextCustomLine(): UnifiedCheckoutQueuedLine | null {
    const current = this.load();
    if (!current || current.lines.length === 0) return null;
    if (current.currentLine) return null;

    const [next, ...rest] = current.lines;
    this.save({
      ...current,
      lines: rest,
      currentLine: next,
    });
    return next;
  },

  markCurrentCustomResult(success: boolean) {
    const current = this.load();
    if (!current || !current.currentLine) return;

    const line = current.currentLine;
    this.save({
      ...current,
      currentLine: null,
      successfulCustomLines: success
        ? [...(current.successfulCustomLines ?? []), line]
        : current.successfulCustomLines ?? [],
      failedCustomLines: !success
        ? [...(current.failedCustomLines ?? []), line]
        : current.failedCustomLines ?? [],
    });
  },

  markStandardLaneResult(status: string) {
    const current = this.load();
    if (!current) return;

    const base = current.standardLane ?? {
      attempted: true,
      paid: false,
      failed: false,
      items: [],
      subtotal: 0,
      shippingCost: 0,
      discount: 0,
    };

    const normalized = String(status ?? '').trim().toUpperCase();
    const paid = normalized === 'PAID';
    const failed = normalized === 'FAILED' || normalized === 'CANCELLED' || normalized === 'EXPIRED';

    this.save({
      ...current,
      standardLane: {
        ...base,
        attempted: true,
        paid: base.paid || paid,
        failed: base.failed || failed,
      },
    });
  },

  consumeConfirmationSummary(): UnifiedCheckoutSummary | undefined {
    const current = this.load();
    if (!current) return undefined;

    const items: Array<{ name: string; quantity: number; price: number }> = [];
    let subtotal = 0;
    let shippingCost = 0;
    let discount = 0;

    const standardLane = current.standardLane;
    if (standardLane?.paid) {
      items.push(...standardLane.items);
      subtotal += standardLane.subtotal;
      shippingCost += standardLane.shippingCost;
      discount += standardLane.discount;
    }

    for (const line of current.successfulCustomLines ?? []) {
      items.push({
        name: `${line.sourceTitle} (Custom)`,
        quantity: 1,
        price: Number.isFinite(Number(line.price)) ? Number(line.price) : 0,
      });
      subtotal += Number.isFinite(Number(line.price)) ? Number(line.price) : 0;
    }

    const computedSummary: UnifiedCheckoutSummary | undefined =
      items.length > 0
        ? {
            items,
            subtotal,
            shippingCost,
            discount,
            grandTotal: Math.max(0, subtotal + shippingCost - discount),
            shippingName: current.shippingName || current.summary?.shippingName || '',
            shippingCity: current.shippingCity || current.summary?.shippingCity || '',
            shippingState: current.shippingState || current.summary?.shippingState || '',
          }
        : current.summary;

    this.clear();
    return computedSummary;
  },
};
