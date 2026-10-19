# WIEZ Payment, Billing, and Settlement Policy

Version: `2026.10.19-v1.5`

Effective Date: October 19, 2026

Governing Entities: WIEZ Technology Ltd. (Nigeria) & Global Operating Affiliates

Billing & Payments Desk: `payments@wiez.com` / `billing@wiez.com`

Disputes & Escrow Desk: `disputes@wiez.com`

---

## 1. Scope, Purpose, and Mandatory Acceptance

This Payment, Billing, and Settlement Policy ("Policy") governs all financial transactions, checkout initializations, payment authorizations, escrow custody, currency conversions, merchant payouts, refunds, reversals, and chargebacks executed across the WIEZ ecosystem (including the web platform at `wiez.com`, iOS and Android mobile applications, and API endpoints).

In accordance with our platform architecture, **all buyers and brands must accept this Policy prior to initializing checkout sessions or receiving merchant settlements**. This document functions in tandem with the [Terms and Conditions](/terms) and [Seller and Brand Terms](/seller-terms).

---

## 2. Integrated Payment Providers and PCI-DSS Security Architecture

WIEZ partners with internationally regulated, PCI-DSS Level 1 certified payment processors to facilitate secure, encrypted monetary transactions:

* **Paystack (a Stripe company)**: our payment gateway for all transactions — debit and credit cards, direct bank transfer, and USSD.

Paystack is currently the only gateway processing live payments on WIEZ. Where these Policies refer to "your payment provider", they mean Paystack. We will update this section before routing payments through any additional processor.

### 2.1. Zero Raw Cardholder Data Storage (PCI-DSS Compliance)
WIEZ operates on a **zero-knowledge cardholder architecture**:
* WIEZ servers, databases, and client applications **never capture, process, transmit, or store raw Primary Account Numbers (PAN), CVV security codes, or card PINs**;
* All card entry forms are rendered in secure, sandboxed iframes or mobile WebBrowser SDK containers hosted directly by our PCI-DSS Level 1 certified gateways;
* WIEZ retains only non-sensitive tokenized authorization references (`SavedPaymentMethod`), issuing bank identifiers, card brand labels, and masked display strings (e.g., `**** **** **** 4242`).

### 2A. Payment Failure, Retry, and Order Expiration Logic
* **Automated Gateway Retry Safeguards**: If an initial card authorization attempt fails due to transient issuer timeouts or 3D-Secure dropouts, our checkout engine permits up to three (3) re-authorization attempts within the active session.
* **Virtual Account & USSD Expiration**: For virtual bank transfer and USSD checkouts, dedicated payment accounts remain valid for exactly **thirty (30) minutes**. If payment confirmation is not received via webhook within this 30-minute window, the checkout session automatically expires and reserved inventory is released back to the merchant's catalog.
* **Duplicate Charge Protection**: In the rare event a buyer's account is debited after an order session has expired, our automated webhook reconciliation system detects the orphan payment and issues an automatic reversal within twenty-four (24) hours.


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

Completing checkout captures payment and records held amounts in the settlement ledger. An internal hold does not establish a separately protected bank escrow; actual custody/settlement follows the provider arrangement. What happens next depends on what was bought.

**Ready-to-wear standard orders**

* 100% of the funds are held in escrow;
* carrier delivery is confirmed;
* the 72-hour buyer inspection window runs;
* the balance is released automatically to the Brand's payout balance when that window expires.

**Bespoke custom commissions**

* the 60% garment production allocation cannot become available until Active under the existing settlement controls;
* the 40% final balance stays in escrow;
* it is released on delivery, once the 72-hour fit inspection window expires.

### 5.1. Standard Ready-to-Wear Orders
* 100% of order funds remain in neutral banking escrow throughout fulfillment;
* Funds are released to the Brand's available balance only after carrier delivery is confirmed and the **72-hour buyer inspection window** expires without an active dispute.

### 5.2. Custom Bespoke Apparel Orders
* **Milestone 1 (60% Upfront Production Allocation)**: Eligible only once the queued order becomes Active, with the existing verification, financial, debt and dispute controls; no Pending/Up Next release;
* **Milestone 2 (40% Final Fulfillment Allocation)**: Held in escrow and released to the Brand upon confirmed delivery and successful expiry of the 72-hour fit inspection window.

### 5.3. Effect of an Approved Production Extension on Escrow
Where a buyer grants a Brand additional production time (Terms of Service Section 7.6; a maximum of two approved extensions, three days each, six days in total, and never on an order carrying a rush fee), the escrow schedule moves with the order rather than against it:

* the production, dispatch and delivery dates move by the number of days granted;
* the buyer's 72-hour inspection window and the administrative auto-release date move by the same number of days, so **no milestone can become payout-eligible while the garment is still in production**;
* the measurement retention period moves with the order, so the record supporting any later dispute remains available for the extended term;
* the originally promised dates are retained on the order and remain the reference point for assessing Brand performance and for any delay claim.

A **declined** or **expired** extension request changes nothing about the escrow schedule. Declining is not a refund request; it opens a dispute, which freezes disbursement under Section 8 in the ordinary way.

---

## 6. Payout Disbursements, Schedules, and Minimum Thresholds

Brands manage accrued earnings via the WIEZ Brand Dashboard:
1. **Minimum Payout Threshold**: The minimum requestable payout amount is **₦5,000 NGN** (or foreign currency equivalent);
2. **Payout Methods**: Direct automated clearing house (ACH/NIP) bank transfer to verified Nigerian bank accounts; international payouts for global brands are not currently supported;
3. **Processing Timelines**: Payout requests initiated before 12:00 PM WAT on business days are processed within **24 to 48 banking hours**;
4. **Pre-Payout Verification**: Brands must possess `APPROVED` KYC verification status and valid tax information before payout requests are disbursed.

---

## 7. Platform Commission, Transaction Fees, and Taxes

1. **Platform Commission**: WIEZ assesses a platform commission of **8% to 10%** on ready-to-wear products and **10% to 12%** on custom bespoke commissions, deducted automatically upon escrow settlement;
2. **Payment Gateway Processing Surcharges**: Standard merchant processing fees levied by Paystack, or by any additional gateway we may add, are passed througe are deducted from the gross transaction value;
3. **Logistics Pass-Through**: Third-party courier and delivery fees collected from buyers pass through 100% to the designated logistics provider without platform commission deduction;
4. **Tax Obligations**: Brands operate as independent merchants of record and remain solely responsible for calculating, reporting, and remitting applicable corporate income and business taxes to relevant statutory authorities.

---

## 8. Cancellation, Refund, and Reversal Policy

### 8.1. Buyer Order Cancellations
New-policy Pending/Up Next orders use the itemized pre-Active deductions in the subscription queue terms below, regardless of cancellation actor. The following production-stage rule applies only after Active and remains subject to mandatory remedies.
* **Ready-to-Wear Orders**: Buyers may cancel an order for an immediate 100% refund at any point **prior to carrier dispatch**;
* **Custom Bespoke Orders**: Once the 60% production milestone is approved and fabric cutting commences, the 60% material deposit becomes non-refundable. If cancelled prior to shipment, the remaining 40% escrow balance is refunded to the buyer.

### 8.2. Multi-Stage Refund Processing Timelines
Refunds follow separate platform, processor and bank-credit stages. The timing below is indicative, not a guarantee of instant or fixed-date bank credit. A requested or processing refund is not a completed refund:
* **Stage 1 (WIEZ Platform Authorization — within 24 hours)**: The WIEZ Dispute & Escrow Desk reviews the case and issues a cryptographically signed refund authorization payload to the payment gateway within twenty-four (24) hours of dispute resolution;
* **Stage 2 (Gateway & Settlement Processing — 24 to 48 hours)**: The payment provider (Paystacke) processes the reversal through the interbank switching network (`DEFAULT_SEED_SETTLEMENT_DELAY_HOURS = 48`);
* **Stage 3 (Cardholder Bank Statement Credit — 5 to 10 business days)**: Depending on the cardholder's issuing bank and card scheme (Visa, Mastercard, Verve), the credit reflection typically appears on the account statement within five (5) to ten (10) banking days from gateway transmission.


---

## 9. Chargebacks, Payment Reversals, and Merchant Liability

1. **Cardholder Inquiries**: When a buyer initiates an official chargeback or payment reversal through their issuing bank, WIEZ's Fraud & Dispute Desk temporarily freezes the disputed transaction funds in the Brand's account;
2. **Evidence Submission**: The Brand has **5 business days** to submit conclusive fulfillment proof (carrier tracking slips, proof of delivery, buyer fit sign-off, or chat logs);
3. **Chargeback Adjudication**: If the chargeback is sustained in favor of the cardholder due to merchant fault (non-delivery, counterfeit product, unrectified fit defect), the disputed sum plus an administrative chargeback fee of **₦3,500 NGN ($15 USD)** is debited from the Brand's balance;
4. **Anti-Fraud Protections**: Fraudulent chargebacks filed by buyers who received verified deliveries will result in immediate permanent buyer account termination, negative credit bureau reporting, and civil litigation referral.

---

## 10. Subscription and Membership Model Framework

WIEZ offers the recurring monthly brand custom-order subscriptions described below. No recurring shopper membership is created by a queue purchase. Subscription payment, authorization and invoices are separate from shopper garment payments and brand order earnings.

---

## 11. Security, Webhook Verification, and Idempotency

1. **Cryptographic Webhook Signatures**: All communication between external payment gateways (Paystack) and WIEZ backend servers is authenticated via HMAC-SHA512 cryptographic signature verification to prevent spoofing;
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

---

## Custom-order subscription queue terms

### Subscription custom-order policy scope and consumer rights

The subscription queue rules in this document apply to new custom-order queue purchases and subscription agreements shown and accepted under version `2026.10.19-v1.5`. Existing orders retain their recorded policy and payment snapshots; ready-to-wear rules are unchanged. Required notice of material changes remains applicable. Nothing here waives mandatory consumer rights, statutory refunds or access to the competent regulator or courts. Where mandatory law requires a different refund, that right prevails. [FCCPC consumer rights](https://fccpc.gov.ng/consumers/consumer-rights-responsibilities/rights-responsibilities/) explains cancellation rights and reasonable charges.

### Paid waiting queue, timing and priority

Custom-order payment is captured once at placement. Pending and Up Next funds remain held and unavailable as brand earnings until Active; Up Next is a notice and position, never a second garment charge. There is one Up Next seat. Active production and rush times begin at activation, not during waiting; queue position is not a delivery guarantee. Standard garment earnings follow the existing 60% production / 40% completion calculation, with no production release before Active and with existing dispute, verification and payout controls preserved. An internal held balance is an accounting restriction, not a representation of a separately protected bank escrow or provider deposit guarantee.

Ordinary Pending orders are FIFO. Only an Aru or Igwe brand that opts in may offer a paid jump. The separately disclosed fee is 20% of garment subtotal. It buys priority behind the current Up Next and earlier paid jumps, without displacing Up Next. When ordinary eligible orders are waiting, at most two paid-priority orders activate consecutively before one ordinary order. There is no paid jump offer when it provides no priority benefit. Of an earned jump fee, WIEZ receives 10% and the brand 90%; no brand share is earned before Active. Existing duplicate-source restrictions remain; ordering different items from one brand is permitted subject to ordinary checks.

Both Pending and Up Next expire 42 x 24 hours after committed paid placement. Cards and details show the cancellation countdown and exact deadline. One retain is permitted from 48 hours through exactly 12 hours remaining, inclusive, adding 42 days to the existing deadline while preserving priority. It is unavailable outside that window or after use, activation or cancellation. Shopper and brand reminders are scheduled at 48, 24 and 5 hours. **No outage grace applies:** failed notifications, unavailable notices or a WIEZ outage do not extend the cancellation deadline. The 5-hour notice does not reopen retain.

An admin may demote Up Next to Pending with a visible promotion hold. The hold stays until an admin releases it; it does not pause expiry, cancellation rights or the eligible retain window. Ordinary intake closure stops new purchases while already-paid obligations continue. Safety suspension stops promotion and unreleased payouts pending admin review. Removing a listing does not remove paid order snapshots or obligations. A capture completed after eligibility changes remains recorded and is resolved through the applicable cancellation/refund process.

### Cancellation charges, refund status and resubmission

Before Active, the shopper, brand, authorized admin or expiry process may cancel Pending or Up Next. **The same disclosed deductions apply to every such cancellation, including cancellation by the brand, admin or system:** the VAT actually recorded on the original payment, 10% of garment subtotal excluding VAT/delivery/jump fee, and 10% of any jump fee. Delivery is refunded in full and 90% of the jump fee is refunded. A missing VAT component means zero VAT deduction; this policy creates no VAT rate or new tax. There is no duplicate platform-share deduction on the jump fee and the brand earns no pre-Active jump share.

The server presents an itemized quote for confirmation and checks eligibility again before cancellation. Example: garment NGN100,000 + recorded VAT NGN7,500 + delivery NGN5,000 + jump NGN20,000 totals NGN132,500. Deductions total NGN19,500 and the refund is NGN113,000. This is an illustration using an existing VAT line, not a tax-rate promise. Mandatory statutory remedies prevail where applicable.

Cancellation records a refund request; it does not mean the bank has credited the shopper. Orders show requested, processing, processed, failed or attention-required status as appropriate. Provider processing and bank credit are distinct; bank receipt may take additional business days. Cancelling one line in mixed checkout does not cancel or refund sibling orders. No repeated request creates a second refund. After Active, existing dispute/admin cancellation, defect and delivery remedies apply.

Cancelled history, receipt, deductions, refund progress and permitted order messaging remain accessible. A resubmission is a separately priced new order at the back of the current queue, with current source, measurements, intake and payment checks. It may be placed while the previous refund is processing, but requires **a separate payment**; the pending refund is not wallet credit and continues independently. A new order does not inherit the old position or a free jump.

### Brand subscriptions, billing changes and campaigns

| Tier | Monthly NGN | Active cap | Delivery cap | Up Next | Pending | Paid jump offer |
|---|---:|---:|---:|---:|---|---|
| Thread | 10,000 | 2 | 2 | 1 | Unlimited | No |
| Aso-oke | 15,000 | 3 | 4 | 1 | Unlimited | No |
| Aru | 30,000 | 4 | 5 | 1 | Unlimited | Brand opt-in |
| Igwe | 50,000 | 6 | 5 | 1 | Unlimited | Brand opt-in |

These are recurring monthly brand subscriptions, requiring express recurring-payment authorization; they are not shopper memberships. New brands cannot receive custom orders before first verified payment. Existing eligible brands retain free unlimited Legacy capacity until a paid assignment succeeds; Legacy is not a sold tier and does not include paid jumps. Failed initial or switch payments never create free paid-tier access or erase the previous valid entitlement.

Existing agreements retain their agreed price snapshot on renewal; a new agreement or tier change uses current pricing. An upgrade applies immediately after verified payment of the difference prorated over the remaining billing period. A downgrade applies at the next renewal, with no refund for the current period. The monthly billing anniversary remains unchanged; a missing calendar day falls back to that month's last day. Billing dates are displayed in Lagos time (Africa/Lagos). Confirm the amount, renewal and effective capacity before payment.

Voluntary cancellation stops future renewal; access remains through the paid-period end. At paid-period expiry, new intake pauses, while already-paid obligations continue. A failed renewal has seven days to recover at the existing locked price, with authorized retries on days 1, 3 and 7. This recovery window does not grant free intake. After it ends, a new subscription uses current prices. Payment-method authorization, billing receipts and invoice history remain available through billing support and the billing workspace.

Only one global capacity campaign may be active at a time. An automatic campaign ends at its exact configured deadline; a manual campaign remains effective until reset and is labelled accordingly. A brand-specific override wins over tier/campaign capacity and may have an expiry or be removed manually. Reduced capacity preserves existing work and pauses additional promotions until capacity permits. Runway notices, including notices called a free-order period, are informational and grant no financial discount or capacity change without explicit configuration. More than five brand cancellations of waiting orders in one action or a rolling 24 hours raises an admin attention alert; it does not automatically suspend the brand.


### Original-payment conversion for custom-order refunds

When the original custom-order payment was converted into a different provider currency, its refund uses the original payment's recorded exchange-rate snapshot. WIEZ records the refund conversion, currency and provider amount for reconciliation; later exchange-rate changes do not reprice the refund. Shared-payment refunds use cumulative minor-unit rounding so their total cannot exceed the captured amount. If the original conversion cannot be verified, cancellation remains recorded and the refund requires reconciliation before provider submission. The refund quote identifies any estimated converted amount; provider processing and bank credit remain separate.

An agreed post-Active partial dispute refund returns only the agreed amount. The order continues in its existing production/delivery lane. Each refund is recorded separately, repeat requests cannot duplicate it, and any later full remedy refunds only the remaining refundable balance. Future milestone earnings are reduced for the refunded share; no held milestone becomes payable because of a partial refund.

### Billing workspace, saved cards and notice controls

Settings → Billing & subscriptions provides plan comparisons, verified prorated upgrades, renewal cancellation, separate billing and subscription history, and saved-payment controls. The UPGRADE action returns owners to this workspace; its back action returns to Studio. Ordinary subscription cancellation stops renewal and does not refund the current paid period. This does not alter compensation for duplicate or unapplied captures.

A successful authenticated reusable-card payment saves a provider authorization securely for future selection. Brands may select their existing checkout cards for subscription payments, subject to explicit recurring-payment consent. New cards are added only during an actual checkout or subscription payment; WIEZ charges no standalone card-verification fee. Card editing covers nickname and default selection. Replacing a card number, expiry or security details requires secure provider payment entry. No raw card number, CVV or PIN is stored by these settings. A default checkout card does not automatically change the subscription renewal card; an owner must explicitly authorize that change. Updating a renewal card does not restart cancelled renewal.

A card required for automatic renewal cannot be deleted until the owner selects a replacement renewal card or stops renewal. A payment already processing must be verified before its card is removed. Deletion disables saved reuse and removes its stored checkout authorization; it does not remove historical financial receipts or cancel an already authorized payment. Previously deleted cards are not restored by historical backfill; a new authenticated payment may save the card again. The payer identity recorded for each payment attempt remains unchanged when a renewal card or account email is later changed.

Upgrade notices are dismissible and link to plan review. Login and Studio share one server-enforced 24-hour notice limit per owner and brand across web/native. No-subscription owners are offered Thread; Thread → Aso-oke → Aru → Igwe follows the next-tier sequence. Current Igwe and free Legacy brands receive no automatic notice. Subscription levels are not public.
