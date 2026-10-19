# WIEZ Seller and Brand Terms

Version: `2026.10.19-v1.5`

Effective Date: October 19, 2026

Governing Entities: WIEZ Technology Ltd. (Nigeria) & Global Operating Affiliates

Seller Support & Merchant Desk: `brands@wiez.com` / `disputes@wiez.com`

Merchant Verification Desk: `kyc@wiez.com`

---

## 1. Scope, Contractual Framework, and Merchant Eligibility

These Seller and Brand Terms ("Seller Terms") constitute a legally binding agreement between **WIEZ Technology Ltd.** ("WIEZ", "we", "us", or "our") and any fashion designer, bespoke tailor, apparel manufacturer, brand owner, or authorized merchant ("Brand", "Seller", or "you") who opens, publishes, manages, or operates a digital storefront, sells ready-to-wear products, publishes runway showcases, or accepts custom bespoke commissions across the WIEZ ecosystem.

By submitting a digital storefront application, completing KYC merchant onboarding, uploading product listings, or accepting customer orders, you agree to be bound by these Seller Terms, the [Terms and Conditions](/terms), [Community Guidelines](/community-guidelines), and [Payment and Billing Policy](/payment-policy).

---

## 2. Merchant Onboarding and Mandatory 5-Point KYC Verification

To preserve marketplace security, combat fraud, and comply with Central Bank of Nigeria (CBN) regulations and the Special Control Unit Against Money Laundering (SCUML) under the Money Laundering (Prevention and Prohibition) Act 2022, all Brands must undergo mandatory identity and capability verification before publishing storefronts or receiving escrow disbursements.

1. **Digital application and profile setup.**
2. **Five-point document and workshop submission**:
    1. Workshop photo 1 (production facility or machinery);
    2. Workshop photo 2 (raw materials or cutting tables);
    3. Government ID / NIN (`verificationNinKey`);
    4. Business registration / CAC certificate (`verificationCacKey`);
    5. Physical workshop address and production volume.
3. **WIEZ merchant verification review**, within a 24–72 hour SLA, closing one of two ways:
    * **Approved**: your storefront goes live and payouts are enabled;
    * **Rejected**: you receive a written reason and a 7-day resubmission window.

### 2.1. Required Verification Artifacts
1. **Production Workshop Photography (2 Keys)**: Two clear, timestamped photographs demonstrating physical manufacturing capacity (sewing machines, cutting tables, tailoring equipment, and work-in-progress inventory);
2. **National Identification Number (NIN)**: Verified government-issued identity document of the primary business owner or managing director;
3. **Corporate Registration (CAC Certificate)**: Corporate Affairs Commission registration certificate (mandatory for registered companies and enterprises; sole proprietors must provide proof of business trade name where applicable);
4. **Physical Operational Address**: Verifiable workshop, studio, or boutique address subject to physical spot-checks by WIEZ field compliance officers;
5. **Production Capacity & Client Volume Estimate**: Documented monthly order fulfillment capacity and historical clientele metrics.

### 2.2. Verification Statuses
* `PENDING`: Application received and assigned to the merchant compliance queue;
* `APPROVED`: Storefront activated, product listings published to Market discovery, and settlement payouts enabled;
* `REJECTED`: Application denied due to illegible documentation, unverified identity, or insufficient workshop evidence. A specific rejection notice with remediation instructions will be sent to the registered email.

---

## 3. Brand Account Governance, Staff Permissions, and Liability

1. **Authority Warranty**: The individual registering the Brand account represents and warrants that they possess full legal authority to enter into commercial contracts on behalf of the Brand entity;
2. **Staff Role Delegations**: Brand owners may delegate administrative, catalog management, and customer support permissions to team members via the Brand Workspace (`BrandMember` roles). The Brand owner remains strictly liable for all actions, communications, listings, and contractual commitments executed by delegated staff;
3. **Security of Credentials**: Brands must enforce multi-factor authentication (MFA) across all staff accounts. WIEZ is not liable for unauthorized payouts or catalog alterations resulting from compromised merchant credentials.

### 3.1. Staff Account Lifecycle and Access Revocation
* **Staff Departures & Revocation**: When a staff member leaves the Brand's employment, the Brand owner must immediately revoke their access via the Brand Studio Workspace. WIEZ is not responsible for actions taken by former employees prior to explicit access revocation.
* **Continuity of In-Flight Custom Orders**: Active client chats, bespoke cutting commitments, and orders handled by a departed staff member remain binding legal obligations of the Brand entity.
* **Account Deletion of Staff**: If a team member requests personal account deletion, their personal data is pseudonymized while the Brand's historical order records and chat transcripts are preserved under the Brand's workspace for dispute defense.


---

## 4. Product Catalog Integrity, Sizing, and Quality Standards

### 4.1. Distinct Content Classification
Brands must maintain clear structural separation between creative showcase assets and commercial inventory:
* **Runway Designs (`/runway`)**: Showcase portfolios and creative lookbooks. Designs are non-purchasable unless explicitly linked to an active ready-to-wear product or custom commission flow;
* **Market Products (`/market`)**: Ready-to-wear physical apparel. Listings must state accurate fabric composition, care instructions, size charts, variant stock levels, and processing timelines;
* **Custom Bespoke Studio**: Commissioned, made-to-measure apparel governed by individual client milestone agreements.

### 4.2. Mandatory Sizing & Garment Fit Standards
* **Standard Ready-to-Wear**: Brands must provide comprehensive garment measurement charts in centimeters and inches adhering to international apparel standards (ISO 8559);
* **Bespoke Tailoring Fit Tolerance (±0.75 Inch Rule)**: For all custom, made-to-measure orders, finished garments must match the buyer's agreed measurement profile to within **±0.75 inches (1.9 cm)** across critical garment dimensions (bust/chest, waist, hips, sleeve length, inseam). If a custom garment deviates beyond this ±0.75 inch tolerance, the Brand is legally obligated to perform free alterations or accept a full return and escrow refund.

### 4.3. Prohibited Merchandise
Brands shall not list, manufacture, or distribute:
* Counterfeit garments, replica designer goods, or unauthorized trademarked insignia;
* Used, unhygienic, or damaged garments represented as new;
* Apparel incorporating toxic dyes, hazardous lead accessories, or banned textile chemicals;
* Stolen intellectual property, unauthorized lookbook imagery, or scraped third-party photography.

---

## 5. Platform Commission Structure and Commercial Fees

WIEZ operates a transparent transaction fee structure designed to maintain platform infrastructure, global payment processing, escrow protection, and marketplace marketing:

The buyer's gross order total is allocated in this order:

1. **Third-party shipping carrier fee**: passed through in full. WIEZ takes no commission on shipping.
2. **Standard platform commission**: 8%–12% of item merchandise value.
3. **Gateway payment processing fee**: charged by Paystack.
4. **Net merchant settlement**: the remainder, allocated to your Brand escrow balance.

### 5.1. Standard Commission Rates
* **Ready-to-Wear Market Products**: **8% to 10%** of gross merchandise value;
* **Custom Bespoke Commissions**: **10% to 12%** of agreed commission contract value (reflecting bespoke milestone escrow tracking and arbitration support);
* **Fee Calculation**: Commission is calculated solely on the garment sales price (exclusive of pass-through logistics and carrier delivery fees);
* **Fee Adjustment Notice**: WIEZ reserves the right to modify commission tiers upon giving at least **14 calendar days' written notice** to active Brands.

---

## 6. Escrow Architecture, Milestone Settlement, and Payout Schedules

All commercial transactions on WIEZ are secured by our automated escrow settlement engine (`StandardOrderEscrowService` & `CustomOrderFinanceSyncService`) to protect both merchant cash flows and buyer funds.

### 6.1. Ready-to-Wear Order Settlement Flow
1. **Order Payment**: Buyer funds are captured and held in secure banking escrow upon checkout;
2. **Fulfillment & Dispatch**: Brand dispatches the item via an integrated carrier and inputs verifiable tracking;
3. **Carrier Delivery + 72-Hour Inspection Window**: Upon confirmed carrier delivery, a **72-hour buyer inspection window** commences;
4. **Final Escrow Release**: If no dispute or non-delivery claim is lodged within 72 hours, 100% of net merchant funds are automatically credited to the Brand's available payout balance.

### 6.2. Custom Bespoke Commission Milestone Settlement
For made-to-measure custom apparel, funds are disbursed in milestone allocations:
* **Production Milestone (Upfront Material Deposit)**: **60% of net garment order value** becomes eligible only on Active, under existing settlement, account, debt and dispute controls; no pre-Active release is permitted;
* **Final Delivery Milestone**: The remaining **40% of net order value** is held in escrow and released upon buyer delivery confirmation and expiry of the 72-hour fit inspection window.

### 6.3. Payout Disbursements & Minimum Threshold
* **Minimum Payout Amount**: **₦5,000 NGN** (or USD/EUR equivalent);
* **Disbursement Frequency**: Brands may initiate automated payout requests daily or weekly once available funds exceed the minimum threshold;
* **Settlement Currencies**: Payouts are disbursed in Nigerian Naira (NGN) via direct NIP bank transfer, International merchant payouts in USD, EUR or GBP are not currently available; we will update these Terms before enabling them.

---

## 7. Rolling Reserve and Merchant Risk Management

To safeguard against sudden merchant default, unfulfilled custom orders, or high-volume chargeback surges, WIEZ may apply a **Rolling Reserve Policy**:
* **Standard Reserve**: For newly approved Brands (under 90 days active) or accounts exhibiting elevated dispute rates, WIEZ may hold **5% to 15% of gross payout earnings** in rolling reserve for a period of **30 to 60 calendar days**;
* **Reserve Release**: Reserved funds automatically transition to available payout status upon expiration of the holding period, provided no outstanding chargebacks or unfulfilled disputes exist;
* **Reserve Exemption**: Established Brands maintaining an on-time fulfillment rate above 98% and a dispute rate below 1% are exempt from rolling reserve deductions.

---

## 8. Fulfillment SLAs, Logistics, and Customer Communication

Brands must adhere strictly to platform fulfillment service-level agreements:

| Metric / Requirement | Mandatory Platform SLA | Failure Penalty |
|---|---|---|
| **Standard Order Dispatch** | Within **3 business days** of order confirmation | Automated fulfillment warning; risk of order cancellation |
| **Custom Order Milestone Updates** | Stage photo update every **5 business days** | Escrow deposit freeze; buyer cancellation right |
| **Buyer Inquiry Response Time** | Within **24 hours** via in-app messaging | Search ranking penalty; marketplace visibility throttle |
| **Tracking Number Input** | Within **12 hours** of carrier handover | Shipping delay flag |

### 8.1. Requesting Additional Production Time on a Custom Order

Where you cannot meet the production deadline recorded on a custom order, you may ask the buyer for additional time. You may not extend the deadline yourself, and WIEZ will not extend it for you. The platform enforces the following limits:

* **Maximum per request**: three (3) calendar days.
* **Maximum approved extensions**: two (2) per order.
* **Maximum total extension**: six (6) calendar days per order. Requests the buyer declines, or that expire unanswered, do not count against these limits.
* **Rush orders may never be extended.** Where the buyer paid a rush production fee, the platform will refuse an extension request on that order outright. The rush fee is consideration for a specific date; if you cannot meet it, contact WIEZ rather than the buyer.
* **One request at a time.** A further request cannot be raised while an existing one is awaiting an answer.
* **Reason required.** Each request must carry a written reason, which the buyer reads verbatim.
* **Buyer response window**: twenty-four (24) hours, or the original deadline, whichever falls first. You will be notified of the outcome.
* **Platform reminders**: WIEZ will remind you approximately 24 and 12 hours before a production deadline where no request is outstanding. A reminder is not an extension, and the absence of a reminder does not excuse a missed deadline.

Outcomes:

1. **Accepted** — your production, dispatch and delivery dates move by the days granted, together with the buyer's inspection window and your escrow release schedule. The dates originally promised are retained on the order and are visible to the buyer, to you, and to WIEZ, and remain the reference point for SLA assessment.
2. **Declined** — nothing moves. A dispute is opened under Section 9 and the order is placed under WIEZ administrative intervention. **Continue production unless WIEZ instructs you otherwise**; declining is not a cancellation.
3. **Expired unanswered** — no time is granted and the order is escalated to WIEZ for review. Silence is not consent.

Repeatedly requesting extensions, or requesting them in place of maintaining capacity, is a fulfillment-performance failure under Section 13 and may result in listing throttles, escrow holds, or store suspension.

---

### 8.2. Refund Recovery, Negative Balances, and Deduction from Future Earnings

**This section is a material commercial term. By listing on WIEZ you accept it.**

Where a buyer is entitled to a refund, **WIEZ initiates the authorized buyer refund without waiting for the Brand balance** and does not wait for you to have funds available. A shopper is never asked to wait for a Brand to be in funds, and is never asked to recover money from a Brand directly.

Where some or all of that order had already been released or paid out to you, the refunded amount is money you have already received. It becomes a **debt owed to WIEZ**, recorded against your account, and:

1. **Your balance may go negative.** A negative available balance is a normal, expected state following a refund on a released order. It is not an error.
2. **Recovery is automatic, from your subsequent earnings.** Each later release on your account is applied to your outstanding balance before anything becomes payable to you, **oldest debt first**. A release smaller than the debt pays down part of it and releases nothing to you.
3. **Payouts are suspended while a debt is outstanding.** No withdrawal may be made until the balance returns to zero or above.
4. **You will be notified** when a debt is recorded and each time earnings are applied to it. The full statement — what is owed, why, and which orders have paid down which part of it — is available in your Studio at any time.
5. **Accepting a custom order while in debt requires your express acknowledgement.** Where you owe WIEZ money, the platform will not allow you to accept a new custom commission until you confirm, for that order, that you understand its earnings will be applied to your outstanding balance before any payout. The amount outstanding at the moment you confirm is recorded against the order.
6. **Standard (ready-to-wear) orders.** Because ready-to-wear settles after delivery, a refund can still follow a released first tranche. The same recovery applies, and you will be notified of the adjustment and of any deduction applied to later orders.
7. **Debt survives.** An outstanding balance is not extinguished by closing a store, ceasing to trade, or opening a new brand account under the same ownership, and may be referred for collection where it remains unrecovered.
8. WIEZ may, at its discretion, waive a debt in whole or in part. Only a written waiver from WIEZ discharges it.

Nothing in this section limits WIEZ's rights under Section 10 (Chargebacks) or Section 13 (Enforcement).

---

## 9. Return Handling, Defect Remediation, and Fit Disputes

1. **Defective or Misdescribed Ready-to-Wear**: If a buyer receives a damaged garment, incorrect size variant, or item substantially differing from listing photography, the Brand must accept return at the Brand's shipping expense and provide a full refund;
2. **Bespoke Fit Discrepancies**: Where a custom garment violates the ±0.75 inch fit tolerance, the Brand must provide free physical alteration within **7 business days** of receiving the returned garment. If alteration is impossible, a full escrow refund will be granted to the buyer;
3. **Change-of-Mind Returns**: For ready-to-wear items, Brands may establish their own return policies (e.g., 7-day or 14-day exchange), provided such policies are prominently stated on their storefront and comply with applicable consumer protection statutes.

---

## 10. Chargebacks, Payment Reversals, and Seller Liability

1. **Chargeback Defense Window**: When a cardholder files a formal bank chargeback, WIEZ will immediately notify the Brand. The Brand must provide valid proof of fulfillment (carrier tracking, signed delivery slip, buyer chat logs, measurement approvals) within **5 business days**;
2. **Liability for Uncontested or Lost Chargebacks**: If a chargeback is sustained by the issuing bank due to non-delivery, counterfeit allegations, or severe defect, the full disputed transaction amount plus an administrative chargeback processing fee of **₦3,500 NGN ($15 USD)** will be debited from the Brand's escrow or available balance;
3. **Negative Balance Recovery**: If debiting a lost chargeback results in a negative account balance, the Brand must settle the deficit within **14 calendar days**. WIEZ reserves the right to offset deficits against future earnings or initiate legal debt recovery.

---

## 11. Intellectual Property Warranties and Indemnification

1. **Originality Guarantee**: The Brand warrants that all fashion designs, sketches, garment cuts, lookbook photographs, and brand names uploaded to WIEZ do not infringe any third-party patent, trademark, copyright, or industrial design right;
2. **Indemnification**: The Brand agrees to defend, indemnify, and hold harmless WIEZ Technology Ltd., its officers, directors, employees, and agents from any claims, damages, liabilities, costs, and legal fees arising from:
   * Allegations of copyright, trademark, or design patent infringement;
   * Product liability claims relating to garment injury, defective dyes, or fabric hazards;
   * Brand breach of consumer protection laws, tax statutes, or fulfillment commitments.

---

## 12. Non-Circumvention and Off-Platform Transaction Prohibition

To protect platform integrity, escrow safeguards, and commercial trust:
1. **Prohibited Off-Platform Transactions**: Brands shall not solicit, encourage, or instruct WIEZ buyers to complete payments, custom commissions, or communications off-platform (e.g., requesting direct bank transfers, WhatsApp checkout, or external payment links);
2. **Enforcement for Circumvention**: Any Brand attempting to divert transactions off-platform will be subject to immediate storefront suspension, forfeiture of pending promotional balances, and a contractual liquidated damages assessment equal to **20% of the diverted transaction value** or **₦50,000 NGN**, whichever is greater.

---

## 13. Enforcement, Store Suspension, and Termination

WIEZ enforces a calibrated 5-level merchant disciplinary framework:

1. **Level 1 — formal compliance warning and catalog correction notice.**
2. **Level 2 — marketplace search throttling and a temporary listing freeze**, after repeated SLA violations or a high dispute ratio.
3. **Level 3 — a 14-day storefront suspension and an escrow audit**, after severe non-fulfillment or a fit defect rate above 5%.
4. **Level 4 — indefinite merchant debarment and a payout freeze**, after counterfeit goods, off-platform solicitation, or a third IP strike.
5. **Level 5 — permanent platform expulsion and referral to law enforcement**, after gross fraud or criminal misconduct.

### 13.1. Buyer Protection and Order Handling During Suspension
If a Brand's storefront is suspended or debarred (Levels 3, 4, or 5):
* **Fulfillment of In-Flight Orders**: If active orders are already in production or transit, the Brand remains obligated to complete delivery. WIEZ will disburse net settlements only upon verified delivery and buyer inspection expiry.
* **Non-Fulfillable Orders & Escrow Refunds**: If a suspended Brand cannot fulfill pending orders within SLA timelines, WIEZ resolves the orders through the applicable cancellation/refund policy. New-policy Pending/Up Next orders use the itemized pre-Active deductions below, subject to mandatory statutory remedies; safety review stops promotion and unreleased payouts.
* **Indemnity for Unfulfilled Orders**: The Brand shall indemnify WIEZ for any payment gateway chargeback costs, gateway dispute processing fees, or buyer remediation costs incurred due to merchant suspension.


---

## 14. Merchant Appeals and Dispute Adjudication

Brands subject to administrative sanctions, verification denials, or dispute deductions may file a formal appeal:
* **Appeal Window**: Appeals must be submitted to `disputes@wiez.com` within **30 calendar days** of the enforcement notice;
* **Review SLAs**: The WIEZ Merchant Governance Desk will acknowledge appeals within **7 business days** and issue a final written determination within **14 business days**;
* **Binding Arbitration**: Unresolved commercial disputes between WIEZ and a Brand exceeding ₦500,000 NGN shall be settled by binding arbitration under the Arbitration and Mediation Act 2023 at the Lagos Court of Arbitration.

---

## 15. Store Closure and Offboarding

A Brand may close its digital storefront at any time, subject to:
1. Complete fulfillment and delivery of all open standard and bespoke orders;
2. Expiry of all active 72-hour buyer inspection windows;
3. Settlement of all outstanding chargebacks, refunds, and negative balances;
4. Upon satisfying these conditions, WIEZ will disburse all remaining escrow funds and archive the storefront catalog in accordance with our [Account and Data Deletion Policy](/account-deletion).

---

## 16. Contact Directory and Merchant Support

For all merchant onboarding inquiries, payout escalations, fee questions, and seller disputes:

* **Merchant Onboarding & KYC**: `kyc@wiez.com`
* **Seller Support & Brand Success**: `brands@wiez.com`
* **Merchant Disputes & Arbitration**: `disputes@wiez.com`
* **Legal & Corporate Notices**: `legal@wiez.com`
* **Mailing Address**:  
  **WIEZ Technology Ltd.**  
  Attn: Merchant Governance & Brand Relations  
  12B Admiralty Way, Lekki Phase 1,  
  Lagos, Nigeria  
* **Merchant Portal**: [wiez.com/brand/dashboard](https://wiez.com/brand/dashboard)

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

### Owner billing controls

Only the brand owner can manage Billing & subscriptions, select a saved checkout card for subscription payment, authorize a replacement renewal card, or cancel automatic renewal. Editing a card nickname or checkout default does not change an existing renewal mandate. Cancelling renewal preserves access until the current paid period ends and provides no refund for that period. Subscription level remains private. Igwe and free Legacy accounts are excluded from automatic upgrade notices; owners can still review plans through UPGRADE or Settings. Legacy owners must review the loss of unlimited free capacity before a paid agreement.
