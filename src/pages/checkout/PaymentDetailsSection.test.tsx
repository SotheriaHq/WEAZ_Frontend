import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PaystackPaymentData } from '@/api/StoreApi';
import PaymentDetailsSection from './PaymentDetailsSection';

describe('actual-payment card addition', () => {
  it('selects secure new-card payment and saving without collecting a standalone card fingerprint', () => {
    let data = { channel: 'CARD', email: 'owner@example.test', phone: '+2348000000000', useSavedCard: true, savedCardId: 'previous-card', saveNewCard: false } as PaystackPaymentData;
    render(<PaymentDetailsSection paymentData={data} shippingAddress={{} as never} errors={{}} onChange={update => { data = update(data); }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Use and save a new card during this payment' }));
    expect(data.useSavedCard).toBe(false);
    expect(data.savedCardId).toBeFalsy();
    expect(data.saveNewCard).toBe(true);
    expect(screen.queryByLabelText(/card number/i)).not.toBeInTheDocument();
    expect(screen.getByText(/no standalone verification charge/i)).toBeVisible();
  });
});
