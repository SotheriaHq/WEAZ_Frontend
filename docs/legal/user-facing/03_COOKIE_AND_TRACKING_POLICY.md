# WIEZ Master Cookie, Local Storage, and Device Telemetry Directive

**Effective Date:** August 22, 2026  
**Document Version:** 2026.08-PROD.3  
**Applies To:** Web Applications (`wiez.com`, `fthreadly`), Mobile Applications (iOS / Android / `threadly-mobile`), Brand Studio Workspaces, Embedded WebViews, and all platform APIs.

---

## 1. Scope, Operational Architecture, and Philosophy

### 1.1. Scope of This Directive
This Master Cookie, Local Storage, and Device Telemetry Directive ("**Cookie Policy**" or "**Policy**") provides an exhaustive technical explanation of how **WIEZ Platforms Limited** (together with its subsidiaries, affiliates, successors, and assigns, "**WIEZ**", "**we**", "**us**", or "**our**") deploys, reads, and manages cookies, browser web storage, mobile secure keychains, device caches, and first-party telemetry across:
* **The Runway**: Our visual social media feed for fashion lookbooks, video reels, interactive comments, and creator engagements.
* **The Market**: Our multi-vendor fashion e-commerce marketplace connecting independent fashion brands with global shoppers.
* **The Custom Tailoring Engine**: Our bespoke garment configuration system utilizing 38-point ISO 8559 measurement schemas and interactive SVG body silhouette visualizers.
* **The Brand Studio**: Our merchant operating suite enabling designers and brands to manage catalog inventory, configure bespoke orders, fulfill shipments, and receive escrow settlements.

### 1.2. Taxonomy of Storage Technologies Deployed
When we refer to "Cookies and Storage Technologies," we encompass five distinct technical mechanisms:
1. **HTTP Cookies**: Cryptographic data strings stored by your browser, transmitted in HTTP request headers (`Cookie:` / `Set-Cookie:`).
2. **Web Storage API (`localStorage` & `sessionStorage`)**: Standardized HTML5 key-value client storage persisting data locally with domain-scoped sandboxing.
3. **Mobile Hardware Keychains (`expo-secure-store`)**: Hardware-backed cryptographic vaults on mobile operating systems (**iOS Keychain** and **Android KeyStore / EncryptedSharedPreferences**).
4. **Sandboxed Mobile App Storage (`AsyncStorage`)**: React Native sandboxed document storage for query cache persistence and local signal queues.
5. **In-App WebView Session Bridges**: Cryptographically isolated webview containers (`useStudioNativeNavBridge` / `useEmbeddedSurface`) bridging authenticated mobile states to merchant studio interfaces.

### 1.3. Fundamental Tracking & Privacy Commitments
* **Zero Third-Party Advertising Pixels**: WIEZ **does not** deploy third-party behavioral advertising trackers (such as Meta Pixel, TikTok Pixel, Google Ads Remarketing, or Criteo tags) that follow your browsing across external websites.
* **First-Party Purpose Limitation**: All cookies, local storage items, and discovery signals are first-party and are used strictly to maintain secure login sessions, persist your multi-vendor shopping bag, cache bespoke tailoring measurements, and power Runway feed recommendations.

---

## 2. Exhaustive Technical Cookie & Storage Directory

The table below provides a complete, field-by-field register of every cookie, local storage key, and device cache utilized across the WIEZ application ecosystem:

| Technical Key / Identifier | Storage Mechanism | Surface | TTL / Life | Exact Technical Purpose & Legal Classification |
| --- | --- | --- | --- | --- |
| `refreshToken` | HttpOnly Cookie (SameSite=Strict, Path=/) | Web Browser / API | 7 Days (Rolling) | **Strictly Necessary**: Rotated session token. Protected against XSS; required for auth renewal. |
| `accessToken` | HttpOnly Cookie, also presented as a Bearer header | Web Browser / API | 8 Hours | **Strictly Necessary**: Short-lived credential validating individual REST API calls. |
| `WIEZ_ACCESS_TOKEN` | Hardware Keychain (SecureStore) on mobile; `localStorage` on web | Mobile (iOS/Android) / Web Browser | Until Logout | **Strictly Necessary**: Access token held for session bootstrap. On mobile this is the iOS Keychain / Android KeyStore. |
| `WIEZ_REFRESH_TOKEN` | Hardware Keychain (SecureStore) | Mobile (iOS/Android) | Until Logout | **Strictly Necessary**: Hardware-isolated refresh token used for seamless native mobile session renewal. |
| `WIEZ_USER` | Hardware Keychain (SecureStore) on mobile; `localStorage` on web | Mobile (iOS/Android) / Web Browser | Until Logout | **Strictly Necessary**: Snapshot of authenticated user identity (role, status, email) so the interface can render before the network replies. |
| `wiez.market.` `anonymousSessionId.v1` | `localStorage` | Web Browser | Persistent | **First-Party Analytics**: Anonymous client ID grouping discovery signals before you log in. |
| `wiez.market.` `signalQueue.v1` | `localStorage` / `AsyncStorage` | Web / Mobile | 24 Hours / 5s Flush | **First-Party Analytics**: Client queue buffering discovery events, capped at 100 entries and flushed in batches of at most 25. |
| `wiez.market.` `signalRecent.v1` | `localStorage` / Memory Map | Web / Mobile | 30 Seconds (Window) | **Performance & Integrity**: Suppresses duplicate noisy impression events (e.g. repeated scroll passes). |
| `wiez.market.` `signalIdentity.v1`, `signalLastClearedAt.v1` | `localStorage` | Web Browser | Persistent | **First-Party Analytics**: Binds the queue to the current account and records when you last reset your feed signals. |
| `wiez.pendingBagAction.v1` | `sessionStorage` | Web Browser | Until the tab closes | **Functional / Commerce**: Remembers an add-to-bag you started before signing in, so it completes afterwards. Bag CONTENTS are held on our servers, not in your browser. |
| `wiez.activeBrandId` | `localStorage` | Web Browser | Persistent | **Functional / Merchant**: Active Brand Studio workspace identifier for designers managing several stores. |
| `vite-ui-theme` (web) / `wiez.theme.mode` (mobile) | `localStorage` / `AsyncStorage` | Web / Mobile | Persistent | **Preferences**: Dark Mode / Light Mode interface display state selection. |
| `wiez.profile.` `sizeCategory.v1` | `localStorage` / `AsyncStorage` | Web / Mobile | Persistent | **Preferences**: Which size chart category to show you first. |
| `wiez.device.id.v1` | Hardware Keychain (SecureStore) | Mobile (iOS/Android) | Until reinstall | **Strictly Necessary**: Stable device identifier used to register and de-duplicate push notification tokens. |
| `WIEZ_QUERY_CACHE_V1` | `localStorage` / Memory Cache | Web / Mobile | Until logout or eviction | **Performance & Speed**: Client cache for Runway feed lookbooks, catalog grids, and designer profiles, including the signed image URLs they contain. |

Additional short-lived operational keys are written under the same `wiez.`
prefix (for example draft-publishing queues, checkout retry queues, and search
history on mobile). They hold no data beyond what is described in the
categories above, and **Section 8** clears all of them.

---

## 3. Deep Dive into Storage Classifications

### 3.1. Category 1: Strictly Necessary (Essential) Storage
These cookies and storage elements are technically mandatory for the platform to function securely. Under **ePrivacy Directive Article 5(3)** and **NDPA 2023 Section 24**, strictly necessary storage is exempt from requiring prior consent:

* **Rotated Authentication Tokens (`refreshToken`)**:
  * Issued by our backend upon authentication with security attributes: `HttpOnly`, `Secure` (HTTPS only in production), `SameSite=Strict`, and `Path=/`.
  * **XSS Shield**: Because it is flagged `HttpOnly`, malicious browser scripts cannot access or exfiltrate the token.
  * **CSRF Shield**: Because it is flagged `SameSite=Strict`, browsers will not attach the cookie to cross-site requests originating from external websites.
* **Mobile Hardware Security (`WIEZ_ACCESS_TOKEN` / `WIEZ_REFRESH_TOKEN`)**:
  * On iOS and Android physical hardware, session keys are stored in encrypted hardware enclaves via `expo-secure-store`. Tokens are inaccessible to other mobile apps installed on the device.
* **Legal Acceptance Signatures (`LegalAcceptance`)**:
  * Proof of the policy versions you accepted is recorded on our servers, not in your browser, and is checked during checkout, store publishing, and custom design commissioning.

### 3.2. Category 2: Functional, Commerce & Custom Tailoring Storage
Functional storage preserves your operational progress across page navigation, tab reloads, and network dropouts:

* **Multi-Vendor Bag (`wiez.pendingBagAction.v1`)**:
  * Your bag itself - items from multiple independent brands, with sizes, colour variants, custom fabric notes and brand identifiers - is held on our servers and follows your account across devices. It is not stored in your browser.
  * The browser holds one thing: an add-to-bag you began before signing in, kept in `sessionStorage` until the tab closes so the action completes once you are signed in.
* **Bespoke Measurement Drafts**:
  * Your measurement points and silhouette parameters are saved to your account, so a sizing configuration survives closing the tab and is available on your other devices. No draft copy is kept in browser storage.
* **Brand Studio Workspace Switching (`wiez.activeBrandId`)**:
  * Preserves the active brand profile context for fashion designers who manage multiple brand entities or toggle between shopper and merchant modes.

### 3.3. Category 3: Performance, 60fps Scrolling, and Asset Caching
To ensure instant navigation and smooth 60fps media scrolling across fashion lookbooks and video reels:

* **TanStack React Query Cache**:
  * Caches catalog queries, lookbook media metadata, and designer profiles in memory and `AsyncStorage`.
  * Reduces server load, minimizes mobile cellular data usage, and enables instantaneous back-button navigation without loading spinners.
* **Pre-Signed AWS S3 URL Cache**:
  * Caches time-limited HMAC-SHA256 authenticated media URLs for their 15-minute validity window.
* **Sandboxed Native Media Disk Cache**:
  * Native iOS and Android devices maintain a sandboxed disk cache of high-resolution lookbook photography and video thumbnails. Caches are managed by the operating system and automatically compacted when storage is constrained.

---

## 4. First-Party Telemetry & Discovery Signals (`marketSignalQueue`)

WIEZ utilizes a proprietary, client-side first-party telemetry system (`fthreadly/src/services/marketSignalQueue.ts`) to optimize the Runway discovery feed and catalog ranking:

A signal passes through four stages before it reaches us:

1. **Client-side capture**: lookbook dwell time, reel completion rate, and zoom and save actions.
2. **De-duplication window**: a 30-second window collapses repeats, and a noisy-signal filter discards the rest.
3. **Local buffer queue**: up to 100 items are held on your device and flushed in batches of at most 25 every 5 seconds.
4. **Backend ingestion**: the batch is used to rank your Runway recommendations. There is **zero third-party syndication** of these signals.

### 4.1. Granular Signal Event Types
Our systems log the following specific user engagement events:
* **Impression Signals**: `IMPRESSION`, `ITEM_IMPRESSION`, `SECTION_VIEW`, `MARKET_SECTION_VIEW`, `SUGGESTION_ITEM_VIEW`.
* **Engagement Signals**: `IMPRESSION`, `VIEW`, `ITEM_IMPRESSION`, `ITEM_VIEW`, `ITEM_CLICK`, `CLICK`, `OPEN`, `LIKE`, `SAVE`, `SHARE`, `COMMENT`, `THREAD`, `PROFILE_TAP`, and the dwell bands `DWELL_SHORT`, `DWELL_MEDIUM`, `DWELL_LONG`.
* **Commerce Signals**: `PRODUCT_VIEW`, `ADD_TO_CART`, `WISHLIST`, `PURCHASE`.
* **Negative Signals**: `HIDE`, `NOT_INTERESTED`, `SCROLL_SKIP` — recorded so we can show you less of what you do not want.
* **Section & Suggestion Signals**: `SECTION_VIEW`, `MARKET_SECTION_VIEW`, `SUGGESTION_BLOCK_VIEW`, `SUGGESTION_ITEM_VIEW` and their corresponding click and scroll variants.

Dwell time is recorded as one of three BANDS rather than as a duration, so the
exact number of seconds you spent on an item is never stored.

### 4.2. Buffer Management, Compaction, and Backoff
* **Client-Side Queue Storage (`wiez.market.signalQueue.v1`)**: Buffered in `localStorage` / `AsyncStorage` with a hard limit of 100 events to protect device memory.
* **De-duplication Window (`wiez.market.signalRecent.v1`)**: Rapid repeated impressions (such as scrolling past the same lookbook multiple times within 30 seconds) are automatically suppressed.
* **Batch Flushing**: Signals are flushed to the backend in batches of up to 25 events every 5,000 milliseconds (`flushWebMarketSignals`).
* **Exponential Backoff Retry**: If a network interruption occurs, the client retries failed batches with exponential backoff (base 2s, maximum 60s, up to 5 attempts) before dropping stale signals older than 24 hours.
* **Zero External Syndication**: Signals are transmitted directly to WIEZ API clusters and are never shared with or sold to third-party ad exchanges.

---

## 5. Mobile Application Storage and In-App WebView Bridges

### 5.1. Mobile Sandboxed Storage Architecture
The native mobile application (`threadly-mobile`) adheres to strict platform security guidelines:
* **iOS Sandbox**: All app data, SQLite databases, and `AsyncStorage` files reside within the application's sandboxed container directory (`Application Support` and `Caches`).
* **Android Private Storage**: App data is stored within private internal storage (`/data/data/com.wiez.app/`) with Unix file permissions restricting access exclusively to the WIEZ process UID.

### 5.2. Brand Studio Embedded WebView Bridge
When a mobile designer opens merchant tools, financial dashboards, or advanced lookbook editors (`useStudioNativeNavBridge` / `useEmbeddedSurface`):
* The native app securely synchronizes the authenticated session state into the embedded WebView (`WKWebView` on iOS, `Android System WebView` on Android).
* **Isolation Guarantee**: The WebView session is completely isolated within the WIEZ app container. It does not share cookies, browsing history, or storage with external mobile web browsers (such as Safari or Chrome).

---

## 6. Third-Party Integrations and Payment Sandboxes

### 6.1. Zero Third-Party Advertising Trackers
WIEZ maintains a strict anti-surveillance standard: **We do not deploy third-party advertising retargeting pixels, tracking beacons, or cross-site tracking scripts**. We do not participate in cross-site ad networks.

### 6.2. Payment Gateway Sandboxes (PCI-DSS Level 1)
When you complete checkout via Paystack:
* Payment forms and 3D Secure / OTP verification modals are rendered within isolated, PCI-DSS Level 1 compliant iframes.
* Payment providers may deploy strictly necessary fraud-prevention and session cookies within their own domain sandboxes.
* WIEZ has no technical access to, does not read, and does not store the internal security cookies of payment gateways.

---

## 7. Storage Lifespans and Expiration Schedules

| Classification | Expiration / Retention Behavior |
| --- | --- |
| **Session Storage** | Terminated immediately upon closing browser tab or process. |
| **Pre-Signed Image URL Caches** | Automatically invalidated after fifteen (15) minutes. |
| **Market Signal Telemetry Queue** | Flushed every 5 seconds; stale entries purge after 24 hours. |
| **Authentication Refresh Tokens** | Persist for seven (7) rolling days from last active use. |
| **Commerce Cart & Theme State** | Persists in `localStorage` until manually cleared or logout. |
| **Mobile Hardware Keychains** | Persists until explicit logout, account deletion, or purge. |

---

## 8. How You Can Control, Clear, and Block Storage

You maintain full control over cookies and client storage through your browser and device settings:

| Control Surface | Management Instructions |
| --- | --- |
| **1. Google Chrome** | Settings > Privacy and security > Third-party cookies > See all site data and permissions > Search "wiez.com". |
| **2. Apple Safari (macOS & iOS)** | macOS: Safari > Settings > Privacy > Manage Website Data. iOS: Settings > Safari > Advanced > Website Data. |
| **3. Mozilla Firefox** | Settings > Privacy & Security > Cookies and Site Data > Manage Data > Search "wiez.com". |
| **4. Mobile Device App Caches** | iOS: Settings > General > iPhone Storage > WIEZ > Offload. Android: Settings > Apps > WIEZ > Storage > Clear Cache. |
| **5. In-App Discovery Signal Reset** | You can reset your local signal queue and anonymous session identifier at any time via Settings > Privacy > Reset Feed. |

*Note: Blocking strictly necessary cookies or local storage will prevent login, bag checkout, bespoke measurement saving, and Brand Studio operations from working.*

---

## 9. Statutory Compliance, Legal Frameworks, and Consent Architecture

### 9.1. Applicable Legal Frameworks
* **European ePrivacy Directive (Directive 2002/58/EC)**: Fully compliant with Article 5(3) regarding strictly necessary exemptions and functional storage transparency.
* **Nigeria Data Protection Act (NDPA 2023)**: Compliant with Section 24 and NDPR standards for legitimate interest processing and transparent client-side caching.
* **California Consumer Privacy Act (CCPA / CPRA)**: Notice at collection compliant; zero sale or sharing of storage data for cross-context behavioral advertising.

### 9.2. Cookie Consent Architecture (ePrivacy / GDPR Compliance)

WIEZ's storage and cookie architecture is designed to minimize consent friction while respecting your legal rights:

**Strictly Necessary Storage (No Consent Required)**:
Storage items classified as strictly necessary under ePrivacy Directive Article 5(3) — specifically, authentication tokens (`refreshToken`, `accessToken`, `WIEZ_ACCESS_TOKEN`, `WIEZ_REFRESH_TOKEN`, `WIEZ_USER`) and the pending bag action (`wiez.pendingBagAction.v1`) — are deployed on a strictly-necessary exemption basis. These items cannot be opted out of without losing access to core platform functionality (login, checkout, and bespoke tailoring), and do not require prior consent under applicable law.

**Functional and Analytics Storage (Consent-Managed)**:
The market signal telemetry keys (`wiez.market.anonymousSessionId.v1`, `wiez.market.signalQueue.v1`, `wiez.market.signalRecent.v1`) and the TanStack query cache are deployed for platform performance and feed personalization. For users in jurisdictions where prior consent is required for non-essential storage (EU, UK, Nigeria):
* On first access, WIEZ presents a **Cookie and Privacy Consent Notice** explaining these storage mechanisms and requesting your consent before activating them.
* You may accept, decline, or customise your consent preferences at any time by accessing **Settings > Privacy > Cookie Preferences** within the WIEZ application.
* Declining analytics and personalization storage will disable Runway feed personalization (feed will fall back to chronological content) but will not prevent purchase, checkout, or bespoke tailoring functions.
* Your consent choice is recorded in the WIEZ `LegalAcceptance` database for audit purposes.

### 9.3. Do Not Track (DNT) Signal Policy

WIEZ acknowledges browser-level Do Not Track (DNT) signals sent via the `DNT: 1` HTTP request header. Our response policy:
* **Because WIEZ does not deploy third-party cross-site behavioral advertising trackers**, the technical concern that DNT signals primarily address does not apply to our first-party telemetry architecture.
* **For first-party analytics**: Activating DNT in your browser is treated by WIEZ as equivalent to declining optional analytics consent. When a DNT signal is detected on web sessions, WIEZ will suppress market signal queue telemetry for that session.
* **For mobile**: DNT signal controls are not natively supported at the OS level on iOS or Android. Mobile users wishing to opt out of discovery analytics should use the in-app **Settings > Privacy > Reset Feed** option or contact `privacy@wiez.com`.

---

## 10. Modifications and Version Updates

We may update this Directive periodically to reflect changes in our technical architecture or regulatory requirements. When material updates occur:
* We will provide at least **fifteen (15) days' advance notice** via an in-app banner or email alert.
* We update the "Effective Date" and version number at the top of this document.

---

## 11. Official Contact Directory

If you have questions regarding our storage practices, cryptographic security, or telemetry systems:

* **Data Protection Officer (DPO)**: `privacy@wiez.com`
* **Technical Security Team**: `security@wiez.com`
* **Mailing Address**:  
  Data Protection Office, WIEZ Platforms Limited  
  12B Admiralty Way, Lekki Phase 1,  
  Lagos, Nigeria.

