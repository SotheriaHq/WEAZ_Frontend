import type {
  PaystackInlineCallbacks,
  PaystackPopupTransaction,
} from '@paystack/inline-js';

type PaystackInlineInstance = {
  resumeTransaction: (
    accessCode: string,
    callbacks?: PaystackInlineCallbacks,
  ) => PaystackPopupTransaction;
  cancelTransaction: (target: string | number | PaystackPopupTransaction) => void;
};

let paystackInstancePromise: Promise<PaystackInlineInstance> | null = null;
let activeTransaction: string | number | PaystackPopupTransaction | null = null;

const loadPaystackInstance = async (): Promise<PaystackInlineInstance> => {
  if (!paystackInstancePromise) {
    paystackInstancePromise = import('@paystack/inline-js').then((module) => {
      const PaystackPop = module.default;
      return new PaystackPop();
    });
  }

  try {
    return await paystackInstancePromise;
  } catch (err) {
    // Reset so the next call retries the dynamic import instead of
    // immediately re-throwing the same rejected promise forever.
    paystackInstancePromise = null;
    throw err;
  }
};

const clearActiveTransaction = () => {
  activeTransaction = null;
};

export const openPaystackInline = async (
  accessCode: string,
  callbacks: PaystackInlineCallbacks = {},
) => {
  const instance = await loadPaystackInstance();

  if (activeTransaction) {
    try {
      instance.cancelTransaction(activeTransaction);
    } catch {
      clearActiveTransaction();
    }
  }

  let transaction: PaystackPopupTransaction;
  transaction = instance.resumeTransaction(accessCode, {
    onLoad: (response) => {
      activeTransaction = transaction?.id ?? response.id;
      callbacks.onLoad?.(response);
    },
    onSuccess: (response) => {
      clearActiveTransaction();
      callbacks.onSuccess?.(response);
    },
    onCancel: () => {
      clearActiveTransaction();
      callbacks.onCancel?.();
    },
    onError: (error) => {
      clearActiveTransaction();
      callbacks.onError?.(error);
    },
  });

  activeTransaction = transaction?.id ?? transaction;
  return transaction;
};

export const cancelActivePaystackInline = async () => {
  if (!activeTransaction) {
    return;
  }

  const instance = await loadPaystackInstance();

  try {
    instance.cancelTransaction(activeTransaction);
  } finally {
    clearActiveTransaction();
  }
};
