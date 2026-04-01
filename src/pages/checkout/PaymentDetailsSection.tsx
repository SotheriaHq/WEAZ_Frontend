import React from 'react';
import type { PaystackPaymentData, ShippingAddress } from '@/api/StoreApi';
import Input from '@/components/ui/Input';
import UniversalSelect from '@/components/forms/UniversalSelect';
import type { PaymentFormErrors } from '@/pages/checkout/paymentFlow';

interface PaymentDetailsSectionProps {
  paymentData: PaystackPaymentData;
  shippingAddress: ShippingAddress;
  errors: PaymentFormErrors;
  onChange: (updater: (current: PaystackPaymentData) => PaystackPaymentData) => void;
  compact?: boolean;
}

const inputClassName =
  '[&_input]:rounded-2xl [&_input]:border-white/60 [&_input]:bg-white/80 [&_input]:shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:[&_input]:border-white/10 dark:[&_input]:bg-white/[0.03]';
const selectClassName =
  '[&>div>button]:rounded-2xl [&>div>button]:border-white/60 [&>div>button]:bg-white/80 [&>div>button]:shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:[&>div>button]:border-white/10 dark:[&>div>button]:bg-white/[0.03]';
const infoCardClassName =
  'rounded-[24px] border border-slate-200/80 bg-white/70 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300';

const PaymentDetailsSection: React.FC<PaymentDetailsSectionProps> = ({
  paymentData,
  shippingAddress,
  errors,
  onChange,
  compact = false,
}) => {
  const updateField = <K extends keyof PaystackPaymentData>(
    field: K,
    value: PaystackPaymentData[K],
  ) => {
    onChange((current) => ({ ...current, [field]: value }));
  };

  const updateBillingField = (
    field: keyof NonNullable<PaystackPaymentData['billingAddress']>,
    value: string,
  ) => {
    onChange((current) => ({
      ...current,
      billingAddress: {
        ...(current.billingAddress ?? {
          firstName: '',
          lastName: '',
          street: '',
          apartment: '',
          city: '',
          state: '',
          postalCode: '',
          country: 'Nigeria',
        }),
        [field]: value,
      },
    }));
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
        <Input
          label="Billing first name"
          value={paymentData.billingAddress?.firstName ?? ''}
          onChange={(event) => updateBillingField('firstName', event.target.value)}
          error={errors['billingAddress.firstName']}
          className={inputClassName}
        />
        <Input
          label="Billing last name"
          value={paymentData.billingAddress?.lastName ?? ''}
          onChange={(event) => updateBillingField('lastName', event.target.value)}
          error={errors['billingAddress.lastName']}
          className={inputClassName}
        />
        <div className="sm:col-span-2">
          <Input
            label="Billing street"
            value={paymentData.billingAddress?.street ?? ''}
            onChange={(event) => updateBillingField('street', event.target.value)}
            error={errors['billingAddress.street']}
            className={inputClassName}
          />
        </div>
        <Input
          label="Apartment / suite"
          value={paymentData.billingAddress?.apartment ?? ''}
          onChange={(event) => updateBillingField('apartment', event.target.value)}
          className={inputClassName}
        />
        <Input
          label="Billing city"
          value={paymentData.billingAddress?.city ?? ''}
          onChange={(event) => updateBillingField('city', event.target.value)}
          error={errors['billingAddress.city']}
          className={inputClassName}
        />
        <Input
          label="Billing state"
          value={paymentData.billingAddress?.state ?? ''}
          onChange={(event) => updateBillingField('state', event.target.value)}
          error={errors['billingAddress.state']}
          className={inputClassName}
        />
        <Input
          label="Postal code"
          value={paymentData.billingAddress?.postalCode ?? ''}
          onChange={(event) => updateBillingField('postalCode', event.target.value)}
          className={inputClassName}
        />
        <Input
          label="Billing country"
          value={paymentData.billingAddress?.country ?? ''}
          onChange={(event) => updateBillingField('country', event.target.value)}
          error={errors['billingAddress.country']}
          className={inputClassName}
        />
      </div>
    );
  };

  return (
    <div
      className={`space-y-6 rounded-[28px] border ${
        compact
          ? 'border-fuchsia-200/80 bg-white/72 p-4 shadow-[0_16px_36px_rgba(217,70,239,0.08)] dark:border-fuchsia-400/20 dark:bg-white/[0.04]'
          : 'border-white/60 bg-white/62 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-white/[0.025]'
      }`}
    >
      <div className="space-y-1">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-500 dark:text-fuchsia-300">
          Payment details
        </p>
        <h3 className="text-lg font-bold text-slate-950 dark:text-white">
          Complete the details for Paystack
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Threadly only collects the customer and billing data needed before handing off to
          Paystack.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Payer email"
          type="email"
          value={paymentData.email}
          onChange={(event) => updateField('email', event.target.value)}
          error={errors.email}
          required
          className={inputClassName}
        />
        <Input
          label="Payer phone"
          type="tel"
          value={paymentData.phone}
          onChange={(event) => updateField('phone', event.target.value)}
          error={errors.phone}
          required
          helperText={`Shipping phone on file: ${shippingAddress.phone || 'none yet'}`}
          className={inputClassName}
        />
      </div>

      <div className="space-y-4">
        <UniversalSelect
          label="Paystack channel"
          value={paymentData.channel}
          onChange={(value) => updateField('channel', value as PaystackPaymentData['channel'])}
          options={[
            {
              value: 'CARD',
              label: 'Card checkout',
              description:
                'Paystack collects card and issuer verification on the hosted payment page.',
            },
            {
              value: 'BANK_TRANSFER',
              label: 'Bank transfer',
              description:
                'Paystack shows the transfer account details on the hosted checkout page.',
            },
          ]}
          error={errors.channel}
          className={selectClassName}
        />
        <div className={infoCardClassName}>
          <p className="font-semibold text-slate-900 dark:text-white">
            {paymentData.channel === 'BANK_TRANSFER'
              ? 'Hosted transfer instructions'
              : 'Hosted secure checkout'}
          </p>
          <p className="mt-1">
            {paymentData.channel === 'BANK_TRANSFER'
              ? 'Threadly will redirect you to Paystack, where the exact bank-transfer instructions and reference will be displayed.'
              : 'Threadly does not collect card PAN, CVV, OTP, or 3DS data in this form. Paystack handles those steps on the hosted payment page.'}
          </p>
        </div>
      </div>

      <div className="space-y-4 rounded-[24px] border border-dashed border-slate-200/80 p-4 dark:border-white/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Billing address</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Billing data helps with receipts, fraud checks, and payment follow-up where the
              gateway requires it.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={paymentData.billingSameAsShipping}
              onChange={(event) => updateField('billingSameAsShipping', event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-fuchsia-500 focus:ring-fuchsia-500/30"
            />
            Same as shipping
          </label>
        </div>
        {renderBillingAddress()}
      </div>

      <label className="flex items-start gap-3 rounded-[22px] border border-slate-200/80 bg-white/70 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
        <input
          type="checkbox"
          checked={paymentData.consentAccepted}
          onChange={(event) => updateField('consentAccepted', event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-fuchsia-500 focus:ring-fuchsia-500/30"
        />
        <span>
          I confirm these payment details are correct, and I understand this payment can require
          issuer verification, gateway redirects, or delayed confirmation before the order is
          fulfilled.
          {errors.consentAccepted ? (
            <span className="mt-1 block text-xs text-red-500">{errors.consentAccepted}</span>
          ) : null}
        </span>
      </label>
    </div>
  );
};

export default PaymentDetailsSection;
