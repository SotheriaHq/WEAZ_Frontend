import React from 'react';
import type {
  CheckoutPaymentMethod,
  DirectBankTransferPaymentData,
  FlutterwavePaymentData,
  PaymentData,
  ShippingAddress,
} from '@/api/StoreApi';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import {
  FLUTTERWAVE_CHANNEL_OPTIONS,
  FLUTTERWAVE_USSD_BANKS,
  MOBILE_MONEY_COUNTRY_OPTIONS,
  MOBILE_MONEY_NETWORKS,
  NIGERIAN_BANK_OPTIONS,
  formatChannelLabel,
  type PaymentFormErrors,
} from '@/pages/checkout/paymentFlow';

interface PaymentDetailsSectionProps {
  paymentMethod: CheckoutPaymentMethod;
  paymentData: PaymentData;
  shippingAddress: ShippingAddress;
  errors: PaymentFormErrors;
  onChange: (updater: (current: PaymentData) => PaymentData) => void;
  compact?: boolean;
}

const inputClassName = '[&_input]:rounded-2xl [&_input]:border-white/60 [&_input]:bg-white/80 [&_input]:shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:[&_input]:border-white/10 dark:[&_input]:bg-white/[0.03]';
const textareaClassName = '[&_textarea]:rounded-2xl [&_textarea]:border-white/60 [&_textarea]:bg-white/80 [&_textarea]:shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:[&_textarea]:border-white/10 dark:[&_textarea]:bg-white/[0.03]';
const selectClassName = '[&_.DropdownTrigger]:rounded-2xl [&_.DropdownTrigger]:border-white/60 [&_.DropdownTrigger]:bg-white/80 [&_.DropdownTrigger]:shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:[&_.DropdownTrigger]:border-white/10 dark:[&_.DropdownTrigger]:bg-white/[0.03]';

const infoCardClassName = 'rounded-[24px] border border-slate-200/80 bg-white/70 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300';

const PaymentDetailsSection: React.FC<PaymentDetailsSectionProps> = ({
  paymentMethod,
  paymentData,
  shippingAddress,
  errors,
  onChange,
  compact = false,
}) => {
  const updateField = (field: string, value: string | boolean) => {
    onChange((current) => ({ ...current, [field]: value } as PaymentData));
  };

  const updateNestedField = (parent: string, field: string, value: string) => {
    onChange((current) => ({
      ...current,
      [parent]: {
        ...((current as any)[parent] ?? {}),
        [field]: value,
      },
    } as PaymentData));
  };

  const renderBillingAddress = () => {
    if (paymentData.billingSameAsShipping) {
      return (
        <div className={infoCardClassName}>
          <p className="font-semibold text-slate-900 dark:text-white">Billing address</p>
          <p className="mt-1">
            Using the shipping address for billing verification and payment receipts.
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Billing first name" value={paymentData.billingAddress?.firstName ?? ''} onChange={(e) => updateNestedField('billingAddress', 'firstName', e.target.value)} error={errors['billingAddress.firstName']} className={inputClassName} />
        <Input label="Billing last name" value={paymentData.billingAddress?.lastName ?? ''} onChange={(e) => updateNestedField('billingAddress', 'lastName', e.target.value)} error={errors['billingAddress.lastName']} className={inputClassName} />
        <div className="sm:col-span-2">
          <Input label="Billing street" value={paymentData.billingAddress?.street ?? ''} onChange={(e) => updateNestedField('billingAddress', 'street', e.target.value)} error={errors['billingAddress.street']} className={inputClassName} />
        </div>
        <Input label="Apartment / suite" value={paymentData.billingAddress?.apartment ?? ''} onChange={(e) => updateNestedField('billingAddress', 'apartment', e.target.value)} className={inputClassName} />
        <Input label="Billing city" value={paymentData.billingAddress?.city ?? ''} onChange={(e) => updateNestedField('billingAddress', 'city', e.target.value)} error={errors['billingAddress.city']} className={inputClassName} />
        <Input label="Billing state" value={paymentData.billingAddress?.state ?? ''} onChange={(e) => updateNestedField('billingAddress', 'state', e.target.value)} error={errors['billingAddress.state']} className={inputClassName} />
        <Input label="Postal code" value={paymentData.billingAddress?.postalCode ?? ''} onChange={(e) => updateNestedField('billingAddress', 'postalCode', e.target.value)} className={inputClassName} />
        <Input label="Billing country" value={paymentData.billingAddress?.country ?? ''} onChange={(e) => updateNestedField('billingAddress', 'country', e.target.value)} error={errors['billingAddress.country']} className={inputClassName} />
      </div>
    );
  };

  const renderFlutterwaveFields = () => {
    const flutterwaveData = paymentData as FlutterwavePaymentData;
    const networks = MOBILE_MONEY_NETWORKS[flutterwaveData.mobileMoney?.countryCode ?? 'GH'];

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {FLUTTERWAVE_CHANNEL_OPTIONS.map((channel) => (
            <button
              key={channel.value}
              type="button"
              onClick={() => updateField('channel', channel.value)}
              className={`rounded-[22px] border p-4 text-left transition-all ${flutterwaveData.channel === channel.value ? 'border-fuchsia-400 bg-[linear-gradient(135deg,rgba(245,208,254,0.6),rgba(224,231,255,0.7))] shadow-[0_16px_40px_rgba(217,70,239,0.16)] dark:bg-[linear-gradient(135deg,rgba(168,85,247,0.16),rgba(59,130,246,0.10))]' : 'border-white/60 bg-white/72 dark:border-white/10 dark:bg-white/[0.03]'}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{channel.emoji}</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{channel.label}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{channel.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {flutterwaveData.channel === 'CARD' && (
          <div className={infoCardClassName}>
            <p className="font-semibold text-slate-900 dark:text-white">Hosted card capture</p>
            <p className="mt-1">Card number, expiry, CVV, OTP, PIN, and 3DS are handled on Flutterwave's secure payment page instead of your checkout form.</p>
          </div>
        )}

        {flutterwaveData.channel === 'BANK_TRANSFER' && (
          <div className={infoCardClassName}>
            <p className="font-semibold text-slate-900 dark:text-white">Virtual account transfer</p>
            <p className="mt-1">After you place the order, Threadly will generate a temporary account number, expiry time, amount, and narration to use for the transfer.</p>
          </div>
        )}

        {flutterwaveData.channel === 'BANK_ACCOUNT' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Bank" value={flutterwaveData.bankAccount?.bankCode ?? ''} onChange={(e) => {
              const selected = NIGERIAN_BANK_OPTIONS.find((option) => option.value === e.target.value);
              updateNestedField('bankAccount', 'bankCode', e.target.value);
              updateNestedField('bankAccount', 'bankName', selected?.label ?? '');
            }} error={errors['bankAccount.bankCode']} className={selectClassName}>
              <option value="">Select bank</option>
              {NIGERIAN_BANK_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
            <Input label="Account number" value={flutterwaveData.bankAccount?.accountNumber ?? ''} onChange={(e) => updateNestedField('bankAccount', 'accountNumber', e.target.value)} error={errors['bankAccount.accountNumber']} className={inputClassName} />
            <div className="sm:col-span-2">
              <Input label="Account name" value={flutterwaveData.bankAccount?.accountName ?? ''} onChange={(e) => updateNestedField('bankAccount', 'accountName', e.target.value)} helperText="If you already know the account name, add it now. Production account resolution can replace this later." error={errors['bankAccount.accountName']} className={inputClassName} />
            </div>
          </div>
        )}

        {flutterwaveData.channel === 'USSD' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="USSD bank" value={flutterwaveData.ussd?.bankCode ?? ''} onChange={(e) => {
              const selected = FLUTTERWAVE_USSD_BANKS.find((option) => option.value === e.target.value);
              updateNestedField('ussd', 'bankCode', e.target.value);
              updateNestedField('ussd', 'bankName', selected?.label ?? '');
            }} error={errors['ussd.bankCode']} className={selectClassName}>
              <option value="">Select bank</option>
              {FLUTTERWAVE_USSD_BANKS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
            <div className={infoCardClassName}>
              <p className="font-semibold text-slate-900 dark:text-white">USSD payment flow</p>
              <p className="mt-1">Threadly will generate the dial string after order creation. The customer completes authorization on their phone using their bank PIN.</p>
            </div>
          </div>
        )}

        {flutterwaveData.channel === 'MOBILE_MONEY' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Country" value={flutterwaveData.mobileMoney?.countryCode ?? 'GH'} onChange={(e) => {
              const countryCode = e.target.value as 'GH' | 'KE';
              updateNestedField('mobileMoney', 'countryCode', countryCode);
              updateNestedField('mobileMoney', 'networkId', '');
              updateNestedField('mobileMoney', 'networkName', '');
            }} className={selectClassName}>
              {MOBILE_MONEY_COUNTRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
            <Select label="Mobile money network" value={flutterwaveData.mobileMoney?.networkId ?? ''} onChange={(e) => {
              const selected = networks.find((option) => option.value === e.target.value);
              updateNestedField('mobileMoney', 'networkId', e.target.value);
              updateNestedField('mobileMoney', 'networkName', selected?.label ?? '');
            }} error={errors['mobileMoney.networkId']} className={selectClassName}>
              <option value="">Select network</option>
              {networks.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
            <div className="sm:col-span-2">
              <Input label="Wallet phone number" value={flutterwaveData.mobileMoney?.phone ?? ''} onChange={(e) => updateNestedField('mobileMoney', 'phone', e.target.value)} error={errors['mobileMoney.phone']} helperText="Use the number registered for the selected mobile money wallet." className={inputClassName} />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDirectTransferFields = () => {
    const transferData = paymentData as DirectBankTransferPaymentData;

    return (
      <div className="space-y-4">
        <div className={infoCardClassName}>
          <p className="font-semibold text-slate-900 dark:text-white">Prepare the sender information</p>
          <p className="mt-1">This helps support trace the payment if the bank transfer settles late or the narration is missing.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Sender name" value={transferData.senderName} onChange={(e) => updateField('senderName', e.target.value)} error={errors.senderName} className={inputClassName} />
          <Input label="Sender phone" value={transferData.senderPhone} onChange={(e) => updateField('senderPhone', e.target.value)} error={errors.senderPhone} className={inputClassName} />
          <div className="sm:col-span-2">
            <Input label="Sending bank" value={transferData.senderBankName} onChange={(e) => updateField('senderBankName', e.target.value)} error={errors.senderBankName} className={inputClassName} />
          </div>
          <div className="sm:col-span-2">
            <Textarea label="Transfer purpose / internal note" value={transferData.transferPurpose} onChange={(e) => updateField('transferPurpose', e.target.value)} error={errors.transferPurpose} helperText="For example: Personal account transfer, spouse transfer, or company account payment." className={textareaClassName} rows={3} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-6 rounded-[28px] border ${compact ? 'border-fuchsia-200/80 bg-white/72 p-4 shadow-[0_16px_36px_rgba(217,70,239,0.08)] dark:border-fuchsia-400/20 dark:bg-white/[0.04]' : 'border-white/60 bg-white/62 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-white/[0.025]'}`}>
      <div className="space-y-1">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-500 dark:text-fuchsia-300">Payment details</p>
        <h3 className="text-lg font-bold text-slate-950 dark:text-white">Complete the details for this payment route</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {paymentMethod === 'PAYSTACK' && 'Threadly only collects the customer and billing data needed before handing off to Paystack.'}
          {paymentMethod === 'FLUTTERWAVE' && `Flutterwave supports ${formatChannelLabel((paymentData as FlutterwavePaymentData).channel)} for this order. Fill the fields required for that channel.`}
          {paymentMethod === 'BANK_TRANSFER' && 'Direct transfer orders need sender details so support can reconcile delayed or mismatched transfers.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Payer email" type="email" value={paymentData.email} onChange={(e) => updateField('email', e.target.value)} error={errors.email} required className={inputClassName} />
        <Input label="Payer phone" type="tel" value={paymentData.phone} onChange={(e) => updateField('phone', e.target.value)} error={errors.phone} required helperText={`Shipping phone on file: ${shippingAddress.phone || 'none yet'}`} className={inputClassName} />
      </div>

      {paymentMethod === 'PAYSTACK' && (
        <div className={infoCardClassName}>
          <p className="font-semibold text-slate-900 dark:text-white">Paystack hosted card checkout</p>
          <p className="mt-1">Threadly will not ask for card number, CVV, or expiry in your checkout. Those fields remain on the secure Paystack page to keep card handling out of app scope.</p>
        </div>
      )}

      {paymentMethod === 'FLUTTERWAVE' && renderFlutterwaveFields()}
      {paymentMethod === 'BANK_TRANSFER' && renderDirectTransferFields()}

      <div className="space-y-4 rounded-[24px] border border-dashed border-slate-200/80 p-4 dark:border-white/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Billing address</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Billing data helps with receipts, fraud checks, and charge follow-up where the gateway requires it.</p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={paymentData.billingSameAsShipping} onChange={(e) => updateField('billingSameAsShipping', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-fuchsia-500 focus:ring-fuchsia-500/30" />
            Same as shipping
          </label>
        </div>
        {renderBillingAddress()}
      </div>

      <label className="flex items-start gap-3 rounded-[22px] border border-slate-200/80 bg-white/70 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
        <input type="checkbox" checked={paymentData.consentAccepted} onChange={(e) => updateField('consentAccepted', e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-fuchsia-500 focus:ring-fuchsia-500/30" />
        <span>
          I confirm these payment details are correct, and I understand this method can require issuer verification, gateway redirects, or delayed confirmation before the order is fulfilled.
          {errors.consentAccepted && <span className="mt-1 block text-xs text-red-500">{errors.consentAccepted}</span>}
        </span>
      </label>
    </div>
  );
};

export default PaymentDetailsSection;