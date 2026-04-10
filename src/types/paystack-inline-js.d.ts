declare module '@paystack/inline-js' {
  export interface PaystackInlineError {
    message: string;
  }

  export interface PaystackInlineLoadResponse {
    id: number;
    customer: Record<string, unknown>;
    accessCode: string;
  }

  export interface PaystackInlineSuccessResponse {
    id: number;
    reference: string;
    message: string;
  }

  export interface PaystackInlineCallbacks {
    onSuccess?: (response: PaystackInlineSuccessResponse) => void;
    onCancel?: () => void;
    onLoad?: (response: PaystackInlineLoadResponse) => void;
    onError?: (error: PaystackInlineError) => void;
  }

  export interface PaystackPopupTransaction {
    id?: string | number;
    getStatus?: () => unknown;
  }

  export default class PaystackPop {
    constructor();
    resumeTransaction(
      accessCode: string,
      callbacks?: PaystackInlineCallbacks,
    ): PaystackPopupTransaction;
    cancelTransaction(target: string | number | PaystackPopupTransaction): void;
  }
}
