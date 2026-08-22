# WIEZ Master Privacy Policy and Data Governance Directive

**Effective Date:** August 22, 2026  
**Document Version:** 2026.08-PROD.3  
**Applies To:** Web (`wiez.com`, `fthreadly`), Mobile Applications (iOS / Android / `threadly-mobile`), Brand Studio Workspaces, Escrow Ledger Services, and all platform APIs.

---

## 1. Scope, Data Controller, and Core Commitments

### 1.1. Scope of This Policy
This Master Privacy Policy and Data Governance Directive ("**Privacy Policy**" or "**Policy**") governs the collection, processing, storage, transfer, and safeguarding of personal data by **WIEZ Platforms Limited** (together with its subsidiaries, affiliates, successors, and assigns, "**WIEZ**", "**we**", "**us**", or "**our**"). This Policy applies to all individuals who access, register, browse, or transact across:
* **The Runway**: Our visual social discovery ecosystem featuring fashion lookbooks, design showcases, video reels, interactive comments, and creator engagements.
* **The Market**: Our multi-vendor fashion e-commerce marketplace connecting independent fashion brands with global shoppers.
* **The Custom Tailoring Engine**: Our bespoke garment commissioning architecture utilizing 38-point ISO 8559 measurement schemas and interactive SVG body silhouette visualizers.
* **The Brand Studio**: Our merchant operating suite enabling designers and brands to manage catalog inventory, configure bespoke orders, fulfill shipments, and receive escrow settlements.

### 1.2. Data Controller Identity
For all users accessing the Services globally, the designated legal data controller is:
* **Corporate Entity**: WIEZ Platforms Limited
* **Data Protection Office**: `privacy@wiez.com`
* **Legal Department**: `legal@wiez.com`
* **Registered Address**: Lagos State, Federal Republic of Nigeria

### 1.3. Fundamental Privacy Principles
WIEZ adheres to strict global data governance principles:
1. **Lawfulness, Fairness, and Transparency**: We process personal data solely on legitimate statutory grounds with complete operational transparency.
2. **Purpose Limitation**: Data collected for a specific purpose (such as custom tailoring measurements or brand KYC verification) is never repurposed for unrelated marketing without explicit consent.
3. **Data Minimization & Isolation**: We collect only the data necessary to provide our services. Highly sensitive records (such as body measurements and merchant KYC documents) are stored in cryptographically isolated data stores.
4. **Zero Sale of Personal Data**: We do not sell, rent, lease, or trade personal data or body measurements to third-party data brokers or marketing aggregators.

---

## 2. Exhaustive Categories of Information We Collect

We collect information directly from you, automatically through your platform usage, and from verified third-party technical integrations.

```
                             DATA CATEGORIZATION TAXONOMY
┌──────────────────────────────────────┬─────────────────────────────────────────────────────────────┐
│ Category                             │ Technical Fields & Data Elements                            │
├──────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ **1. Account & Identity Data**       │ First name, last name, @username handle, email address,     │
│                                      │ password hash (bcrypt), normalized E.164 phone number,      │
│                                      │ avatar image, banner image, country, state, city/LGA.       │
├──────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ **2. Bespoke Body Measurements**     │ Up to 38 distinct ISO 8559 tailoring points (bust, waist,   │
│    *(High-Trust Tailoring Data)*     │ hips, inseam, torso length, shoulder span, neck), SVG      │
│                                      │ silhouette coordinate maps, and fitting notes.              │
├──────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ **3. Brand Studio Verification (KYC)**│ Corporate registration certificates (CAC documents), Tax   │
│    *(Strictly Isolated Storage)*     │ IDs (TIN), director government IDs (Passport/NIN/License),  │
│                                      │ utility bills, and bank payout account details.             │
├──────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ **4. Commerce & Transactional Data** │ Multi-vendor bag items, order timestamps, shipping address, │
│                                      │ recipient contact numbers, bespoke cutting milestone logs,  │
│                                      │ return requests, and customer support tickets.              │
├──────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ **5. Financial & Escrow Tokens**     │ Payment gateway transaction references, masked last-4 card  │
│    *(PCI-DSS Compliant)*             │ digits, card brand, tokenized authorization hashes, escrow  │
│                                      │ pending balances, and settlement ledger payout IDs.         │
├──────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ **6. Social Runway & UGC Media**     │ Design showcase photos, video lookbooks, styling tags,      │
│                                      │ captions, likes, bookmarks/saves, comments, and reviews.    │
├──────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ **7. In-App Communications**         │ Buyer-designer custom tailoring chat messages, attachment   │
│                                      │ images, alteration requests, and dispute evidence files.    │
├──────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ **8. Technical & Telemetry Signals** │ IP address, device model, operating system, browser user-   │
│                                      │ agent, screen DPI, network type (Wi-Fi/4G/5G), push tokens, │
│                                      │ session cookies, and dwell-time interaction logs.           │
└──────────────────────────────────────┴─────────────────────────────────────────────────────────────┘
```

---

## 3. Deep Telemetry and Information Collected Automatically

When you interact with WIEZ, our telemetry infrastructure automatically records operational, engagement, and device signals:

### 3.1. Runway & Feed Interaction Telemetry
* **Visual Dwell Time**: We record the duration of time you spend viewing specific fashion designs, video lookbooks, or designer profiles to compute recommendation relevance.
* **Video Playback Analytics**: Video play start events, pause events, watch-completion percentages, and audio toggle actions on Runway reels.
* **Gesture & Navigation Signals**: Image zoom interactions, swipe velocities on mobile reels, carousel card slides, bookmarking actions, and link copying.
* **Search & Taxonomy Queries**: Search terms entered in the Market or Runway, filter combination sequences (category, subcategory, size, color, price range), and tag clicks.

### 3.2. Commerce & Bagging Behavior
* **Cart Interactions**: Timestamps of items added to bag, bag quantity modifications, cross-brand bag groupings, and checkout initiation events.
* **Friction & Abandonment Telemetry**: Points in the checkout or custom order flow where sessions are paused, helping us optimize mobile performance and resolve checkout errors.

### 3.3. Hardware, System, and Network Signals
* **Device Identification**: Device manufacturer, hardware model, operating system architecture and version (iOS, Android, macOS, Windows), and unique app installation IDs.
* **Network & Connection Telemetry**: IP address, internet service provider (ISP), mobile network carrier, connection type (Wi-Fi, 4G, 5G), network latency, and timezone offset.
* **Display & Localization Specs**: Screen resolution, pixel density (DPI), color gamut, preferred system language, and locale settings.
* **Push Notification Infrastructure**: Unique cryptographic push notification tokens (Apple Push Notification Service / Firebase Cloud Messaging) to deliver transactional alerts.

---

## 4. ISO 8559 Bespoke Body Measurement Data Governance

Bespoke tailoring requires the collection of physical bodily dimensions. We treat body measurements with enhanced data governance:

### 4.1. Measurement Sizing Schema
Shoppers may configure custom measurement profiles utilizing our 38-point ISO 8559 schema (encompassing bust/chest, waist, high hip, low hip, across-back, shoulder slope, sleeve length, bicep, wrist, thigh, knee, calf, inseam, outseam, and total height) or via our interactive SVG body silhouette visualizer.

### 4.2. Need-to-Know Designer Access
* **Restricted Disclosure**: When a custom order is bagged and paid, only the specific Brand assigned to manufacture the garment receives access to the measurement profile.
* **Designer Non-Disclosure Covenant**: Brands are contractually bound by our Seller Terms to utilize measurement profiles strictly for fabricating the specific order. Brands are legally prohibited from copying, archiving, publishing, or using customer measurements for external purposes.

### 4.3. Fit Dispute Forensic Logging
In the event of a sizing dispute during the 72-hour inspection window, our dispute arbitration team accesses the encrypted snapshot of submitted measurements to compare against physical garment audit photos to evaluate adherence to the ±0.75-inch fit tolerance standard.

---

## 5. Brand Studio Verification (KYC) and Anti-Money Laundering Safeguards

To prevent fraud, counterfeit goods, and money laundering, fashion brands operating on WIEZ must undergo rigorous merchant verification:

### 5.1. KYC Records Collected
Brand owners submit: (a) Corporate Affairs Commission (CAC) incorporation certificates or international business registrations, (b) Tax Identification Numbers (TIN), (c) valid government-issued identity documents (National ID, International Passport, or Driver’s License), (d) proof of physical studio address, and (e) verified corporate bank account details.

### 5.2. Isolated Cloud Vault Storage
All Brand KYC documents are uploaded via cryptographically signed temporary URLs directly into private, access-restricted AWS S3 storage vaults encrypted with **AES-256 bit Server-Side Encryption (SSE-S3)**.

### 5.3. Public API Mathematical Redaction
To protect Brand owners from identity theft, our public backend APIs (`GET /brands/:id`, `GET /brands/username/:handle`) strictly redact all corporate registration numbers, TINs, owner personal emails, and banking coordinates for all public visitor requests.

---

## 6. Financial Data, Payment Processing, and Escrow Mechanics

### 6.1. PCI-DSS Tokenized Payment Intake
* WIEZ integrates with PCI-DSS Level 1 certified payment processors (including Paystack, Flutterwave, Stripe, and authorized card networks).
* **Zero Raw Card Storage**: WIEZ never receives, processes, or stores your full 16-digit primary account number (PAN), CVV, or card PIN.
* **Tokenized References**: Our payment gateways provide WIEZ with cryptographic authorization tokens, card brands (e.g., Visa, Mastercard), expiration years, and masked last-4 digits to display saved cards in your checkout drawer.

### 6.2. Escrow Settlement Ledger Architecture
* Payments collected upon checkout are deposited into a segregated settlement ledger (`CustomOrderFinanceSyncService`).
* The system logs transaction timestamps, gross amounts, platform commissions, net payouts, currency exchange snapshots, and escrow holding milestones.
* Funds are disbursed to the Brand’s verified bank account only upon carrier delivery confirmation and the expiration of the 72-hour buyer inspection window.

---

## 7. Legal Bases for Processing (GDPR & NDPA Compliance Matrix)

We process your personal information only when authorized by law:

```
                            LEGAL BASES & PROCESSING MATRIX
┌──────────────────────────────────────┬──────────────────────┬──────────────────────────────────────┐
│ Purpose of Processing                │ Applicable Data      │ Legal Basis                          │
├──────────────────────────────────────┼──────────────────────┼──────────────────────────────────────┤
│ 1. Processing Market Bag Orders      │ Identity, Address,   │ **Performance of a Contract**        │
│    and Custom Tailoring Contracts    │ Measurements, Tokens │ (Fulfilling the purchase agreement)  │
├──────────────────────────────────────┼──────────────────────┼──────────────────────────────────────┤
│ 2. Runway Feed Personalization and   │ Dwell Time, Likes,   │ **Legitimate Interests**             │
│    Visual Recommendation Ranking     │ Saves, Search Logs   │ (Improving user experience)          │
├──────────────────────────────────────┼──────────────────────┼──────────────────────────────────────┤
│ 3. Brand Verification & AML Screening│ CAC, TIN, Gov IDs,   │ **Compliance with Legal Obligation** │
│                                      │ Bank Details         │ (Tax, corporate, and AML compliance) │
├──────────────────────────────────────┼──────────────────────┼──────────────────────────────────────┤
│ 4. Tailoring Fit Dispute Forensics   │ Measurement Profiles,│ **Performance of a Contract** &      │
│                                      │ Inspection Photos    │ **Legitimate Interests** (Fairness)  │
├──────────────────────────────────────┼──────────────────────┼──────────────────────────────────────┤
│ 5. Direct Shopper-Brand Chat         │ Chat Text, Images,   │ **Performance of a Contract**        │
│                                      │ Fitting Notes        │ (Order coordination)                 │
├──────────────────────────────────────┼──────────────────────┼──────────────────────────────────────┤
│ 6. Push & Transactional Alerting     │ Push Tokens, Email,  │ **Performance of a Contract** &      │
│                                      │ Phone Number         │ **Consent** (Marketing preferences)  │
└──────────────────────────────────────┴──────────────────────┴──────────────────────────────────────┘
```

### 7.1. Legitimate Interests Balancing Assessment
Where WIEZ relies on **Legitimate Interests** as the legal basis for processing (particularly for Runway feed personalization, dwell time telemetry, and marketplace signal analytics), we have conducted and documented a balancing assessment confirming that:
* Our legitimate interest in improving discovery feed relevance is genuine and specific.
* The processing involves only pseudonymized or anonymized first-party engagement signals; it does not create behavioral profiles linked to external activities.
* The processing creates a direct, proportionate benefit to users through more relevant fashion discovery.
* Users retain an unconditional right to object to this processing at any time via `privacy@wiez.com` or by resetting their discovery signal queue in Settings > Privacy > Reset Feed, after which feed personalization processing for that user will cease.

---

## 8. Third-Party Sub-Processors and Service Integrations

WIEZ engages trusted third-party technical providers to operate infrastructure services under binding Data Processing Agreements (DPAs):

### 8.1. Infrastructure & Hosting Sub-Processors
* **Amazon Web Services (AWS)**: Cloud infrastructure, relational database clustering, and encrypted object storage (S3).
* **Railway Corporation**: Application server container orchestration and backend API execution.
* **Cloudflare, Inc.**: Content Delivery Network (CDN), DDoS mitigation, SSL/TLS edge termination, and media caching.

### 8.2. Payment & Financial Gateways
* **Paystack Payments Limited**: Primary payment gateway processing for Nigerian and African card/bank transactions.
* **Flutterwave Inc.**: Secondary payment processing and cross-border settlement rails.
* **Stripe, Inc.**: International payment processing and global card tokenization.

### 8.3. Communications & Notifications
* **Twilio Inc.**: Automated SMS delivery for phone verification (E.164 normalization).
* **Expo / Firebase Cloud Messaging (Google LLC)**: Native mobile push notification routing.

---

## 9. Cryptography, Storage, and Security Architecture

WIEZ deploys multi-layered technical and organizational security controls:

```
                            SECURITY ARCHITECTURE OVERVIEW
┌──────────────────────────────────────┬─────────────────────────────────────────────────────────────┐
│ Layer                                │ Technical Implementation & Standard                         │
├──────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ **1. In-Transit Encryption**         │ TLS 1.3 / HTTPS across all web domains and mobile APIs.     │
├──────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ **2. At-Rest Encryption**            │ AES-256 bit Server-Side Encryption across databases & S3.   │
├──────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ **3. Credential Hashing**            │ Cryptographic `bcrypt` with individual salt rounds.         │
├──────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ **4. Mobile Device Security**        │ JWT tokens stored in **iOS Keychain** & **Android KeyStore**│
│                                      │ via hardware-isolated `expo-secure-store`.                  │
├──────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ **5. Media Access Controls**         │ Private attachments and KYC files protected via HMAC-SHA256 │
│                                      │ pre-signed temporary URLs expiring within minutes.          │
├──────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ **6. Legal Acceptance Audit Trail**  │ Cryptographically logged `LegalAcceptance` database rows     │
│                                      │ recording document key, version, timestamp, IP, & device.   │
└──────────────────────────────────────┴─────────────────────────────────────────────────────────────┘
```

---

## 10. Law Enforcement Requests and Government Disclosures

WIEZ is committed to protecting user privacy against unlawful or overbroad government surveillance. We disclose user records to government or law enforcement agencies only under the following strict conditions:

1. **Mandatory Legal Process**: We require a valid, binding court order, search warrant, or statutory subpoena issued by a court of competent jurisdiction (e.g., Nigerian Federal High Court or recognized international tribunal).
2. **Scrutiny of Requests**: Our legal department reviews every request for statutory validity and pushes back against overbroad, generic, or unauthorized requests.
3. **User Notification**: Unless strictly prohibited by a non-disclosure order or where disclosure would create an immediate risk of death or serious bodily harm, WIEZ will attempt to notify the affected user prior to disclosing records.

---

## 10A. Data Security Breach Notification and Incident Response

WIEZ maintains an active incident response program and is committed to transparent, timely notification in the event of a personal data security breach.

### 10A.1. Our Incident Response Obligations
In the event of a personal data breach that poses a risk to the rights and freedoms of individuals:
* **Supervisory Authority Notification**: WIEZ will notify the **Nigeria Data Protection Commission (NDPC)** within **72 hours** of becoming aware of the breach, in accordance with the Nigeria Data Protection Act 2023 Section 40. For EEA users, the relevant EU Data Protection Authority will be notified within 72 hours per GDPR Article 33.
* **Affected User Notification**: Where a breach is likely to result in high risk to the rights and freedoms of individuals (e.g., exposure of body measurements, financial data, or KYC documents), WIEZ will notify affected users **directly and without undue delay** via email and in-app notification per GDPR Article 34 and NDPA 2023 Section 40(3).

### 10A.2. Content of Breach Notification to Users
Where user notification is required, WIEZ will communicate:
1. A description of the nature of the breach in plain language.
2. The categories and approximate number of users and data records affected.
3. The name and contact details of the Data Protection Officer.
4. The likely consequences of the breach.
5. The measures WIEZ has taken or proposes to take to address the breach and mitigate its effects.
6. Recommended steps that affected users may take to protect themselves.

### 10A.3. Breach Reporting Threshold
Not every security incident constitutes a notifiable breach. WIEZ conducts a documented risk assessment for each incident. Internal security events that pose no risk to user rights (e.g., failed login attempts blocked by rate limiting, test environment anomalies) do not trigger notification obligations.

### 10A.4. Security Vulnerability Disclosure
Security researchers who discover potential vulnerabilities in WIEZ's infrastructure, API, or mobile application are invited to report responsibly to `security@wiez.com`. WIEZ operates a good-faith responsible disclosure program and will not pursue legal action against researchers who report vulnerabilities responsibly and without exploiting them.

---

## 11. Data Retention, Soft Deactivation, and Pseudonymization

### 11.1. Retention Timelines

| Data Category | Retention Period | Reason |
|---|---|---|
| **Active User Profiles** | Duration of account activity | Contract performance |
| **In-App Buyer-Designer Messages** | **12 months** after order completion | Dispute resolution support and fraud prevention |
| **Custom Measurement Snapshots** | **12 months** after order fulfillment | Alteration audits and repeat commissions |
| **Market Signal Telemetry** | **24 hours** in local queue; analytics aggregates retained indefinitely in anonymized form | Feed personalization (legitimate interest) |
| **Authentication Logs & Security Events** | **90 days** rolling | Security breach investigation |
| **Commercial & Tax Records** | **7 years** | CAMA 2020, FIRS regulations, anti-fraud audits |
| **KYC / Brand Verification Documents** | **7 years** after Brand account closure | SCUML AML compliance requirements |
| **Legal Acceptance Records** | **7 years** | Evidence of valid contractual agreement |
| **Dispute Evidence Files** | **5 years** after dispute closure | Legal defense and arbitration |

### 11.2. Account Deletion Workflow (Soft Deactivation & Pseudonymization)
When you request account deletion via Settings (`/settings/delete-account`):
1. **Public Eradication**: Your public profile, Runway posts, video lookbooks, comments, likes, and bookmarks are immediately removed from public display.
2. **Session Revocation**: All active JWT refresh tokens and password credentials are invalidated.
3. **Identifier Pseudonymization**: Your active email is converted into an anonymous hash (`deleted+timestamp-id@wiez.local`) and your @username is randomized (`deleted_timestamp`).
4. **Commerce & Ledger Preservation**: Past order ledgers, escrow settlement records, and dispute archives remain preserved in an archived, pseudonymized state to satisfy tax, audit, and legal defense requirements.

---

## 12. Your Global Data Privacy Rights and In-App Controls

You possess the following statutory rights under applicable global data protection frameworks (GDPR Article 12–22, NDPA 2023 Part VI, CCPA/CPRA). Rights requests may be submitted to `privacy@wiez.com`:

```
                            COMPLETE GLOBAL USER PRIVACY RIGHTS
┌──────────────────────────────────────┬─────────────────────────────────────────────────────────────┐
│ 1. Right to Access & Portability     │ Obtain a complete, structured, machine-readable copy        │
│    [GDPR Art. 15 / Art. 20]          │ (JSON/CSV) of your personal data and measurement history.   │
├──────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ 2. Right to Rectification            │ Correct inaccurate body measurements, addresses, or profile │
│    [GDPR Art. 16]                    │ details directly via your Settings dashboard.               │
├──────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ 3. Right to Erasure ("Right to       │ Initiate account deactivation and identifier                │
│    Be Forgotten") [GDPR Art. 17]     │ pseudonymization via Settings > Delete Account.             │
│                                      │ Note: Retention of tax/audit records as per §11.1 applies. │
├──────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ 4. Right to Restriction of           │ Request that WIEZ pauses processing of your personal data   │
│    Processing [GDPR Art. 18]         │ (e.g., while accuracy or objection is being contested).     │
│                                      │ Submit request to privacy@wiez.com.                         │
├──────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ 5. Right to Object [GDPR Art. 21]    │ Object to processing based on Legitimate Interests (e.g.,   │
│                                      │ Runway feed personalization). Where your interests override  │
│                                      │ WIEZ's, processing will be halted for that specific purpose.│
├──────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ 6. Right to Withdraw Consent         │ Where processing is based on your consent (e.g., marketing  │
│    [GDPR Art. 7(3)]                  │ emails, optional analytics), you may withdraw consent at    │
│                                      │ any time via Settings > Notifications without penalty.      │
├──────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ 7. Profile & Location Visibility     │ Switch between Public Profile (UNLOCKED) and Private        │
│    Controls                          │ Profile (LOCKED), and independently toggle "Show my         │
│                                      │ username" and "Show my location" in Settings > Privacy.     │
├──────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ 8. Cookie & Signal Queue Reset       │ Reset your anonymized session ID and local market signal    │
│                                      │ queue at any time via Settings > Privacy > Reset Feed.      │
└──────────────────────────────────────┴─────────────────────────────────────────────────────────────┘
```

**Response Timeline**: WIEZ will acknowledge all privacy rights requests within **72 hours** and fulfill them within **30 days** (extendable by a further 60 days for complex requests, with written notice).

**Limitations**: Rights to erasure, restriction, and objection are limited where WIEZ is required to retain data by law (tax, AML, court orders) or where processing is necessary for legal defense.

---

## 13. Statutory Annex: Nigeria Data Protection Act (NDPA 2023)

For users residing in the Federal Republic of Nigeria:
* **Compliance**: WIEZ processes personal data in strict accordance with the **Nigeria Data Protection Act (NDPA 2023)** and the Nigeria Data Protection Regulation (NDPR).
* **Sensitive Data Processing**: Body physical measurements are processed under Article 30 of the NDPA based on your explicit contractual consent for bespoke garment fabrication.
* **Supervisory Authority**: You have the statutory right to lodge a formal complaint with the **Nigeria Data Protection Commission (NDPC)** at `ndpc.gov.ng`.

---

## 14. Statutory Annex: European Union and United Kingdom (GDPR)

For users residing in the European Economic Area (EEA) or United Kingdom:
* **Legal Ground**: Processing is justified under GDPR Article 6(1)(b) (Contract), Article 6(1)(c) (Legal Obligation), and Article 6(1)(f) (Legitimate Interests).
* **International Data Transfers**: When data is transferred outside the EEA/UK, WIEZ utilizes **Standard Contractual Clauses (SCCs)** approved by the European Commission to ensure adequate safeguards.
* **Supervisory Complaint**: You have the right to lodge a complaint with your local EU Data Protection Authority or the UK Information Commissioner’s Office (ICO).

---

## 15. Statutory Annex: United States State Privacy Laws (CCPA / CPRA)

For residents of California and US states with comprehensive privacy legislation:
* **Notice at Collection**: We collect the categories of personal information listed in Article 2 of this Policy for the business purposes described in Article 3.
* **Zero Sale / Share of Personal Information**: WIEZ does not "sell" your personal data or bodily measurements for monetary compensation, nor do we "share" personal data for cross-context behavioral advertising.
* **Right to Limit Use of Sensitive Personal Information**: We use sensitive physical body measurements solely to perform the services requested (bespoke garment tailoring).
* **Non-Discrimination**: We will not discriminate against you (through pricing or service quality) for exercising any CCPA privacy rights.

---

## 16. Protection of Children and Minors

WIEZ is not directed to children under **13 years of age**. We do not knowingly collect personal data, body measurements, or payment details from children under 13. If we discover that an account has been registered by a minor under 13 without verifiable parental consent, we will immediately terminate the account and pseudonymize all associated records.

---

## 17. Modifications and Version Updates

We reserve the right to update this Privacy Policy periodically. When material changes are made:
* We will provide at least **fifteen (15) days' advance notice** via an in-app banner or email alert.
* We update the "Effective Date" and version number at the top of this document.
* Your continued use of WIEZ after the effective date constitutes acknowledgment of the updated Policy.

---

## 18. Official Contact Directory and Privacy Escalation

If you have questions, data portability requests, or privacy compliance inquiries, please contact our specialized teams:

* **Data Protection Officer (DPO)**: `privacy@wiez.com`
* **Legal & Regulatory Affairs**: `legal@wiez.com`
* **Security & Vulnerability Reports**: `security@wiez.com`
* **Mailing Address**: Data Protection Office, WIEZ Platforms Limited, Lagos State, Nigeria.

