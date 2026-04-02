import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import UniversalSelect from '@/components/forms/UniversalSelect';
import {
  getStorePaymentAccount,
  listStorePaymentBanks,
  updateStorePaymentAccount,
  type StorePaymentAccountResponse,
  type StorePaymentAccountSummary,
  type StorePaymentBankOption,
} from '@/api/StoreApi';

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

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

const panelClassName =
  'rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-[#1a1a1a]';

const metaCardClassName =
  'rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-white/10 dark:bg-black/20';

const inputClassName =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-black/40 dark:text-white';

const StorePaymentAccountPanel: React.FC<StorePaymentAccountPanelProps> = ({
  mode = 'settings',
  onStatusChange,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accountResponse, setAccountResponse] = useState<StorePaymentAccountResponse | null>(null);
  const [banks, setBanks] = useState<StorePaymentBankOption[]>([]);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [primaryContactName, setPrimaryContactName] = useState('');
  const [primaryContactEmail, setPrimaryContactEmail] = useState('');
  const [primaryContactPhone, setPrimaryContactPhone] = useState('');
  const [bankChangeConfirmOpen, setBankChangeConfirmOpen] = useState(false);

  const applyLoadedPanelData = (
    nextAccount: StorePaymentAccountResponse,
    nextBanks: StorePaymentBankOption[],
  ) => {
    setAccountResponse(nextAccount);
    setBanks(nextBanks);
    setBankCode(nextAccount.account?.bankCode ?? '');
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
  };

  const loadPanel = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const [nextAccount, nextBanks] = await Promise.all([
        getStorePaymentAccount(),
        listStorePaymentBanks(),
      ]);
      applyLoadedPanelData(nextAccount, nextBanks);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          'Unable to load your Paystack payout account settings',
      );
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const [nextAccount, nextBanks] = await Promise.all([
          getStorePaymentAccount(),
          listStorePaymentBanks(),
        ]);
        if (cancelled) return;
        applyLoadedPanelData(nextAccount, nextBanks);
      } catch (error: any) {
        if (cancelled) return;
        toast.error(
          error?.response?.data?.message ||
            'Unable to load your Paystack payout account settings',
        );
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
  }, [onStatusChange]);

  const account = accountResponse?.account ?? null;
  const statusMeta = getStatusMeta(account?.status);
  const selectedBank = banks.find((bank) => bank.code === bankCode);
  const hasExistingAccount = Boolean(account?.maskedAccountNumber);
  const bankChanged = Boolean(
    hasExistingAccount &&
      bankCode &&
      account?.bankCode &&
      bankCode !== account.bankCode,
  );
  const accountNumberProvided = accountNumber.trim().length > 0;
  const bankDetailsDirty = bankChanged || accountNumberProvided;
  const canResyncCurrentAccount = Boolean(hasExistingAccount && (bankCode || account?.bankCode));
  const primarySyncConfig = {
    useExistingAccountNumber:
      hasExistingAccount && !bankChanged && !accountNumberProvided,
    successMessage: bankDetailsDirty
      ? 'Paystack payout account updated'
      : 'Paystack payout account synced',
  };
  const nextAccountSummary = selectedBank?.name || bankCode || 'selected bank';

  const sectionTitle =
    mode === 'wizard' ? 'Payout account setup' : 'Payout account';
  const sectionDescription =
    mode === 'wizard'
      ? 'Threadly collects customer payments in the main Paystack account, then handles escrow, commission, and brand balance release inside the app. Your payout account must be active before the store can launch.'
      : 'Use this Accounts screen to set up, update, and resync the brand payout account used for Paystack subaccount and transfer-recipient readiness.';

  const syncCards = useMemo(
    () => [
      {
        label: 'Last provider sync',
        value: formatDateTime(account?.lastProviderSyncAt ?? account?.updatedAt),
      },
      {
        label: 'Last successful sync',
        value: formatDateTime(account?.lastSuccessfulSyncAt),
      },
      {
        label: 'Account resolved',
        value: formatDateTime(account?.accountResolvedAt),
      },
      {
        label: 'Recipient synced',
        value: formatDateTime(account?.transferRecipientLastSyncAt),
      },
    ],
    [account],
  );

  const executeSync = async ({
    useExistingAccountNumber,
    successMessage,
  }: {
    useExistingAccountNumber: boolean;
    successMessage: string;
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
      toast.error(
        error?.response?.data?.message || 'Unable to sync the payout account',
      );
      await loadPanel(true).catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  const handlePrimarySave = async () => {
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

      {account?.lastSyncError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
          <div className="font-semibold">Sync issue</div>
          <div className="mt-1">{account.lastSyncError}</div>
        </div>
      ) : null}

      {bankDetailsDirty ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          <div className="font-semibold">Bank details change detected</div>
          <div className="mt-1">
            Changing the settlement bank or account number can pause payout readiness until the next Paystack sync succeeds.
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className={metaCardClassName}>
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Business
          </div>
          <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
            {accountResponse?.suggestedDefaults.businessName || '—'}
          </div>
        </div>
        <div className={metaCardClassName}>
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Current account
          </div>
          <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
            {account?.bankName && account?.maskedAccountNumber
              ? `${account.bankName} • ${account.maskedAccountNumber}`
              : 'Not linked yet'}
          </div>
          {account?.accountName ? (
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Resolved name: {account.accountName}
            </div>
          ) : null}
        </div>
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
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <UniversalSelect
          label="Settlement bank"
          value={bankCode}
          onChange={setBankCode}
          options={banks.map((bank) => ({
            value: bank.code,
            label: bank.name,
            description: `${bank.currency} • ${bank.code}`,
          }))}
          placeholder={loading ? 'Loading banks...' : 'Choose a bank'}
          disabled={loading || saving}
        />

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
              : 'Paystack resolves the account before it creates the subaccount and transfer recipient.'}
          </p>
        </div>

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

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${metaCardClassName} space-y-3`}>
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Sync history
            </div>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Exact provider timestamps help support distinguish setup failures from stale payout-account state.
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {syncCards.map((item) => (
              <div key={item.label}>
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {item.label}
                </div>
                <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${metaCardClassName} space-y-3`}>
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Support references
            </div>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              These are the provider references support needs when payout readiness is active but transfers are failing.
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Bank code
              </div>
              <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                {selectedBank?.code || account?.bankCode || '—'}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Paystack bank ID
              </div>
              <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                {account?.paystackBankId || '—'}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Recipient active
              </div>
              <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                {account?.transferRecipientActive ? 'Yes' : 'No'}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Subaccount verified
              </div>
              <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                {account?.subaccountVerified ? 'Yes' : 'No'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-white/10 dark:bg-black/20 dark:text-gray-300">
        <div className="font-semibold text-gray-900 dark:text-white">v1 finance rule</div>
        <div className="mt-1">
          Checkout settles into Threadly&apos;s main Paystack account. Threadly then applies commission, escrow, ledger posting, and brand balance release internally before payout.
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handlePrimarySave()}
          disabled={loading || saving}
          className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving
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
            })
          }
          disabled={loading || saving || !canResyncCurrentAccount}
          className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
        >
          Resync current account
        </button>
        <button
          type="button"
          onClick={() => void loadPanel()}
          disabled={loading || saving}
          className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
        >
          Refresh status
        </button>
      </div>

      <ConfirmDialog
        open={bankChangeConfirmOpen}
        title="Confirm payout account change"
        message={`Changing the payout bank or account number will resync ${nextAccountSummary} with Paystack and update the recipient used for future payouts. Continue with this change?`}
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
