# WIEZ Seller and Brand Terms

Version: `2026.08.22-v1.0`  
Effective Date: August 22, 2026  
Governing Entities: WIEZ Technology Ltd. (Nigeria) & Global Operating Affiliates  
Seller Support & Merchant Desk: `brands@wiez.com` / `disputes@wiez.com`  
Merchant Verification Desk: `kyc@wiez.com`

---

## 1. Scope, Contractual Framework, and Merchant Eligibility

These Seller and Brand Terms ("Seller Terms") constitute a legally binding agreement between **WIEZ Technology Ltd.** ("WIEZ", "we", "us", or "our") and any fashion designer, bespoke tailor, apparel manufacturer, brand owner, or authorized merchant ("Brand", "Seller", or "you") who opens, publishes, manages, or operates a digital storefront, sells ready-to-wear products, publishes runway showcases, or accepts custom bespoke commissions across the WIEZ ecosystem.

By submitting a digital storefront application, completing KYC merchant onboarding, uploading product listings, or accepting customer orders, you agree to be bound by these Seller Terms, the [Terms and Conditions](file:///c:/Users/UTL_ADMIN/Desktop/Shawn/threadly/docs/legal/user-facing/01_TERMS_AND_CONDITIONS.md), [Community Guidelines](file:///c:/Users/UTL_ADMIN/Desktop/Shawn/threadly/docs/legal/user-facing/04_COMMUNITY_GUIDELINES.md), and [Payment and Billing Policy](file:///c:/Users/UTL_ADMIN/Desktop/Shawn/threadly/docs/legal/user-facing/07_PAYMENT_BILLING_SUBSCRIPTION_POLICY.md).

---

## 2. Merchant Onboarding and Mandatory 5-Point KYC Verification

To preserve marketplace security, combat fraud, and comply with Central Bank of Nigeria (CBN) regulations and the Special Control Unit Against Money Laundering (SCUML) under the Money Laundering (Prevention and Prohibition) Act 2022, all Brands must undergo mandatory identity and capability verification before publishing storefronts or receiving escrow disbursements.

```
[ Step 1: Digital Application & Profile Setup ]
       │
       ▼
[ Step 2: 5-Point Document & Workshop Submission ]
  ├─ 1. Workshop Photo 1 (Production facility / machinery)
  ├─ 2. Workshop Photo 2 (Raw materials / cutting tables)
  ├─ 3. Government ID / NIN (`verificationNinKey`)
  ├─ 4. Business Registration / CAC (`verificationCacKey`)
  ├─ 5. Physical Workshop Address & Production Volume
       │
       ▼
[ Step 3: WIEZ Merchant Verification Review (24–72h SLA) ]
       │
  ┌────┴────────────────────────┐
  ▼                             ▼
[ APPROVED ]             [ REJECTED ]
Storefront Goes Live     Written Reason Provided;
Payouts Enabled          7-Day Resubmission Window
```

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
2. **Staff Role Delegations**: Brand owners may delegate administrative, catalog management, and customer support permissions to team members via the Brand Workspace. The Brand owner remains strictly liable for all actions, communications, listings, and contractual commitments executed by delegated staff;
3. **Security of Credentials**: Brands must enforce multi-factor authentication (MFA) across all staff accounts. WIEZ is not liable for unauthorized payouts or catalog alterations resulting from compromised merchant credentials.

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

```
[ Buyer Gross Order Total ]
       │
       ├─► Pass-Through Third-Party Shipping Carrier Fee (0% WIEZ Commission)
       │
       ├─► Standard Platform Commission (8% – 12% on Item Merchandise Value)
       │
       ├─► Gateway Payment Processing Fee (Paystack / Flutterwave / Stripe)
       │
       └─► Net Merchant Settlement (Allocated to Brand Escrow Balance)
```

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
* **Production Milestone (Upfront Material Deposit)**: **60% of net order value** is released to the Brand upon mutual agreement on design sketches, measurements, and fabric acquisition;
* **Final Delivery Milestone**: The remaining **40% of net order value** is held in escrow and released upon buyer delivery confirmation and expiry of the 72-hour fit inspection window.

### 6.3. Payout Disbursements & Minimum Threshold
* **Minimum Payout Amount**: **₦5,000 NGN** (or USD/EUR equivalent);
* **Disbursement Frequency**: Brands may initiate automated payout requests daily or weekly once available funds exceed the minimum threshold;
* **Settlement Currencies**: Payouts are disbursed in Nigerian Naira (NGN) via direct NIP bank transfer, or in USD/EUR/GBP via Flutterwave and Stripe for international merchant accounts.

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

```
[ Level 1: Formal Compliance Warning & Catalog Correction Notice ]
       │
       ▼ (Repeated SLA Violations / High Dispute Ratio)
[ Level 2: Marketplace Search Throttling & Temporary Listing Freeze ]
       │
       ▼ (Severe Non-Fulfillment / Fit Defect Rate > 5%)
[ Level 3: 14-Day Storefront Suspension & Escrow Audit ]
       │
       ▼ (Counterfeit / Off-Platform Solicitation / IP Strike 3)
[ Level 4: Indefinite Merchant Debarment & Payout Freeze ]
       │
       ▼ (Gross Fraud / Criminal Misconduct)
[ Level 5: Permanent Platform Expulsion & Law Enforcement Referral ]
```

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
4. Upon satisfying these conditions, WIEZ will disburse all remaining escrow funds and archive the storefront catalog in accordance with our [Account and Data Deletion Policy](file:///c:/Users/UTL_ADMIN/Desktop/Shawn/threadly/docs/legal/user-facing/09_ACCOUNT_DATA_DELETION_POLICY.md).

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

