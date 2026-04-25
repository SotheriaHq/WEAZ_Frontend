export interface PayoutSourceBreakdownItem {
  id: string;
  sourceType: 'STANDARD_ORDER' | 'CUSTOM_ORDER' | string;
  label: string;
  counterparty: string | null;
  referenceId: string | null;
  referenceCode: string | null;
  releaseStage: string | null;
  reservedAmount: number;
  creditedAmount: number | null;
  grossAmount: number | null;
  commissionAmount: number | null;
  currency: string;
  sourceCreatedAt: string | null;
  linkedAt: string | null;
  note: string | null;
}

export interface PayoutSourceBreakdown {
  payoutAmount: number;
  attributedAmount: number;
  unattributedAmount: number;
  itemCount: number;
  standardOrderCount: number;
  customOrderCount: number;
  items: PayoutSourceBreakdownItem[];
}
