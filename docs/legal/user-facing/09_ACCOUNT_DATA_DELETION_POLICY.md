# WIEZ Account and Data Deletion Policy

Version: `2026.08.22-v1.0`  
Effective Date: August 22, 2026  
Governing Entities: WIEZ Technology Ltd. (Nigeria) & Global Operating Affiliates  
Privacy & Deletion Desk: `privacy@wiez.com` / `dpo@wiez.com`  
Web Deletion Portal: [wiez.com/account/delete](https://wiez.com/account/delete)

---

## 1. Purpose, Scope, and Regulatory Compliance

This Account and Data Deletion Policy ("Policy") provides a transparent, legally binding explanation of the account closure, data pseudonymization, cryptographic erasure, and statutory record retention mechanisms deployed across the WIEZ ecosystem (web, iOS, Android, and API).

This Policy is formulated in strict compliance with:
* **Apple App Store Review Guidelines (Guideline 5.1.1(v) — Account Deletion)**;
* **Google Play Developer Policy (Data Deletion Requirements)**;
* **Nigeria Data Protection Act (NDPA 2023, Section 34 — Right to Erasure)**;
* **General Data Protection Regulation (GDPR Art. 17 — Right to Erasure / "Right to be Forgotten")**;
* **California Consumer Privacy Act as amended (CCPA / CPRA — Right to Delete)**;
* **Companies and Allied Matters Act (CAMA 2020) & Nigerian Tax Regulations (Mandatory Financial Retention)**.

---

## 2. In-App and Web Deletion Mechanisms

In compliance with mobile platform store guidelines and global privacy standards, WIEZ provides self-service, easily discoverable account deletion pathways across all supported platforms:

### 2.1. Mobile Application (iOS & Android)
1. Navigate to **Account / Profile** > **Settings** (gear icon);
2. Select **Security & Privacy** > **Account Management**;
3. Tap **Delete Account**;
4. Review the transaction and escrow disclosures, enter your current password, and confirm by typing the required confirmation phrase ("DELETE");
5. Upon confirmation, the app executes immediate session termination, clearing local tokens from the device's hardware enclave (`expo-secure-store`).

### 2.2. Web Platform & Dedicated Deletion Portal
Users without active access to mobile devices may initiate deletion via the web portal at [wiez.com/account/delete](https://wiez.com/account/delete) or by emailing a verified deletion request to `privacy@wiez.com`.

---

## 3. Pre-Deletion Prerequisites and Transactional Safeguards

To protect marketplace integrity, prevent escrow abandonment, and comply with commercial fraud-prevention laws, account deletion cannot proceed while certain active states exist:

| Account State / Condition | Platform Requirement Before Deletion Can Proceed |
|---|---|
| **Active Standard Orders (In-Transit)** | All pending deliveries must reach confirmed carrier status and the 72-hour buyer inspection window must expire. |
| **Active Custom / Bespoke Commissions** | The custom order must be fulfilled, accepted by the buyer, or formally cancelled with escrow funds disbursed. |
| **Open Dispute or Arbitration** | Any active dispute filed under the Dispute Resolution Mechanism must be formally resolved by the admin arbitration desk. |
| **Pending Escrow Payouts** | Brand owners must disburse or clear any accrued payout balances exceeding the ₦5,000 minimum threshold. |
| **Sole Brand Ownership** | A Brand owner cannot delete their personal login if their Brand has active inventory or pending orders without first transferring ownership or closing the digital storefront. |

*If any of the above conditions are detected during a deletion attempt, the user will be presented with a clear diagnostic summary detailing the specific transactions requiring resolution before closure.*

---

## 4. Technical Architecture: Soft Deactivation and Cryptographic Pseudonymization

Under Nigerian corporate law (CAMA 2020), anti-money laundering statutes (SCUML), and international financial audit standards, e-commerce platforms must preserve unbroken transaction ledgers. To balance statutory retention duties with user privacy rights, WIEZ utilizes **irreversible cryptographic pseudonymization** rather than raw database row deletion.

```
[ Active User Account ]
       │
       ▼ (User Initiates Deletion & Passes Security Checks)
[ Immediate Token Revocation: RefreshTokens Purged, Biometric Keys Invalidated ]
       │
       ▼ (Database Transaction: `deleteOwnAccount()`)
[ Email Replaced: `deleted+{timestamp}-{uuid}@wiez.local` ]
[ Username Replaced: `deleted_{timestamp}` ]
[ Password Hash Nullified / Credential Status: DEACTIVATED ]
[ User Profile PII (Phone, Addresses, Avatars, Sizing Profiles) Purged ]
       │
       ▼
[ Irreversibly Anonymized Node in Historical Financial Ledger ]
```

### 4.1. What Is Immediately and Irreversibly Erased:
1. **Direct Profile Identifiers**: First name, last name, phone number, physical residential addresses, avatar photography, profile biography, and social links;
2. **Sizing & Biometric Measurement Profiles**: All stored custom body measurements, fitting notes, sizing preferences, and 3D silhouette records;
3. **Authentication Credentials**: Password hashes (bcrypt salts), trusted device biometric tokens, SMS OTP bindings, and OAuth identity links;
4. **Marketing & Telemetry**: Notification preferences, push tokens (FCM/APNS), and active market signal tracking queues.

### 4.2. What Is Pseudonymized:
1. **User Table Record**: The database record remains structurally intact to preserve foreign-key relational integrity in order ledgers, but the `email` is overwritten with `deleted+{timestamp}-{id}@wiez.local`, the `username` is overwritten with `deleted_{timestamp}`, and `status` is permanently set to `DEACTIVATED`;
2. **Public Reviews & Ratings**: Product reviews authored by the user remain visible to assist other buyers, but the author attribution is permanently replaced with "Verified WIEZ Shopper" and all links to the profile are removed.

---

## 5. Brand Storefronts, Products, and Collaborative Workspaces

When a Brand Owner or Designer initiates account deletion:
1. **Digital Storefront Deactivation**: The Brand's public storefront (`wiez.com/@brandname`) is immediately taken offline (`isStoreOpen: false`);
2. **Product Unlisting**: All active ready-to-wear products and bespoke custom service listings are unlisted from the Market and search index;
3. **Runway Portfolio Handling**: Public runway lookbooks authored by the Brand are unlinked from search discovery and archived;
4. **Collaborative Collections**: For shared collections featuring co-designers, primary ownership must be transferred to a verified co-creator prior to deletion. If no transfer occurs, the shared collection is converted to an unlisted archive.

---

## 6. Statutory Data Retention Schedule

Pursuant to GDPR Article 17(3)(b),(e) and NDPA Section 34(2), the right to erasure does not apply to data that WIEZ is legally required to retain for regulatory compliance, tax administration, fraud prevention, or legal defense. 

The following statutory retention periods apply:

| Data Category | Specific Records | Retention Timeline | Legal / Regulatory Basis |
|---|---|---|---|
| **Commercial Invoices & Ledgers** | Order receipts, item breakdowns, currency conversion snapshots, transaction ledgers | **7 Years** | Companies and Allied Matters Act (CAMA 2020), FIRS Tax Acts |
| **Escrow & Payout Records** | Settlement disbursement logs, bank account reference tokens, gateway transfer IDs | **7 Years** | Central Bank of Nigeria (CBN) Electronic Payments Guidelines |
| **KYC / AML Documentation** | Brand owner NIN records, CAC business registration certificates, workshop proof | **7 Years** from store closure | Special Control Unit Against Money Laundering (SCUML) / Money Laundering (Prevention and Prohibition) Act 2022 |
| **Dispute & Chargeback Archives** | Inspection photos, carrier tracking logs, buyer-designer dispute communications | **5 Years** | Limitation Act (Lagos State), Commercial Litigation Defense |
| **Security & Authentication Logs** | IP address logs, intrusion detection events, login timestamp audit trails | **90 Days** | Cybersecurity and Platform Defense (Legitimate Interest) |
| **Legal Acceptances** | Cryptographic hash of Terms of Service and Privacy Policy consent records | **7 Years** | Evidence of Contractual Agreement (Evidence Act 2011) |

*All retained records are isolated in encrypted, restricted-access cold storage and are strictly inaccessible to operational platform staff except upon subpoena or authorized regulatory audit.*

---

## 7. Third-Party Service Providers and Sub-Processor Erasure

Upon processing a deletion request, WIEZ automatically propagates deletion instructions to our authorized infrastructure and payment sub-processors:
* **Payment Gateways (Paystack, Flutterwave, Stripe)**: Tokenized customer profiles are detached from WIEZ merchant accounts. Note that payment processors maintain their own independent statutory banking retention obligations under CBN, PCI-DSS, and FinCEN regulations;
* **Media Storage (Amazon Web Services S3 / CloudFront)**: Profile images, private measurement snapshots, and custom order sketches are permanently deleted from S3 buckets, with CDN edge cache invalidation completed within 48 hours;
* **Transactional Email & Push (Resend / AWS SES / Firebase)**: Marketing suppression lists are updated to permanently prevent any subsequent promotional emails or push notifications.

---

## 8. Grace Period and Reactivation

* **Irreversibility**: Once the deletion workflow completes and cryptographic pseudonymization occurs, **the action is permanent and irreversible**. WIEZ technical support cannot restore deleted profiles, saved wishlists, measurement cards, or discount credits;
* **Re-registration**: Users may register a new account on WIEZ at any time using their original email address or phone number. However, the newly created account will be completely unlinked from the historical, pseudonymized profile and will start with a fresh user ID and clean history.

---

## 9. Comprehensive Data Rights Requests (Access, Portability, Rectification)

Prior to initiating account deletion, users may exercise their full suite of data protection rights under GDPR, NDPA, and CCPA:
1. **Data Portability (GDPR Art. 20 / NDPA Sec. 32)**: You may request a machine-readable export (JSON format) of your complete account history, including past order invoices, custom commission specifications, and active sizing profiles by emailing `privacy@wiez.com`;
2. **Rectification (GDPR Art. 16 / NDPA Sec. 33)**: You may update or correct inaccurate profile, billing, or measurement information directly within the app settings.

---

## 10. Protection of Minors

WIEZ does not knowingly permit individuals under the age of 18 (or the age of majority in their jurisdiction) to hold active accounts. If WIEZ discovers that an underage user has created an account, WIEZ will immediately execute unilateral account deactivation and data pseudonymization in accordance with this Policy.

Parents or legal guardians who become aware that a minor has submitted personal data to WIEZ should immediately contact `privacy@wiez.com` for expedited priority removal.

---

## 11. Policy Modifications and Store Compliance Notifications

WIEZ regularly audits this Policy to ensure ongoing alignment with mobile app store policies (Apple App Store & Google Play Store) and evolving data privacy statutes. When material updates are made:
* The `Version` and `Effective Date` will be updated;
* Active users will receive in-app notice prior to enforcement;
* An archive of previous policy versions is maintained at [wiez.com/legal/archive](https://wiez.com/legal/archive).

---

## 12. Contact Directory & Data Protection Officer

For all questions regarding account deletion, data erasure, portability requests, or regulatory privacy inquiries, please contact our dedicated Data Protection team:

* **Data Protection Officer (DPO)**: `dpo@wiez.com`
* **Privacy & Deletion Desk**: `privacy@wiez.com`
* **General User Support**: `support@wiez.com`
* **Legal & Regulatory Inquiries**: `legal@wiez.com`
* **Mailing Address**:  
  **WIEZ Technology Ltd.**  
  Attn: Data Protection Officer  
  12B Admiralty Way, Lekki Phase 1,  
  Lagos, Nigeria  
* **Dedicated Deletion Portal**: [wiez.com/account/delete](https://wiez.com/account/delete)

