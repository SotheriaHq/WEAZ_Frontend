import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { brandApi } from '@/api/BrandApi';
import { customOrdersBrandApi, type CustomOrderDetail } from '@/api/CustomOrderApi';
import { getStoreStatus } from '@/api/StoreApi';
import VLoader from '@/components/loaders/VLoader';
import Modal from '@/components/ui/Modal';
import type { RootState } from '@/store';

const STATUS_THEME: Record<string, string> = {
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200',
  APPROVED: 'bg-sky-100 text-sky-800 dark:bg-sky-500/10 dark:text-sky-200',
  PROCESSING: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200',
  PAID: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200',
  FAILED: 'bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200',
  REJECTED: 'bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200',
  ON_HOLD: 'bg-orange-100 text-orange-800 dark:bg-orange-500/10 dark:text-orange-200',
  RECONCILIATION_REVIEW:
    'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/10 dark:text-fuchsia-200',
};

const STATUS_EMOJI: Record<string, string> = {
  PENDING_APPROVAL: '⏳',
  APPROVED: '🧾',
  PROCESSING: '🏦',
  PAID: '✅',
  FAILED: '⚠️',
  REJECTED: '⛔',
  ON_HOLD: '🧊',
  RECONCILIATION_REVIEW: '🧮',
};

const INCOMING_STAGE_THEME: Record<string, string> = {
  SHIPPED_RELEASE: 'bg-sky-100 text-sky-800 dark:bg-sky-500/10 dark:text-sky-200',
  DELIVERED_RELEASE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200',
  ACCEPTED_RELEASE: 'bg-violet-100 text-violet-800 dark:bg-violet-500/10 dark:text-violet-200',
  RELEASE: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200',
  PAYMENT: 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200',
};

const INCOMING_STAGE_EMOJI: Record<string, string> = {
  SHIPPED_RELEASE: '🚚',
  DELIVERED_RELEASE: '✅',
  ACCEPTED_RELEASE: '🤝',
  RELEASE: '💸',
  PAYMENT: '💳',
};

type FinanceOverview = {
  currency: string;
  availableBalance: number;
  releasedBalance: number;
  reservedPayoutBalance: number;
  paidOutBalance: number;
  incomingCredits: number;
  totalOrders: number;
  activeEscrowHolds?: number;
  queuedCustomAllocations?: number;
  negativeBalance: boolean;
};

type IncomingTransaction = {
  id: string;
  amount: number | string;
  grossAmount?: number | string;
  commissionAmount?: number | string;
  netAmount?: number | string;
  currency: string;
  createdAt: string;
  title?: string | null;
  counterparty?: string | null;
  description?: string | null;
  stage?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
};

type HeldFundsItem = {
  id: string;
  holdType: string;
  referenceId?: string | null;
  title: string;
  counterparty?: string | null;
  currency: string;
  grossAmount: number | string;
  commissionAmount?: number | string;
  netBrandAmount?: number | string;
  releasedGrossAmount?: number | string;
  releasedNetAmount: number | string;
  heldGrossAmount?: number | string;
  heldNetAmount: number | string;
  status: string;
  nextReleaseAt?: string | null;
  releaseCondition?: string | null;
  frozenReason?: string | null;
};

type FinanceReceiptRow = {
  label: string;
  value: string;
  tone?: string;
  emphasized?: boolean;
};

const formatReferenceLabel = (referenceType?: string | null) => {
  const normalized = String(referenceType || 'ORDER').trim();
  if (!normalized) return 'Standard order';
  if (normalized.toUpperCase() === 'CUSTOMORDER') return 'Custom order';
  if (normalized.toUpperCase() === 'ORDER') return 'Standard order';
  return normalized.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').trim();
};

const getReferenceTone = (referenceType?: string | null) => {
  const normalized = String(referenceType || '').trim().toUpperCase();
  if (normalized === 'CUSTOMORDER') {
    return 'bg-violet-100 text-violet-800 dark:bg-violet-500/10 dark:text-violet-200';
  }
  if (normalized === 'ORDER') {
    return 'bg-sky-100 text-sky-800 dark:bg-sky-500/10 dark:text-sky-200';
  }
  return 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-200';
};

const formatReferenceCode = (referenceId?: string | null) =>
  referenceId ? `#${String(referenceId).slice(0, 8).toUpperCase()}` : null;

const normalizeHoldType = (value?: string | null) => String(value || '').trim().toUpperCase();

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const formatHoldTypeLabel = (value?: string | null) => {
  const normalized = normalizeHoldType(value);
  if (normalized === 'CUSTOM_ORDER') return 'Custom order';
  if (normalized === 'STANDARD_ORDER') return 'Standard order';
  return normalized.replaceAll('_', ' ').trim() || 'Order hold';
};

const formatIncomingStageLabel = (stage?: string | null) =>
  String(stage || 'PAYMENT')
    .trim()
    .toUpperCase()
    .replaceAll('_', ' ');

const buildSellerReceiptStates = (transaction: IncomingTransaction) => {
  const stage = String(transaction.stage || 'PAYMENT').trim().toUpperCase();
  const releaseLabel = formatIncomingStageLabel(stage);

  return [
    {
      label: 'Buyer payment captured',
      detail: 'The buyer completed payment for this order.',
      complete: true,
    },
    {
      label: 'Escrow recorded',
      detail: 'WEAZ recorded the funds and prepared them for the release workflow.',
      complete: true,
    },
    {
      label: releaseLabel,
      detail:
        stage === 'PAYMENT'
          ? 'This credit was posted directly from the payment event.'
          : `This credit was released when the ${releaseLabel.toLowerCase()} milestone was reached.`,
      complete: true,
    },
    {
      label: 'Brand wallet credited',
      detail: 'This amount is now reflected in your brand finance ledger.',
      complete: true,
    },
  ];
};

const FinancePage: React.FC = () => {
  const user = useSelector((state: RootState) => state.user.profile);
  const requestRef = useRef(0);
  const mountedRef = useRef(true);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [incomingTransactions, setIncomingTransactions] = useState<IncomingTransaction[]>([]);
  const [heldFunds, setHeldFunds] = useState<HeldFundsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<IncomingTransaction | null>(null);
  const [selectedHeldFund, setSelectedHeldFund] = useState<HeldFundsItem | null>(null);
  const [selectedHeldStandardOrder, setSelectedHeldStandardOrder] = useState<any | null>(null);
  const [selectedHeldCustomOrder, setSelectedHeldCustomOrder] = useState<CustomOrderDetail | null>(null);
  const [heldDetailLoading, setHeldDetailLoading] = useState(false);
  const [heldDetailError, setHeldDetailError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    try {
      const storeStatus = await getStoreStatus();
      if (!mountedRef.current || requestRef.current !== requestId) return;
      setBrandId(storeStatus.brandId);

      const [overviewData, payoutsData, incomingData, heldFundsData] = await Promise.all([
        brandApi.getPayoutOverview(storeStatus.brandId),
        brandApi.getPayouts(storeStatus.brandId),
        brandApi.getIncomingTransactions(storeStatus.brandId, { page: 1, limit: 20 }),
        brandApi.getHeldFunds(storeStatus.brandId, { page: 1, limit: 20 }),
      ]);
      if (!mountedRef.current || requestRef.current !== requestId) return;

      setOverview(
        overviewData
          ? {
              currency: overviewData.currency || 'NGN',
              availableBalance: Number(overviewData.availableBalance || 0),
              releasedBalance: Number(overviewData.releasedBalance || 0),
              reservedPayoutBalance: Number(overviewData.reservedPayoutBalance || 0),
              paidOutBalance: Number(overviewData.paidOutBalance || 0),
              incomingCredits: Number(overviewData.incomingCredits || 0),
              totalOrders: Number(overviewData.totalOrders || 0),
              activeEscrowHolds: Number(overviewData.activeEscrowHolds || 0),
              queuedCustomAllocations: Number(overviewData.queuedCustomAllocations || 0),
              negativeBalance: Boolean(overviewData.negativeBalance),
            }
          : null,
      );

      setPayouts(
        Array.isArray(payoutsData?.items)
          ? payoutsData.items
          : Array.isArray(payoutsData)
            ? payoutsData
            : [],
      );

      setIncomingTransactions(
        Array.isArray(incomingData?.items)
          ? incomingData.items
          : Array.isArray(incomingData)
            ? incomingData
            : [],
      );

      setHeldFunds(
        Array.isArray(heldFundsData?.items)
          ? heldFundsData.items
          : Array.isArray(heldFundsData)
            ? heldFundsData
            : [],
      );
    } catch (error) {
      if (!mountedRef.current || requestRef.current !== requestId) return;
      console.error('Failed to fetch finance data', error);
      toast.error('Failed to load finance data');
    } finally {
      if (mountedRef.current && requestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    mountedRef.current = true;
    void fetchData();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchData]);

  const availableBalance = overview?.availableBalance ?? 0;
  const currency = overview?.currency || 'NGN';
  const totalIncomingAmount = useMemo(
    () => incomingTransactions.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [incomingTransactions],
  );
  const customOrderIncomingCount = useMemo(
    () =>
      incomingTransactions.filter(
        (item) => String(item.referenceType || '').trim().toUpperCase() === 'CUSTOMORDER',
      ).length,
    [incomingTransactions],
  );

  const acceptedReleaseByCustomOrderId = useMemo(() => {
    const map = new Map<
      string,
      { gross: number; commission: number; net: number; currency: string }
    >();

    for (const transaction of incomingTransactions) {
      const referenceType = String(transaction.referenceType || '').trim().toUpperCase();
      const stage = String(transaction.stage || '').trim().toUpperCase();
      const referenceId = String(transaction.referenceId || '').trim();

      if (referenceType !== 'CUSTOMORDER' || stage !== 'ACCEPTED_RELEASE' || !referenceId) {
        continue;
      }

      const current = map.get(referenceId) ?? {
        gross: 0,
        commission: 0,
        net: 0,
        currency: transaction.currency || currency,
      };

      current.gross += Number(transaction.grossAmount ?? transaction.amount ?? 0);
      current.commission += Number(transaction.commissionAmount ?? 0);
      current.net += Number(transaction.netAmount ?? transaction.amount ?? 0);
      if (transaction.currency) {
        current.currency = transaction.currency;
      }

      map.set(referenceId, current);
    }

    return map;
  }, [currency, incomingTransactions]);

  const displayHeldFunds = useMemo(() => {
    return heldFunds.map((hold) => {
      const holdType = normalizeHoldType(hold.holdType);
      if (holdType !== 'CUSTOM_ORDER') {
        return hold;
      }

      const currentReleasedNet = Number(hold.releasedNetAmount || 0);
      if (currentReleasedNet > 0) {
        return hold;
      }

      const referenceId = String(hold.referenceId || '').trim();
      if (!referenceId) {
        return hold;
      }

      const acceptedRelease = acceptedReleaseByCustomOrderId.get(referenceId);
      if (!acceptedRelease) {
        return hold;
      }

      const heldGrossAmount = Number(hold.heldGrossAmount ?? hold.grossAmount ?? 0);
      const heldNetAmount = Number(hold.heldNetAmount || 0);
      const heldCommissionAmount = Number(hold.commissionAmount || 0);

      const releasedGrossAmount = roundMoney(acceptedRelease.gross);
      const releasedNetAmount = roundMoney(acceptedRelease.net);
      const grossAmount = roundMoney(heldGrossAmount + releasedGrossAmount);
      const commissionAmount = roundMoney(heldCommissionAmount + acceptedRelease.commission);
      const netBrandAmount = roundMoney(heldNetAmount + releasedNetAmount);

      return {
        ...hold,
        currency: hold.currency || acceptedRelease.currency,
        grossAmount,
        commissionAmount,
        netBrandAmount,
        heldGrossAmount: roundMoney(heldGrossAmount),
        releasedGrossAmount,
        releasedNetAmount,
      };
    });
  }, [acceptedReleaseByCustomOrderId, heldFunds]);

  const formatCurrency = useCallback(
    (value: number, activeCurrency = currency) =>
      new Intl.NumberFormat('en-NG', { style: 'currency', currency: activeCurrency }).format(value),
    [currency],
  );

  const heldBreakdown = useMemo(() => {
    if (!selectedHeldFund) return null;

    const holdType = normalizeHoldType(selectedHeldFund.holdType);
    const holdGross = Number(selectedHeldFund.grossAmount || 0);
    const releasedGross = Number(selectedHeldFund.releasedGrossAmount ?? 0);
    const heldGross = Number(
      selectedHeldFund.heldGrossAmount ?? Math.max(holdGross - releasedGross, 0),
    );
    const releasedNet = Number(selectedHeldFund.releasedNetAmount || 0);
    const heldNet = Number(selectedHeldFund.heldNetAmount || 0);
    const netBrandTotal = Number(selectedHeldFund.netBrandAmount ?? releasedNet + heldNet);
    const commissionTotal = Number(
      selectedHeldFund.commissionAmount ?? Math.max(holdGross - netBrandTotal, 0),
    );
    const buyerPaidTotal =
      holdType === 'CUSTOM_ORDER'
        ? Number(selectedHeldCustomOrder?.buyerPriceSummary?.grandTotal ?? holdGross)
        : Number(
            selectedHeldStandardOrder?.financeBreakdown?.grossAmount ??
              selectedHeldStandardOrder?.totalAmount ??
              holdGross,
          );

    return {
      holdType,
      holdGross,
      releasedGross,
      heldGross,
      releasedNet,
      heldNet,
      commissionTotal,
      netBrandTotal,
      buyerPaidTotal,
    };
  }, [selectedHeldCustomOrder, selectedHeldFund, selectedHeldStandardOrder]);

  const heldOrderFinanceRows = useMemo<FinanceReceiptRow[]>(() => {
    if (!heldBreakdown || !selectedHeldFund) return [];

    const activeCurrency = selectedHeldFund.currency || currency;

    if (heldBreakdown.holdType === 'CUSTOM_ORDER') {
      const summary = selectedHeldCustomOrder?.buyerPriceSummary;
      const subtotal = Number(
        summary?.subtotal ??
          Math.max(
            heldBreakdown.buyerPaidTotal -
              Number(summary?.shippingFee ?? 0) -
              Number(summary?.rushFee ?? 0),
            0,
          ),
      );

      const rows: FinanceReceiptRow[] = [
        {
          label: 'Item subtotal',
          value: formatCurrency(subtotal, summary?.currency || activeCurrency),
        },
        {
          label: 'Delivery fee',
          value: formatCurrency(
            Number(summary?.shippingFee ?? 0),
            summary?.currency || activeCurrency,
          ),
        },
      ];

      if (summary?.rushFee != null) {
        rows.push({
          label: 'Rush fee',
          value: formatCurrency(
            Number(summary.rushFee || 0),
            summary.currency || activeCurrency,
          ),
        });
      }

      rows.push({
        label: 'Buyer paid total',
        value: formatCurrency(heldBreakdown.buyerPaidTotal, summary?.currency || activeCurrency),
        emphasized: true,
      });

      return rows;
    }

    const financeBreakdown = selectedHeldStandardOrder?.financeBreakdown;
    return [
      {
        label: 'Item subtotal',
        value: formatCurrency(
          Number(financeBreakdown?.itemSubtotal ?? 0),
          activeCurrency,
        ),
      },
      {
        label: 'Delivery fee',
        value: formatCurrency(
          Number(financeBreakdown?.shippingAmount ?? selectedHeldStandardOrder?.shippingCost ?? 0),
          activeCurrency,
        ),
      },
      {
        label: 'Discount',
        value: formatCurrency(
          Number(financeBreakdown?.discountAmount ?? selectedHeldStandardOrder?.discountAmount ?? 0),
          activeCurrency,
        ),
      },
      {
        label: 'Buyer paid total',
        value: formatCurrency(heldBreakdown.buyerPaidTotal, activeCurrency),
        emphasized: true,
      },
    ];
  }, [
    currency,
    formatCurrency,
    heldBreakdown,
    selectedHeldCustomOrder?.buyerPriceSummary,
    selectedHeldFund,
    selectedHeldStandardOrder,
  ]);

  const heldEscrowAllocationRows = useMemo<FinanceReceiptRow[]>(() => {
    if (!heldBreakdown || !selectedHeldFund) return [];
    const activeCurrency = selectedHeldFund.currency || currency;

    return [
      {
        label: 'Gross tracked in escrow',
        value: formatCurrency(heldBreakdown.holdGross, activeCurrency),
      },
      {
        label: 'Platform commission',
        value: formatCurrency(heldBreakdown.commissionTotal, activeCurrency),
        tone: 'text-rose-600 dark:text-rose-300',
      },
      {
        label: 'Brand net total',
        value: formatCurrency(heldBreakdown.netBrandTotal, activeCurrency),
        tone: 'text-emerald-600 dark:text-emerald-300',
      },
      {
        label: 'Released to brand',
        value: formatCurrency(heldBreakdown.releasedNet, activeCurrency),
        tone: 'text-sky-600 dark:text-sky-300',
      },
      {
        label: 'Still held for brand',
        value: formatCurrency(heldBreakdown.heldNet, activeCurrency),
        tone: 'text-amber-700 dark:text-amber-300',
        emphasized: true,
      },
    ];
  }, [currency, formatCurrency, heldBreakdown, selectedHeldFund]);

  const heldCustomReleaseRows = useMemo<FinanceReceiptRow[]>(() => {
    if (!heldBreakdown || heldBreakdown.holdType !== 'CUSTOM_ORDER' || !selectedHeldFund) {
      return [];
    }

    const activeCurrency =
      selectedHeldCustomOrder?.buyerPriceSummary.currency ||
      selectedHeldFund.currency ||
      currency;

    return [
      {
        label: 'Released gross tranche',
        value: formatCurrency(heldBreakdown.releasedGross, activeCurrency),
      },
      {
        label: 'Held gross tranche',
        value: formatCurrency(heldBreakdown.heldGross, activeCurrency),
      },
    ];
  }, [currency, formatCurrency, heldBreakdown, selectedHeldCustomOrder, selectedHeldFund]);

  const canRequestPayout = useMemo(
    () => !loading && !requesting && availableBalance >= 5000,
    [availableBalance, loading, requesting],
  );

  const handleRequestPayout = async () => {
    if (!brandId) return;
    if (availableBalance < 5000) {
      toast.error('Minimum payout amount is ₦5,000');
      return;
    }

    setRequesting(true);
    try {
      await brandApi.requestPayout(brandId, availableBalance);
      toast.success('Payout requested successfully');
      void fetchData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to request payout');
    } finally {
      setRequesting(false);
    }
  };

  const openHeldFundDetail = useCallback(
    async (hold: HeldFundsItem) => {
      setSelectedHeldFund(hold);
      setSelectedHeldStandardOrder(null);
      setSelectedHeldCustomOrder(null);
      setHeldDetailError(null);

      if (!brandId || !hold.referenceId) {
        setHeldDetailLoading(false);
        return;
      }

      setHeldDetailLoading(true);
      try {
        const holdType = normalizeHoldType(hold.holdType);
        if (holdType === 'CUSTOM_ORDER') {
          const detail = await customOrdersBrandApi.getById(brandId, hold.referenceId);
          setSelectedHeldCustomOrder(detail);
        } else if (holdType === 'STANDARD_ORDER') {
          const detail = await brandApi.getOrderDetail(brandId, hold.referenceId);
          setSelectedHeldStandardOrder(detail);
        }
      } catch (error: any) {
        setHeldDetailError(error?.response?.data?.message || 'Unable to load this hold breakdown right now.');
      } finally {
        setHeldDetailLoading(false);
      }
    },
    [brandId],
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Released balances, incoming credits, and payout history.
          </p>
        </div>
      </div>

      {/* Balance hero + metric strip */}
      <div className="overflow-hidden rounded-2xl border border-black/10 bg-slate-950 text-white shadow-sm dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">
                Available balance
              </div>
              <div className="mt-1 text-2xl font-bold tracking-tight">
                {loading ? '—' : formatCurrency(availableBalance)}
              </div>
              {overview?.negativeBalance ? (
                <div className="mt-1 text-xs text-rose-300">
                  Negative — new releases will offset recovery automatically.
                </div>
              ) : null}
            </div>
            <div className="text-2xl" aria-hidden="true">
              {overview?.negativeBalance ? '📉' : '💰'}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRequestPayout}
              disabled={!canRequestPayout}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-white"
            >
              {requesting ? 'Submitting...' : 'Request payout'}
            </button>
            <div className="text-xs text-slate-400">Min. ₦5,000</div>
          </div>
        </div>

        {/* Metric strip */}
        <div className="grid grid-cols-2 border-t border-white/10 sm:grid-cols-4">
          {[
            { label: 'Released', value: overview?.releasedBalance ?? 0, note: 'Unlocked by milestones' },
            { label: 'Reserved', value: overview?.reservedPayoutBalance ?? 0, note: 'In payout flow' },
            { label: 'Paid out', value: overview?.paidOutBalance ?? 0, note: 'Settled to bank' },
            {
              label: 'Incoming',
              value: overview?.incomingCredits ?? totalIncomingAmount,
              note: `${overview?.totalOrders ?? 0} paid order${(overview?.totalOrders ?? 0) === 1 ? '' : 's'}`,
            },
          ].map((metric, index) => (
            <div
              key={metric.label}
              className={`px-5 py-3 ${index < 3 ? 'border-b border-white/10 sm:border-b-0 sm:border-r' : ''}`}
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                {metric.label}
              </div>
              <div className="mt-1 text-base font-bold">
                {loading ? '—' : formatCurrency(metric.value)}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">{metric.note}</div>
            </div>
          ))}
        </div>
      </div>

      <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
        <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Held Funds</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Escrowed funds that are still waiting on delivery confirmation, release milestones, or admin action.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
              <span aria-hidden="true">🔒</span>
              {overview?.activeEscrowHolds ?? displayHeldFunds.length} open hold{(overview?.activeEscrowHolds ?? displayHeldFunds.length) === 1 ? '' : 's'}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
              <tr>
                <th className="px-6 py-4 font-medium">Reference</th>
                <th className="px-6 py-4 font-medium">Buyer</th>
                <th className="px-6 py-4 font-medium">Gross</th>
                <th className="px-6 py-4 font-medium">Commission</th>
                <th className="px-6 py-4 font-medium">Released</th>
                <th className="px-6 py-4 font-medium">Still held</th>
                <th className="px-6 py-4 font-medium">Release rule</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <VLoader size={32} phase="loading" showLabel={false} />
                  </td>
                </tr>
              ) : displayHeldFunds.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No held funds right now.
                  </td>
                </tr>
              ) : (
                displayHeldFunds.map((hold) => (
                  <tr
                    key={hold.id}
                    tabIndex={0}
                    role="button"
                    onClick={() => {
                      void openHeldFundDetail(hold);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void openHeldFundDetail(hold);
                      }
                    }}
                    className="cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-400/30 dark:hover:bg-gray-800/40"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 dark:text-white">{hold.title}</div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {formatHoldTypeLabel(hold.holdType)} {hold.referenceId ? `• ${formatReferenceCode(hold.referenceId)}` : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{hold.counterparty || 'Buyer'}</td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {formatCurrency(Number(hold.grossAmount || 0), hold.currency || currency)}
                    </td>
                    <td className="px-6 py-4 font-medium text-rose-600 dark:text-rose-300">
                      {formatCurrency(Number(hold.commissionAmount || 0), hold.currency || currency)}
                    </td>
                    <td className="px-6 py-4 font-medium text-sky-600 dark:text-sky-300">
                      {formatCurrency(Number(hold.releasedNetAmount || 0), hold.currency || currency)}
                    </td>
                    <td className="px-6 py-4 font-medium text-amber-700 dark:text-amber-300">
                      {formatCurrency(Number(hold.heldNetAmount || 0), hold.currency || currency)}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                      <div>{String(hold.releaseCondition || 'MANUAL').replaceAll('_', ' ')}</div>
                      <div className="mt-1 text-xs">
                        {hold.nextReleaseAt ? `Next: ${new Date(hold.nextReleaseAt).toLocaleString()}` : 'Awaiting completion milestone'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                          hold.status === 'FROZEN'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200'
                            : hold.status === 'PARTIALLY_RELEASED'
                              ? 'bg-sky-100 text-sky-800 dark:bg-sky-500/10 dark:text-sky-200'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
                        }`}
                      >
                        <span aria-hidden="true">
                          {hold.status === 'FROZEN' ? '🧊' : hold.status === 'PARTIALLY_RELEASED' ? '✂️' : '🔒'}
                        </span>
                        {String(hold.status || 'HELD').replaceAll('_', ' ')}
                      </span>
                      {hold.frozenReason ? (
                        <div className="mt-1 text-xs text-rose-600 dark:text-rose-300">{hold.frozenReason}</div>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
        <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Incoming Transactions</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Credits released into your brand wallet after shipment, delivery, or custom-order milestones.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:bg-violet-500/10 dark:text-violet-200">
              <span aria-hidden="true">✂️</span>
              {customOrderIncomingCount} custom-order credit{customOrderIncomingCount === 1 ? '' : 's'}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[620px] text-left text-sm sm:min-w-[700px] lg:min-w-[760px]">
            <thead className="bg-gray-50 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
              <tr>
                <th className="px-6 py-4 font-medium">Transaction</th>
                <th className="px-6 py-4 font-medium">Counterparty</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Gross</th>
                <th className="px-6 py-4 font-medium">Commission</th>
                <th className="px-6 py-4 font-medium">Net</th>
                <th className="px-6 py-4 font-medium">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <VLoader size={32} phase="loading" showLabel={false} />
                  </td>
                </tr>
              ) : incomingTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No incoming transactions recorded yet.
                  </td>
                </tr>
              ) : (
                incomingTransactions.map((transaction) => {
                  const stage = String(transaction.stage || 'RELEASE').toUpperCase();
                  return (
                    <tr
                      key={transaction.id}
                      tabIndex={0}
                      role="button"
                      onClick={() => setSelectedTransaction(transaction)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedTransaction(transaction);
                        }
                      }}
                      className="cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/30 dark:hover:bg-gray-800/40"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {transaction.title || transaction.description || 'Incoming transaction'}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${getReferenceTone(
                              transaction.referenceType,
                            )}`}
                          >
                            {formatReferenceLabel(transaction.referenceType)}
                          </span>
                          {formatReferenceCode(transaction.referenceId) ? (
                            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                              {formatReferenceCode(transaction.referenceId)}
                            </span>
                          ) : null}
                        </div>
                        {transaction.description && transaction.description !== transaction.title ? (
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {transaction.description}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                        {transaction.counterparty || 'Buyer'}
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                        {new Date(transaction.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                        {formatCurrency(
                          Number(transaction.grossAmount ?? transaction.amount ?? 0),
                          transaction.currency || currency,
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium text-rose-600 dark:text-rose-300">
                        {formatCurrency(
                          Number(transaction.commissionAmount ?? 0),
                          transaction.currency || currency,
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium text-emerald-600 dark:text-emerald-300">
                        +{formatCurrency(
                          Number(transaction.netAmount ?? transaction.amount ?? 0),
                          transaction.currency || currency,
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                            INCOMING_STAGE_THEME[stage] ||
                            'bg-slate-100 text-slate-800 dark:bg-slate-500/10 dark:text-slate-200'
                          }`}
                        >
                          <span aria-hidden="true">{INCOMING_STAGE_EMOJI[stage] || '💸'}</span>
                          {stage.replaceAll('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
        <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800">
          <h2 className="text-lg font-semibold">Payout History</h2>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[560px] text-left text-sm sm:min-w-[620px] lg:min-w-[680px]">
            <thead className="bg-gray-50 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
              <tr>
                <th className="px-6 py-4 font-medium">Reference</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Amount</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <VLoader size={32} phase="loading" showLabel={false} />
                  </td>
                </tr>
              ) : payouts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No payout history found.
                  </td>
                </tr>
              ) : (
                payouts.map((payout) => (
                  <tr key={payout.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {payout.reference || `#${String(payout.id).slice(0, 8)}`}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                      {new Date(payout.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {formatCurrency(Number(payout.amount || 0))}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                          STATUS_THEME[payout.status] ||
                          'bg-slate-100 text-slate-800 dark:bg-slate-500/10 dark:text-slate-200'
                        }`}
                      >
                        <span aria-hidden="true">{STATUS_EMOJI[payout.status] || '📄'}</span>
                        {String(payout.status || 'UNKNOWN').replaceAll('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={Boolean(selectedHeldFund)}
        onClose={() => {
          setSelectedHeldFund(null);
          setSelectedHeldStandardOrder(null);
          setSelectedHeldCustomOrder(null);
          setHeldDetailError(null);
          setHeldDetailLoading(false);
        }}
        title="Order finance breakdown"
        size="lg"
      >
        {selectedHeldFund ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                      {formatHoldTypeLabel(selectedHeldFund.holdType)}
                    </span>
                    {formatReferenceCode(selectedHeldFund.referenceId) ? (
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                        {formatReferenceCode(selectedHeldFund.referenceId)}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">{selectedHeldFund.title}</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {selectedHeldFund.counterparty || 'Buyer'}
                    {selectedHeldFund.nextReleaseAt
                      ? ` • Next release ${new Date(selectedHeldFund.nextReleaseAt).toLocaleString()}`
                      : ' • Waiting for milestone completion'}
                  </p>
                </div>

                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                    selectedHeldFund.status === 'FROZEN'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200'
                      : selectedHeldFund.status === 'PARTIALLY_RELEASED'
                        ? 'bg-sky-100 text-sky-800 dark:bg-sky-500/10 dark:text-sky-200'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
                  }`}
                >
                  {String(selectedHeldFund.status || 'HELD').replaceAll('_', ' ')}
                </span>
              </div>
            </div>

            {heldDetailLoading ? (
              <div className="rounded-2xl border border-gray-200/80 bg-gray-50/80 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex items-center justify-center py-10">
                  <VLoader size={34} phase="loading" showLabel={false} />
                </div>
              </div>
            ) : null}

            {heldDetailError ? (
              <div className="rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                {heldDetailError}
              </div>
            ) : null}

            {heldBreakdown && !heldDetailLoading ? (
              <>
                <FinanceReceiptList
                  title="Order receipt"
                  subtitle="Presented as a checkout-style list so the customer-facing amount path is obvious at a glance."
                  rows={heldOrderFinanceRows}
                />
                <FinanceReceiptList
                  title="Escrow allocation"
                  subtitle="This shows how the captured order value is split between WEAZ commission, brand release, and the remaining held amount."
                  rows={heldEscrowAllocationRows}
                  footerNote="Gross tracked in escrow = platform commission + released net + still held net."
                />
              </>
            ) : null}

            {heldBreakdown?.holdType === 'CUSTOM_ORDER' && !heldDetailLoading ? (
              <section className="rounded-2xl border border-gray-200/80 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  Release split
                </h4>
                <div className="mt-3 rounded-xl border border-violet-200/80 bg-violet-50/80 px-3 py-3 text-sm text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200">
                  This split uses recorded ledger allocations: acceptance tranche released to the brand and final tranche still held in escrow.
                </div>
                <div className="mt-4">
                  <FinanceReceiptList rows={heldCustomReleaseRows} compact />
                </div>
              </section>
            ) : null}

            {heldBreakdown?.holdType === 'STANDARD_ORDER' && !heldDetailLoading ? (
              <section className="rounded-2xl border border-gray-200/80 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  Standard-order release schedule
                </h4>
                {(selectedHeldStandardOrder?.financeBreakdown?.releaseSchedule ?? []).length === 0 ? (
                  <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    No release schedule was returned for this order.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {(selectedHeldStandardOrder?.financeBreakdown?.releaseSchedule ?? []).map((item: any, index: number) => (
                      <div key={`${item?.stage || 'stage'}-${index}`} className="rounded-xl border border-gray-200/80 px-3 py-3 dark:border-white/10">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {String(item?.stage || 'RELEASE').replaceAll('_', ' ')}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {item?.releasedAt
                              ? `Released ${new Date(item.releasedAt).toLocaleString()}`
                              : item?.eligibleAt
                                ? `Eligible ${new Date(item.eligibleAt).toLocaleString()}`
                                : 'Awaiting milestone'}
                          </div>
                        </div>
                        <div className="mt-2 grid gap-2 text-xs text-gray-600 dark:text-gray-300 sm:grid-cols-3">
                          <div>
                            Gross: {formatCurrency(Number(item?.grossAmount || 0), selectedHeldFund.currency || currency)}
                          </div>
                          <div>
                            Commission: {formatCurrency(Number(item?.commissionAmount || 0), selectedHeldFund.currency || currency)}
                          </div>
                          <div>
                            Net: {formatCurrency(Number(item?.netAmount || 0), selectedHeldFund.currency || currency)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(selectedTransaction)}
        onClose={() => setSelectedTransaction(null)}
        title="Seller receipt status"
        size="lg"
      >
        {selectedTransaction ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${getReferenceTone(
                        selectedTransaction.referenceType,
                      )}`}
                    >
                      {formatReferenceLabel(selectedTransaction.referenceType)}
                    </span>
                    {formatReferenceCode(selectedTransaction.referenceId) ? (
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                        {formatReferenceCode(selectedTransaction.referenceId)}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">
                    {selectedTransaction.title || selectedTransaction.description || 'Incoming transaction'}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {selectedTransaction.counterparty || 'Buyer'} •{' '}
                    {new Date(selectedTransaction.createdAt).toLocaleString()}
                  </p>
                </div>

                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                    INCOMING_STAGE_THEME[String(selectedTransaction.stage || 'RELEASE').toUpperCase()] ||
                    'bg-slate-100 text-slate-800 dark:bg-slate-500/10 dark:text-slate-200'
                  }`}
                >
                  {formatIncomingStageLabel(selectedTransaction.stage)}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <FinanceReceiptMetric
                  label="Gross"
                  value={formatCurrency(
                    Number(selectedTransaction.grossAmount ?? selectedTransaction.amount ?? 0),
                    selectedTransaction.currency || currency,
                  )}
                />
                <FinanceReceiptMetric
                  label="Commission"
                  value={formatCurrency(
                    Number(selectedTransaction.commissionAmount ?? 0),
                    selectedTransaction.currency || currency,
                  )}
                />
                <FinanceReceiptMetric
                  label="Net credited"
                  value={`+${formatCurrency(
                    Number(selectedTransaction.netAmount ?? selectedTransaction.amount ?? 0),
                    selectedTransaction.currency || currency,
                  )}`}
                  tone="text-emerald-600 dark:text-emerald-300"
                />
              </div>
            </div>

            <section className="rounded-2xl border border-gray-200/80 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
              <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                Receipt Flow
              </h4>
              <div className="mt-4 space-y-3">
                {buildSellerReceiptStates(selectedTransaction).map((item, index) => (
                  <div
                    key={item.label}
                    className="flex items-start gap-3 rounded-2xl border border-gray-200/70 bg-gray-50/80 px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {item.label}
                      </div>
                      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {item.detail}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

const FinanceReceiptMetric: React.FC<{
  label: string;
  value: string;
  tone?: string;
}> = ({ label, value, tone = 'text-gray-900 dark:text-white' }) => (
  <div className="rounded-2xl border border-gray-200/80 bg-gray-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
      {label}
    </div>
    <div className={`mt-1 text-lg font-bold ${tone}`}>{value}</div>
  </div>
);

const FinanceReceiptList: React.FC<{
  title?: string;
  subtitle?: string;
  rows: FinanceReceiptRow[];
  footerNote?: string;
  compact?: boolean;
}> = ({ title, subtitle, rows, footerNote, compact = false }) => {
  if (!rows.length) return null;

  return (
    <section
      className={`rounded-2xl border border-gray-200/80 bg-white/80 ${
        compact ? 'p-4' : 'p-5'
      } dark:border-white/10 dark:bg-white/[0.03]`}
    >
      {title ? (
        <div className="mb-4">
          <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
            {title}
          </h4>
          {subtitle ? (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200/70 bg-gray-50/80 px-4 dark:border-white/10 dark:bg-black/10">
        {rows.map((row, index) => (
          <div
            key={`${row.label}-${index}`}
            className={`flex items-center justify-between gap-4 py-3 ${
              index === rows.length - 1 ? '' : 'border-b border-dashed border-gray-200 dark:border-white/10'
            }`}
          >
            <span
              className={`text-sm ${
                row.emphasized
                  ? 'font-semibold text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              {row.label}
            </span>
            <span className={`text-right text-sm font-semibold ${row.tone || 'text-gray-900 dark:text-white'}`}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {footerNote ? (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{footerNote}</p>
      ) : null}
    </section>
  );
};

export default FinancePage;
