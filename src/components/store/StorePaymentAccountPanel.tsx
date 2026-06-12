import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import UniversalSelect from '@/components/forms/UniversalSelect';
import type { RootState } from '@/store';
import {
  getStorePaymentAccount,
  listStorePaymentBanks,
  updateStorePaymentAccount,
  verifyStorePaymentAccount,
  type StorePaymentAccountResponse,
  type StorePaymentAccountSummary,
  type StorePaymentBankOption,
} from '@/api/StoreApi';
import MediaRenderer from '@/components/media/MediaRenderer';

interface StorePaymentAccountPanelProps {
  mode?: 'settings' | 'wizard';
  onStatusChange?: (account: StorePaymentAccountSummary | null) => void;
}

const STATUS_COPY: Record<string, { emoji: string; label: string; tone: string }> = {
  ACTIVE: {
    emoji: '✅',
    label: 'Ready for payouts',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200',
  },
  PENDING_SYNC: {
    emoji: '⏳',
    label: 'Sync in progress',
    tone: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200',
  },
  SYNC_ERROR: {
    emoji: '⚠️',
    label: 'Sync needs attention',
    tone: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200',
  },
  PENDING_SETUP: {
    emoji: '🧾',
    label: 'Payout account required',
    tone: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200',
  },
};

function getStatusMeta(status?: string | null) {
  return STATUS_COPY[String(status || 'PENDING_SETUP').toUpperCase()] ?? STATUS_COPY.PENDING_SETUP;
}

const panelClassName =
  'rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-[#1a1a1a]';

const metaCardClassName =
  'rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-white/10 dark:bg-black/20';

const inputClassName =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-black/40 dark:text-white';

const InlineSpinner: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span
    className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    aria-hidden="true"
  />
);

const BANK_MARK_EXCLUDED_TOKENS = new Set([
  'BANK',
  'MFB',
  'MICROFINANCE',
  'LIMITED',
  'LTD',
  'PLC',
  'NIGERIA',
]);

const BANK_LOGO_DOMAIN_RULES: Array<{ pattern: RegExp; domain: string }> = [
  { pattern: /zenith/i, domain: 'zenithbank.com' },
  { pattern: /guaranty trust|gtbank|\bgtb\b/i, domain: 'gtbank.com' },
  { pattern: /access/i, domain: 'accessbankplc.com' },
  { pattern: /united bank for africa|\buba\b/i, domain: 'ubagroup.com' },
  { pattern: /first bank|\bfbn\b/i, domain: 'firstbanknigeria.com' },
  { pattern: /fidelity/i, domain: 'fidelitybank.ng' },
  { pattern: /ecobank/i, domain: 'ecobank.com' },
  { pattern: /stanbic/i, domain: 'stanbicibtcbank.com' },
  { pattern: /union bank/i, domain: 'unionbankng.com' },
  { pattern: /wema/i, domain: 'wemabank.com' },
  { pattern: /fcmb|first city monument/i, domain: 'fcmb.com' },
  { pattern: /sterling/i, domain: 'sterling.ng' },
  { pattern: /polaris/i, domain: 'polarisbanklimited.com' },
  { pattern: /providus/i, domain: 'providusbank.com' },
  { pattern: /keystone/i, domain: 'keystonebankng.com' },
  { pattern: /jaiz/i, domain: 'jaizbankplc.com' },
  { pattern: /taaj/i, domain: 'taajbank.com' },
  { pattern: /lotus/i, domain: 'lotusbank.com' },
  { pattern: /kuda/i, domain: 'kuda.com' },
  { pattern: /opay/i, domain: 'opayweb.com' },
  { pattern: /palmpay/i, domain: 'palmpay.com' },
  { pattern: /moniepoint|teamapt/i, domain: 'moniepoint.com' },
];

const BANK_MARK_TONES: Array<{ bg: string; border: string; text: string }> = [
  {
    bg: 'bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-500/20 dark:to-green-500/20',
    border: 'border-emerald-300/40 dark:border-emerald-400/40',
    text: 'text-emerald-900 dark:text-emerald-100',
  },
  {
    bg: 'bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-500/20 dark:to-cyan-500/20',
    border: 'border-blue-300/40 dark:border-blue-400/40',
    text: 'text-blue-900 dark:text-blue-100',
  },
  {
    bg: 'bg-gradient-to-br from-amber-100 to-yellow-100 dark:from-amber-500/20 dark:to-yellow-500/20',
    border: 'border-amber-300/40 dark:border-amber-400/40',
    text: 'text-amber-900 dark:text-amber-100',
  },
  {
    bg: 'bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-500/20 dark:to-pink-500/20',
    border: 'border-rose-300/40 dark:border-rose-400/40',
    text: 'text-rose-900 dark:text-rose-100',
  },
  {
    bg: 'bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-500/20 dark:to-indigo-500/20',
    border: 'border-violet-300/40 dark:border-violet-400/40',
    text: 'text-violet-900 dark:text-violet-100',
  },
  {
    bg: 'bg-gradient-to-br from-slate-100 to-gray-100 dark:from-slate-500/20 dark:to-gray-500/20',
    border: 'border-slate-300/40 dark:border-slate-400/40',
    text: 'text-slate-900 dark:text-slate-100',
  },
];

function hashText(value: string): number {
  let hash = 0;
  for (const ch of value) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function resolveBankLogoUrl(bankName: string): string | null {
  const rule = BANK_LOGO_DOMAIN_RULES.find(({ pattern }) => pattern.test(bankName));
  if (!rule) return null;
  return `https://logo.clearbit.com/${rule.domain}?size=64`;
}

const BankOptionIcon: React.FC<{ bankName: string }> = ({ bankName }) => {
  const [logoFailed, setLogoFailed] = useState(false);
  const logoUrl = useMemo(() => resolveBankLogoUrl(bankName), [bankName]);
  const tone = useMemo(
    () => BANK_MARK_TONES[hashText(bankName) % BANK_MARK_TONES.length],
    [bankName],
  );

  if (logoUrl && !logoFailed) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-white dark:border-white/20 dark:bg-white">
        <MediaRenderer
          kind="image"
          src={logoUrl}
          alt={`${bankName} logo`}
          className="h-full w-full"
          maxHeightClassName="max-h-full"
          loading="eager"
          onError={() => setLogoFailed(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-md border text-[10px] font-bold leading-none ${tone.bg} ${tone.border} ${tone.text}`}
      aria-label={`${bankName} mark`}
      title={bankName}
    >
      {buildBankMark(bankName)}
    </span>
  );
};

function buildBankMark(bankName: string) {
  const cleanTokens = String(bankName)
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.trim().toUpperCase())
    .filter((token) => token.length > 0);

  const preferredTokens = cleanTokens.filter(
    (token) => !BANK_MARK_EXCLUDED_TOKENS.has(token),
  );
  const sourceTokens = preferredTokens.length > 0 ? preferredTokens : cleanTokens;

  const initials = sourceTokens
    .slice(0, 2)
    .map((token) => token[0] ?? '')
    .join('');

  const fallback = String(bankName)
    .replace(/[^A-Za-z0-9]+/g, '')
    .slice(0, 2)
    .toUpperCase();

  return initials || fallback || 'BK';
}

function normalizeBankDisplayName(bankName: string | null | undefined) {
  if (!bankName) return '';
  return bankName.replace(/paystack\s*/gi, '').trim() || 'Test Bank';
}

function normalizeVerificationCopy(message: string | null | undefined) {
  if (!message) return '';
  return message
    .replace(/paystack\s+test\s+bank/gi, 'Test Bank (001)')
    .replace(/paystack/gi, 'account verification');
}

function resolveUserFacingMessage(message: unknown, fallback: string) {
  const source = String(message ?? fallback).trim() || fallback;
  return normalizeVerificationCopy(source);
}

const StorePaymentAccountPanel: React.FC<StorePaymentAccountPanelProps> = ({
  mode = 'settings',
  onStatusChange,
}) => {
  const currentUserRole = useSelector(
    (state: RootState) => state.user.profile?.role,
  );
  const isSuperAdmin = currentUserRole === 'SuperAdmin';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncAction, setSyncAction] = useState<'primary' | 'resync' | null>(null);
  const [accountResponse, setAccountResponse] = useState<StorePaymentAccountResponse | null>(null);
  const [banks, setBanks] = useState<StorePaymentBankOption[]>([]);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [primaryContactName, setPrimaryContactName] = useState('');
  const [primaryContactEmail, setPrimaryContactEmail] = useState('');
  const [primaryContactPhone, setPrimaryContactPhone] = useState('');
  const [bankChangeConfirmOpen, setBankChangeConfirmOpen] = useState(false);
  const [verificationState, setVerificationState] = useState<{
    status: 'idle' | 'verifying' | 'verified' | 'error';
    message: string;
    accountName: string | null;
    bankName: string | null;
    bankCode: string | null;
    paystackBankId: number | null;
  }>({
    status: 'idle',
    message: '',
    accountName: null,
    bankName: null,
    bankCode: null,
    paystackBankId: null,
  });
  const lastVerificationKeyRef = useRef('');
  const verificationRunRef = useRef(0);

  const applyLoadedPanelData = useCallback((
    nextAccount: StorePaymentAccountResponse,
    nextBanks: StorePaymentBankOption[],
  ) => {
    const mergedBanksMap = new Map<string, StorePaymentBankOption>();
    for (const bank of nextBanks) {
      const key = `${bank.code}:${bank.name.toLowerCase()}`;
      if (!mergedBanksMap.has(key)) {
        mergedBanksMap.set(key, bank);
      }
    }

    if (
      nextAccount.account?.bankCode &&
      nextAccount.account?.bankName &&
      !Array.from(mergedBanksMap.values()).some(
        (bank) => bank.code === nextAccount.account?.bankCode,
      )
    ) {
      const fallbackBank = {
        id: -1,
        code: nextAccount.account.bankCode,
        name: nextAccount.account.bankName,
        currency: 'NGN',
      };
      const fallbackKey = `${fallbackBank.code}:${fallbackBank.name.toLowerCase()}`;
      mergedBanksMap.set(fallbackKey, fallbackBank);
    }

    const mergedBanks = Array.from(mergedBanksMap.values()).sort((left, right) =>
      left.name.localeCompare(right.name),
    );

    const hasLinkedAccount = Boolean(
      nextAccount.account?.bankCode && nextAccount.account?.maskedAccountNumber,
    );
    const hasTemporaryTestBank = mergedBanks.some(
      (bank) => bank.code === '001',
    );
    const defaultBankCode = hasLinkedAccount
      ? nextAccount.account?.bankCode ?? ''
      : hasTemporaryTestBank
        ? '001'
        : nextAccount.account?.bankCode ?? '';

    setAccountResponse(nextAccount);
    setBanks(mergedBanks);
    setBankCode(defaultBankCode);
    setPrimaryContactName(
      nextAccount.account?.primaryContactName ??
        nextAccount.suggestedDefaults.primaryContactName ??
        '',
    );
    setPrimaryContactEmail(
      nextAccount.account?.primaryContactEmail ??
        nextAccount.suggestedDefaults.primaryContactEmail ??
        '',
    );
    setPrimaryContactPhone(
      nextAccount.account?.primaryContactPhone ??
        nextAccount.suggestedDefaults.primaryContactPhone ??
        '',
    );
    onStatusChange?.(nextAccount.account ?? null);
  }, [onStatusChange]);

  const loadPanel = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const [accountResult, banksResult] = await Promise.allSettled([
        getStorePaymentAccount(),
        listStorePaymentBanks(),
      ]);

      if (accountResult.status !== 'fulfilled') {
        throw accountResult.reason;
      }

      const nextBanks =
        banksResult.status === 'fulfilled' ? banksResult.value : [];
      applyLoadedPanelData(accountResult.value, nextBanks);

      if (banksResult.status !== 'fulfilled') {
        const bankLoadMessage =
          (banksResult.reason as any)?.response?.data?.message ||
          'Unable to load settlement bank options right now';
        toast.error(resolveUserFacingMessage(bankLoadMessage, 'Unable to load settlement bank options right now'));
      }
    } catch (error: any) {
      toast.error(resolveUserFacingMessage(error?.response?.data?.message, 'Unable to load your payout account settings'));
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [applyLoadedPanelData]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const [accountResult, banksResult] = await Promise.allSettled([
          getStorePaymentAccount(),
          listStorePaymentBanks(),
        ]);
        if (cancelled) return;

        if (accountResult.status !== 'fulfilled') {
          throw accountResult.reason;
        }

        const nextBanks =
          banksResult.status === 'fulfilled' ? banksResult.value : [];
        applyLoadedPanelData(accountResult.value, nextBanks);

        if (banksResult.status !== 'fulfilled') {
          const bankLoadMessage =
            (banksResult.reason as any)?.response?.data?.message ||
            'Unable to load settlement bank options right now';
          toast.error(resolveUserFacingMessage(bankLoadMessage, 'Unable to load settlement bank options right now'));
        }
      } catch (error: any) {
        if (cancelled) return;
        toast.error(resolveUserFacingMessage(error?.response?.data?.message, 'Unable to load your payout account settings'));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [applyLoadedPanelData]);

  const account = accountResponse?.account ?? null;
  const statusMeta = getStatusMeta(account?.status);
  const selectedBank = banks.find((bank) => bank.code === bankCode);
  const hasTemporaryTestBankOption = banks.some((bank) => bank.code === '001');
  const hasExistingAccount = Boolean(account?.maskedAccountNumber);
  const hasCurrentLinkedAccount = Boolean(
    account?.bankName && account?.maskedAccountNumber,
  );
  const bankChanged = Boolean(
    hasExistingAccount &&
      bankCode &&
      account?.bankCode &&
      bankCode !== account.bankCode,
  );
  const accountNumberProvided = accountNumber.trim().length > 0;
  const bankDetailsDirty =
    hasExistingAccount && (bankChanged || accountNumberProvided);
  const canResyncCurrentAccount = Boolean(hasExistingAccount && (bankCode || account?.bankCode));
  const primarySyncConfig = {
    useExistingAccountNumber:
      hasExistingAccount && !bankChanged && !accountNumberProvided,
    successMessage: bankDetailsDirty
      ? 'Payout account updated'
      : 'Payout account synced',
  };
  const nextAccountSummary =
    normalizeBankDisplayName(selectedBank?.name) || bankCode || 'selected bank';

  const sectionTitle =
    mode === 'wizard' ? 'Payout account setup' : 'Payout account';
  const sectionDescription =
    mode === 'wizard'
      ? 'Connect the bank account that should receive your brand payouts.'
      : 'Manage the bank account used for your brand payouts.';
  const resolvedVerifiedAccountName =
    verificationState.accountName ?? account?.accountName ?? '';
  const showAccountNameField = Boolean(resolvedVerifiedAccountName);
  const isDevRuntime = import.meta.env.DEV;

  const executeSync = useCallback(async ({
    useExistingAccountNumber,
    successMessage,
    action = 'primary',
  }: {
    useExistingAccountNumber: boolean;
    successMessage: string;
    action?: 'primary' | 'resync';
  }) => {
    const resolvedBankCode = bankCode || account?.bankCode || '';
    const resolvedAccountNumber = useExistingAccountNumber
      ? undefined
      : accountNumber.trim();

    if (!resolvedBankCode) {
      toast.error('Select the settlement bank first');
      return;
    }

    if (!useExistingAccountNumber && !/^\d{10}$/.test(resolvedAccountNumber || '')) {
      toast.error('Account number must be a valid 10-digit NUBAN');
      return;
    }

    setSaving(true);
    setSyncAction(action);
    try {
      await updateStorePaymentAccount({
        bankCode: resolvedBankCode,
        accountNumber: resolvedAccountNumber,
        primaryContactName: primaryContactName.trim() || undefined,
        primaryContactEmail: primaryContactEmail.trim() || undefined,
        primaryContactPhone: primaryContactPhone.trim() || undefined,
      });
      setAccountNumber('');
      await loadPanel(true);
      toast.success(successMessage);
    } catch (error: any) {
      toast.error(resolveUserFacingMessage(error?.response?.data?.message, 'Unable to sync the payout account'));
      await loadPanel(true).catch(() => {});
    } finally {
      setSaving(false);
      setSyncAction(null);
    }
  }, [
    account?.bankCode,
    accountNumber,
    bankCode,
    loadPanel,
    primaryContactEmail,
    primaryContactName,
    primaryContactPhone,
  ]);

  const handlePrimarySave = async () => {
    if (
      accountNumberProvided &&
      /^\d{10}$/.test(accountNumber.trim()) &&
      Boolean(bankCode) &&
      verificationState.status !== 'verified'
    ) {
      toast.error('Verify the bank account details before syncing');
      return;
    }

    if (
      verificationState.status === 'verified' &&
      verificationState.bankCode &&
      verificationState.bankCode !== bankCode
    ) {
      setBankCode(verificationState.bankCode);
      toast.error('Bank selection was updated to match verified account details. Review and save again.');
      return;
    }

    if (bankChanged && !accountNumberProvided) {
      toast.error('Enter the new account number for the selected bank');
      return;
    }

    if (hasExistingAccount && bankDetailsDirty) {
      setBankChangeConfirmOpen(true);
      return;
    }

    await executeSync(primarySyncConfig);
  };

  const confirmPrimarySave = async () => {
    setBankChangeConfirmOpen(false);
    await executeSync(primarySyncConfig);
  };

  useEffect(() => {
    const normalizedAccountNumber = accountNumber.trim();
    const verificationKey = `${bankCode}:${normalizedAccountNumber}`;

    if (!bankCode || normalizedAccountNumber.length !== 10) {
      lastVerificationKeyRef.current = '';
      setVerificationState((current) =>
        current.status === 'idle'
          ? current
          : {
              status: 'idle',
              message: '',
              accountName: null,
              bankName: null,
              bankCode: null,
              paystackBankId: null,
            },
      );
      return;
    }

    if (verificationKey === lastVerificationKeyRef.current) {
      return;
    }

    const runId = verificationRunRef.current + 1;
    verificationRunRef.current = runId;
    setVerificationState({
      status: 'verifying',
      message: 'Verifying account details...',
      accountName: null,
      bankName: null,
      bankCode: null,
      paystackBankId: null,
    });

    const timer = window.setTimeout(async () => {
      try {
        const verification = await verifyStorePaymentAccount({
          bankCode,
          accountNumber: normalizedAccountNumber,
        });

        if (verificationRunRef.current !== runId) {
          return;
        }

        lastVerificationKeyRef.current = verificationKey;
        setVerificationState({
          status: 'verified',
          message:
            normalizeVerificationCopy(verification.message) ||
            'Bank account verified',
          accountName: verification.accountName,
          bankName: verification.bankName,
          bankCode: verification.bankCode,
          paystackBankId: verification.paystackBankId,
        });

        if (verification.accountName) {
          setPrimaryContactName(verification.accountName);
        }

        if (verification.bankCode && verification.bankCode !== bankCode) {
          setBankCode(verification.bankCode);
        }

        // In wizard mode, auto-sync first-time setup and dev test-bank verification
        // immediately after success so the readiness state can update without extra clicks.
        if (
          mode === 'wizard' &&
          (!hasExistingAccount || (isDevRuntime && verification.bankCode === '001'))
        ) {
          await executeSync({
            useExistingAccountNumber: false,
            successMessage: 'Account verification saved',
          });
        }
      } catch (error: any) {
        if (verificationRunRef.current !== runId) {
          return;
        }

        const rawErrorMessage = String(
          error?.response?.data?.message ||
            'Unable to verify bank account details right now',
        );
        const missingVerifyEndpoint =
          Number(error?.response?.status) === 404 &&
          rawErrorMessage.includes('Cannot POST /store/payment-account/verify');

        lastVerificationKeyRef.current = '';
        setVerificationState({
          status: 'error',
          message: missingVerifyEndpoint
            ? 'Verification endpoint is unavailable on the running API instance. Restart the backend with the latest code and try again.'
            : normalizeVerificationCopy(rawErrorMessage),
          accountName: null,
          bankName: null,
          bankCode: null,
          paystackBankId: null,
        });
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [accountNumber, bankCode, executeSync, mode, hasExistingAccount, isDevRuntime]);

  return (
    <div className={`${panelClassName} space-y-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {sectionTitle}
          </h2>
          <p className="max-w-3xl text-sm text-gray-600 dark:text-gray-400">
            {sectionDescription}
          </p>
        </div>
        <div
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta.tone}`}
        >
          <span className="mr-1" aria-hidden="true">
            {statusMeta.emoji}
          </span>
          {statusMeta.label}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-100">
          <InlineSpinner className="h-4 w-4" />
          <div>
            <div className="font-semibold">Loading payout details...</div>
            <div className="text-xs text-blue-800/70 dark:text-blue-100/70">
              Bank fields are disabled until your payout profile finishes loading.
            </div>
          </div>
        </div>
      ) : null}

      {account?.lastSyncError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
          <div className="font-semibold">Sync issue</div>
          <div className="mt-1">{normalizeVerificationCopy(account.lastSyncError)}</div>
        </div>
      ) : null}

      {bankDetailsDirty ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          <div className="font-semibold">Bank details change detected</div>
          <div className="mt-1">
            Changing the settlement bank or account number can pause payout readiness until the next account verification sync succeeds.
          </div>
        </div>
      ) : null}

      <div
        className={`grid gap-4 ${
          isSuperAdmin ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-2'
        }`}
      >
        <div className={metaCardClassName}>
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Business
          </div>
          <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
            {accountResponse?.suggestedDefaults.businessName || '—'}
          </div>
        </div>
        {hasCurrentLinkedAccount ? (
          <div className={metaCardClassName}>
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Current account
            </div>
            <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
              {`${normalizeBankDisplayName(account?.bankName) || '—'} • ${account?.maskedAccountNumber}`}
            </div>
            {account?.accountName ? (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Resolved name: {account.accountName}
              </div>
            ) : null}
          </div>
        ) : null}
        {isSuperAdmin ? (
          <div className={metaCardClassName}>
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Subaccount
            </div>
            <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
              {account?.subaccountCode || 'Not synced yet'}
            </div>
            {account?.subaccountId ? (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                ID: {account.subaccountId}
              </div>
            ) : null}
          </div>
        ) : null}
        {isSuperAdmin ? (
          <div className={metaCardClassName}>
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Transfer recipient
            </div>
            <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
              {account?.transferRecipientCode || 'Not synced yet'}
            </div>
            {account?.transferRecipientId ? (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                ID: {account.transferRecipientId}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <UniversalSelect
          label="Settlement bank"
          value={bankCode}
          onChange={setBankCode}
          options={banks.map((bank) => ({
            value: bank.code,
            label: normalizeBankDisplayName(bank.name),
            description: `${bank.currency} • ${bank.code}`,
            icon: <BankOptionIcon bankName={bank.name} />,
          }))}
          placeholder={loading ? 'Loading banks...' : 'Choose a bank'}
          searchable
          searchPlaceholder="Search bank name or code"
          emptyMessage="No banks match your search"
          optionCompact
          optionAllowWrap
          disabled={loading || saving}
        />
        {!hasExistingAccount && hasTemporaryTestBankOption && bankCode !== '001' ? (
          <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            Test-mode limit is active for live bank resolves. Select <span className="font-semibold">Test Bank (001)</span> to continue development verification.
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {hasExistingAccount ? 'Account number (optional for resync)' : 'Account number'}
          </label>
          <input
            type="text"
            value={accountNumber}
            onChange={(event) =>
              setAccountNumber(event.target.value.replace(/\D+/g, '').slice(0, 10))
            }
            inputMode="numeric"
            placeholder={hasExistingAccount ? 'Leave blank to reuse the saved account' : '0001234567'}
            disabled={loading || saving}
            className={inputClassName}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {bankChanged
              ? 'Enter the 10-digit account number again when switching the settlement bank.'
              : hasExistingAccount
              ? `Saved account on file: ${account?.maskedAccountNumber || '—'}. Enter a new number only when you are replacing the bank account.`
              : 'Enter a 10-digit account number to verify account details.'}
          </p>
          {verificationState.status === 'verifying' ? (
            <div className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-300 dark:border-t-transparent" />
              Verifying account details...
            </div>
          ) : null}
          {verificationState.status === 'verified' ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              <div className="font-semibold">Account verified</div>
              {verificationState.message ? (
                <div className="mt-1 break-words">
                  {verificationState.message}
                </div>
              ) : null}
              {verificationState.accountName ? (
                <div className="mt-1 break-words">
                  Account name: {verificationState.accountName}
                </div>
              ) : null}
              {verificationState.bankName ? (
                <div className="mt-1 break-words">
                  Verified bank: {normalizeBankDisplayName(verificationState.bankName)}
                </div>
              ) : null}
            </div>
          ) : null}
          {verificationState.status === 'error' ? (
            <p className="text-xs text-rose-700 dark:text-rose-300 break-words">
              {verificationState.message}
            </p>
          ) : null}
        </div>

        {showAccountNameField ? (
          <div className="space-y-1.5 md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Account name
            </label>
            <input
              type="text"
              value={resolvedVerifiedAccountName}
              readOnly
              disabled={loading || saving}
              className={inputClassName}
            />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Primary contact name
          </label>
          <input
            type="text"
            value={primaryContactName}
            onChange={(event) => setPrimaryContactName(event.target.value)}
            disabled={loading || saving}
            className={inputClassName}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Primary contact email
          </label>
          <input
            type="email"
            value={primaryContactEmail}
            onChange={(event) => setPrimaryContactEmail(event.target.value)}
            disabled={loading || saving}
            className={inputClassName}
          />
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Primary contact phone
          </label>
          <input
            type="tel"
            value={primaryContactPhone}
            onChange={(event) => setPrimaryContactPhone(event.target.value)}
            disabled={loading || saving}
            className={inputClassName}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handlePrimarySave()}
          disabled={loading || saving}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {syncAction === 'primary' ? <InlineSpinner /> : null}
          {syncAction === 'primary'
            ? 'Syncing account...'
            : hasExistingAccount
              ? 'Save changes and sync'
              : 'Save and sync account'}
        </button>
        <button
          type="button"
          onClick={() =>
            executeSync({
              useExistingAccountNumber: true,
              successMessage: 'Current payout account resynced',
              action: 'resync',
            })
          }
          disabled={loading || saving || !canResyncCurrentAccount}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
        >
          {syncAction === 'resync' ? <InlineSpinner /> : null}
          {syncAction === 'resync' ? 'Resyncing...' : 'Resync current account'}
        </button>
        <button
          type="button"
          onClick={() => void loadPanel()}
          disabled={loading || saving}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
        >
          {loading ? <InlineSpinner /> : null}
          {loading ? 'Refreshing...' : 'Refresh status'}
        </button>
      </div>

      <ConfirmDialog
        open={bankChangeConfirmOpen}
        title="Confirm payout account change"
        message={`Changing the payout bank or account number will resync ${nextAccountSummary} through account verification and update the recipient used for future payouts. Continue with this change?`}
        confirmText="Save and sync"
        cancelText="Go back"
        isLoading={saving}
        onConfirm={() => void confirmPrimarySave()}
        onCancel={() => setBankChangeConfirmOpen(false)}
      />
    </div>
  );
};

export default StorePaymentAccountPanel;
