# WIEZ Payment, Billing, and Settlement Policy

Version: `2026.08.22-v1.0`  
Effective Date: August 22, 2026  
Governing Entities: WIEZ Technology Ltd. (Nigeria) & Global Operating Affiliates  
Billing & Payments Desk: `payments@wiez.com` / `billing@wiez.com`  
Disputes & Escrow Desk: `disputes@wiez.com`

---

## 1. Scope, Purpose, and Mandatory Acceptance

This Payment, Billing, and Settlement Policy ("Policy") governs all financial transactions, checkout initializations, payment authorizations, escrow custody, currency conversions, merchant payouts, refunds, reversals, and chargebacks executed across the WIEZ ecosystem (including the web platform at `wiez.com`, iOS and Android mobile applications, and API endpoints).

In accordance with our platform architecture, **all buyers and brands must accept this Policy prior to initializing checkout sessions or receiving merchant settlements**. This document functions in tandem with the [Terms and Conditions](file:///c:/Users/UTL_ADMIN/Desktop/Shawn/threadly/docs/legal/user-facing/01_TERMS_AND_CONDITIONS.md) and [Seller and Brand Terms](file:///c:/Users/UTL_ADMIN/Desktop/Shawn/threadly/docs/legal/user-facing/05_SELLER_BRAND_TERMS.md).

---

## 2. Integrated Payment Providers and PCI-DSS Security Architecture

WIEZ partners with internationally regulated, PCI-DSS Level 1 certified payment processors to facilitate secure, encrypted monetary transactions:

* **Paystack (A Stripe Company)**: Primary payment gateway for Nigerian and West African transactions (Debit/Credit Cards, Direct Bank Transfer, USSD, Apple Pay);
* **Flutterwave**: Pan-African and cross-border currency processing (Mobile Money, Virtual Accounts, International Cards);
* **Stripe**: International card payments (Visa, Mastercard, American Express) and global multi-currency settlements.

### 2.1. Zero Raw Cardholder Data Storage (PCI-DSS Compliance)
WIEZ operates on a **zero-knowledge cardholder architecture**:
* WIEZ servers, databases, and client applications **never capture, process, transmit, or store raw Primary Account Numbers (PAN), CVV security codes, or card PINs**;
* All card entry forms are rendered in secure, sandboxed iframes or mobile WebBrowser SDK containers hosted directly by our PCI-DSS Level 1 certified gateways;
* WIEZ retains only non-sensitive tokenized authorization references (`SavedPaymentMethod`), issuing bank identifiers, card brand labels, and masked display strings (e.g., `**** **** **** 4242`).

---

## 3. Supported Payment Methods and Payment Channel Workflows

WIEZ supports multiple payment channels to ensure frictionless, secure checkout:

| Payment Channel | Technical Workflow | Confirmation Mechanism |
|---|---|---|
| **Debit & Credit Cards** | Visa, Mastercard, Verve, American Express via hosted 3D-Secure 2.0 gateway | Instant gateway authorization webhook |
| **Virtual Bank Transfer** | Dynamic, dedicated NIP virtual account number generated per checkout session | Automated settlement notification via interbank switch (30-min expiry) |
| **USSD Banking** | Dynamic bank USSD dial string (e.g., `*737*...#` or `*894*...#`) | Real-time USSD push confirmation webhook |
| **Mobile Money** | Pan-African mobile wallets (M-Pesa, MTN MoMo, Airtel Money) | Mobile wallet authorization push |
| **Apple Pay / Google Pay** | Biometric tokenized mobile device authorization | Instant hardware enclave token exchange |

---

## 4. Multi-Currency Processing and Cryptographic Exchange Rate Snapshots

### 4.1. Supported Currencies
WIEZ accepts payments globally. Supported checkout display currencies include Nigerian Naira (NGN), United States Dollars (USD), Euros (EUR), and British Pounds (GBP).

### 4.2. Cryptographic Exchange Rate Snapshots
To protect buyers and sellers from intra-session foreign exchange volatility:
* When a buyer selects an international currency, WIEZ generates a cryptographically signed **Exchange Rate Snapshot (`ExchangeRateSnapshot`)** locked to real-time interbank mid-market rates;
* The exchange rate is guaranteed and **locked for exactly 15 minutes** from checkout session initialization;
* If the checkout session is not completed within 15 minutes, the snapshot expires and the basket total recalibrates to prevailing live market rates prior to final card authorization.

---

## 5. Escrow Architecture and Fund Settlement Engine

To eliminate commercial fraud and guarantee buyer protection, WIEZ deploys an automated dual-track escrow engine (`StandardOrderEscrowService` and `CustomOrderFinanceSyncService`):

```
[ Buyer Completes Checkout ] ──► [ Funds Locked in Escrow Bank Account ]
                                            │
        ┌───────────────────────────────────┴───────────────────────────────────┐
        ▼                                                                       ▼
[ Ready-to-Wear Standard Orders ]                           [ Bespoke Custom Commissions ]
  • 100% funds held in escrow                                 • 60% Upfront Material Deposit
  • Carrier delivery confirmed                                  released upon sketch/measurement
  • 72-Hour Buyer Inspection Window                             milestone approval
  • Auto-release to Brand payout                              • 40% Final Balance held in escrow
    balance upon window expiry                                • Released upon delivery + 72h
                                                                fit inspection expiry
```

### 5.1. Standard Ready-to-Wear Orders
* 100% of order funds remain in neutral banking escrow throughout fulfillment;
* Funds are released to the Brand's available balance only after carrier delivery is confirmed and the **72-hour buyer inspection window** expires without an active dispute.

### 5.2. Custom Bespoke Apparel Orders
* **Milestone 1 (60% Upfront Production Allocation)**: Released to the Brand upon mutual agreement on custom garment sketches, measurements, and fabric acquisition;
* **Milestone 2 (40% Final Fulfillment Allocation)**: Held in escrow and released to the Brand upon confirmed delivery and successful expiry of the 72-hour fit inspection window.

---

## 6. Payout Disbursements, Schedules, and Minimum Thresholds

Brands manage accrued earnings via the WIEZ Brand Dashboard:
1. **Minimum Payout Threshold**: The minimum requestable payout amount is **₦5,000 NGN** (or foreign currency equivalent);
2. **Payout Methods**: Direct automated clearing house (ACH/NIP) bank transfer to verified Nigerian bank accounts; international wire or Stripe Connect transfers for global brands;
3. **Processing Timelines**: Payout requests initiated before 12:00 PM WAT on business days are processed within **24 to 48 banking hours**;
4. **Pre-Payout Verification**: Brands must possess `APPROVED` KYC verification status and valid tax information before payout requests are disbursed.

---

## 7. Platform Commission, Transaction Fees, and Taxes

1. **Platform Commission**: WIEZ assesses a platform commission of **8% to 10%** on ready-to-wear products and **10% to 12%** on custom bespoke commissions, deducted automatically upon escrow settlement;
2. **Payment Gateway Processing Surcharges**: Standard merchant processing fees levied by Paystack, Flutterwave, or Stripe are deducted from the gross transaction value;
3. **Logistics Pass-Through**: Third-party courier and delivery fees collected from buyers pass through 100% to the designated logistics provider without platform commission deduction;
4. **Tax Obligations**: Brands operate as independent merchants of record and remain solely responsible for calculating, reporting, and remitting applicable corporate income and business taxes to relevant statutory authorities.

---

## 8. Cancellation, Refund, and Reversal Policy

### 8.1. Buyer Order Cancellations
* **Ready-to-Wear Orders**: Buyers may cancel an order for an immediate 100% refund at any point **prior to carrier dispatch**;
* **Custom Bespoke Orders**: Once the 60% production milestone is approved and fabric cutting commences, the 60% material deposit becomes non-refundable. If cancelled prior to shipment, the remaining 40% escrow balance is refunded to the buyer.

### 8.2. Refund Processing SLAs
* Approved refunds are credited directly back to the original payment source (card, bank account, or wallet);
* **Processing Timelines**: In-app authorization occurs within **24 hours**; interbank settlement credit typically appears on the cardholder's statement within **5 to 10 business days**, depending on the issuing bank.

---

## 9. Chargebacks, Payment Reversals, and Merchant Liability

1. **Cardholder Inquiries**: When a buyer initiates an official chargeback or payment reversal through their issuing bank, WIEZ's Fraud & Dispute Desk temporarily freezes the disputed transaction funds in the Brand's account;
2. **Evidence Submission**: The Brand has **5 business days** to submit conclusive fulfillment proof (carrier tracking slips, proof of delivery, buyer fit sign-off, or chat logs);
3. **Chargeback Adjudication**: If the chargeback is sustained in favor of the cardholder due to merchant fault (non-delivery, counterfeit product, unrectified fit defect), the disputed sum plus an administrative chargeback fee of **₦3,500 NGN ($15 USD)** is debited from the Brand's balance;
4. **Anti-Fraud Protections**: Fraudulent chargebacks filed by buyers who received verified deliveries will result in immediate permanent buyer account termination, negative credit bureau reporting, and civil litigation referral.

---

## 10. Subscription and Membership Model Framework

* **Current Operational Model**: As of Version 2026.08.22, WIEZ operates exclusively on an **escrow-backed per-transaction commission model**. WIEZ does **not** charge recurring monthly consumer subscription fees or buyer membership dues;
* **Future Subscription Services**: In the event WIEZ introduces optional premium designer tools, specialized brand analytics subscriptions, or buyer VIP tiers, such services will be governed by explicit opt-in terms detailing recurring billing frequencies, 30-day renewal notices, pro-rated cancellation rights, and self-service billing management dashboards.

---

## 11. Security, Webhook Verification, and Idempotency

1. **Cryptographic Webhook Signatures**: All communication between external payment gateways (Paystack/Flutterwave/Stripe) and WIEZ backend servers is authenticated via HMAC-SHA512 cryptographic signature verification to prevent spoofing;
2. **Idempotency Safeguards**: All checkout initializations and payment capture requests utilize unique UUID v4 idempotency keys (`IdempotencyKey`) to prevent double-charging in the event of network dropouts, app restarts, or duplicate button taps.

---

## 12. Policy Modifications and Fee Adjustments

WIEZ reserves the right to amend payment methods, minimum payout thresholds, or fee structures. In the event of material changes:
* We will update the `Version` and `Effective Date` at the top of this Policy;
* Registered Brands and active merchants will receive at least **14 calendar days' advance notice** via registered email;
* Continued commercial activity after the effective date constitutes full acceptance of the updated terms.

---

## 13. Contact Directory and Payment Inquiries

For billing escalations, payout inquiries, chargeback defense, and payment verification support:

* **Billing & Payments Desk**: `payments@wiez.com` / `billing@wiez.com`
* **Escrow & Transaction Disputes**: `disputes@wiez.com`
* **Merchant Success Team**: `brands@wiez.com`
* **Corporate Legal Desk**: `legal@wiez.com`
* **Mailing Address**:  
  **WIEZ Technology Ltd.**  
  Attn: Finance & Payment Operations  
  12B Admiralty Way, Lekki Phase 1,  
  Lagos, Nigeria  
* **Payment Support Portal**: [wiez.com/help/payments](https://wiez.com/help/payments)

