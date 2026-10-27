# WIEZ Master Cookie, Local Storage, and Device Telemetry Directive

**Effective Date:** October 23, 2026

**Document Version:** 2026.10.23-v1.6

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
* **Nothing Optional Before You Choose**: On the web, analytics start only after you select **Accept all** or switch **Analytics** on. This covers our first-party discovery signals and, where we have enabled them, Google Analytics and Cloudflare Web Analytics (Section 6.1). In the app, discovery signals and performance tracing start only after you select **Allow**. Rejecting is as easy as accepting, and optional items start switched off.
* **Purpose Limitation**: Essential storage is used only to keep you signed in, protect your account, complete an add-to-bag you started, and remember your settings and cookie choice.

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
| `wiez.consent` | `localStorage` / `AsyncStorage` | Web / Mobile | 12 months, then we ask again | **Strictly Necessary**: Remembers your analytics choice (on the web also Faster Google sign-in) so we do not ask every time. Holds only your choices and the date you made them. |
| `wiez.market.` `anonymousSessionId.v1` | `localStorage` | Web Browser | Until you turn Analytics off | **First-Party Analytics (optional)**: Created only after you allow analytics. A random browser ID that counts a view once and groups discovery signals before you log in. Deleted when you turn Analytics off. |
| `_ga`, `_ga_<ID>` | HTTP Cookie (set by Google Analytics) | Web Browser | Up to 2 years; deleted when you turn Analytics off | **Analytics (optional)**: Set only where we have enabled Google Analytics and you allow analytics. Google uses them to distinguish visitors and sessions for page-view statistics. |
| `wiez.market.` `signalQueue.v1` | `localStorage` / `AsyncStorage` | Web / Mobile | 24 Hours / 5s Flush | **First-Party Analytics**: Client queue buffering discovery events, capped at 100 entries and flushed in batches of at most 25. |
| `wiez.market.` `signalRecent.v1` | `localStorage` / Memory Map | Web / Mobile | 30 Seconds (Window) | **Performance & Integrity**: Suppresses duplicate noisy impression events (e.g. repeated scroll passes). |
| `wiez.market.` `signalIdentity.v1`, `signalLastClearedAt.v1` | `AsyncStorage` | Mobile (iOS/Android) | Persistent | **First-Party Analytics**: Binds the queue to the current account and records when you last reset your feed signals. |
| `wiez.pendingBagAction.v1` | `sessionStorage` | Web Browser | Until the tab closes | **Functional / Commerce**: Remembers an add-to-bag you started before signing in, so it completes afterwards. Bag CONTENTS are held on our servers, not in your browser. |
| `wiez.activeBrandId` | `localStorage` | Web Browser | Persistent | **Functional / Merchant**: Active Brand Studio workspace identifier for designers managing several stores. |
| `vite-ui-theme` (web) / `wiez.theme.mode` (mobile) | `localStorage` / `AsyncStorage` | Web / Mobile | Persistent | **Preferences**: Dark Mode / Light Mode interface display state selection. |
| `wiez.profile.` `sizeCategory.v1` | `localStorage` / `AsyncStorage` | Web / Mobile | Persistent | **Preferences**: Which size chart category to show you first. |
| `wiez.device.id.v1` | `AsyncStorage` | Mobile (iOS/Android) | Until you turn analytics off | **First-Party Analytics (optional)**: Created only after you allow analytics. A random install ID that counts a view once and groups discovery signals. Deleted when you turn analytics off. |
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

On the web and in the app, this system runs only after you allow analytics (Section 9.2).

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

### 6.1. No Advertising Trackers; Optional Analytics Only With Your Consent
**We do not deploy advertising or retargeting pixels, and we do not take part in cross-site ad networks.** On the web, the following third-party services run only after you allow analytics, and only where we have enabled them:
* **Google Analytics 4 (Google LLC)**: aggregate page-view statistics. We switch off advertising features, Google signals, and ad personalization. Before a page address reaches Google, we remove query strings and replace account, order, and link identifiers, tokens, and email addresses.
* **Cloudflare Web Analytics (Cloudflare, Inc.)**: aggregate page-load and performance statistics. Cloudflare states that this service does not use cookies or local storage.
* **Sentry performance tracing** (web and app): measures how quickly screens respond. Sentry **error** reports are essential and do not depend on this choice. They set no cookies, carry no personal data (`sendDefaultPii` is disabled), and have identifiers and tokens removed from addresses.

If you turn Analytics off on the web, we stop these services, delete the Google Analytics cookies, the anonymous browser ID, and any queued discovery signals, and reload the page so nothing already loaded keeps running. In the app, turning analytics off stops performance tracing and deletes the install ID and any queued discovery signals.

### 6.2. Payment Gateway Sandboxes (PCI-DSS Level 1)
When you complete checkout via Paystack:
* Payment forms and 3D Secure / OTP verification modals are rendered within isolated, PCI-DSS Level 1 compliant iframes.
* Payment providers may deploy strictly necessary fraud-prevention and session cookies within their own domain sandboxes.
* WIEZ has no technical access to, does not read, and does not store the internal security cookies of payment gateways.

### 6.3. Google Sign-In
Google's sign-in script (`accounts.google.com`) loads when you choose **Continue with Google**. If you allow **Faster Google sign-in** in your cookie choices, it loads as soon as a sign-in page opens, so a single tap is enough. Google may set its own cookies on its domain, under Google's privacy policy.

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
| **Cookie Choice (`wiez.consent`)** | Twelve (12) months, after which we ask again. |
| **Google Analytics Cookies** | Up to two (2) years; deleted as soon as you turn Analytics off. |

---

## 8. How You Can Control, Clear, and Block Storage

You maintain full control over cookies and client storage through your browser and device settings:

| Control Surface | Management Instructions |
| --- | --- |
| **1. Google Chrome** | Settings > Privacy and security > Third-party cookies > See all site data and permissions > Search "wiez.com". |
| **2. Apple Safari (macOS & iOS)** | macOS: Safari > Settings > Privacy > Manage Website Data. iOS: Settings > Safari > Advanced > Website Data. |
| **3. Mozilla Firefox** | Settings > Privacy & Security > Cookies and Site Data > Manage Data > Search "wiez.com". |
| **4. Mobile Device App Caches** | iOS: Settings > General > iPhone Storage > WIEZ > Offload. Android: Settings > Apps > WIEZ > Storage > Clear Cache. |
| **5. Cookie & Analytics Choices** | Web: Settings > Privacy > **Change cookie settings**, or the same button on this page and the **Cookie settings** link on the sign-in pages. App: Settings > Privacy controls > **Usage analytics**. |
| **6. Discovery Signal Reset** | Web: Settings > Market & Feed > **Reset market preferences**. App: Settings > Market preferences > **Reset market preferences**. Turning analytics off also deletes the random browser or install ID and queued signals. |

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
Storage items classified as strictly necessary under ePrivacy Directive Article 5(3) — specifically, authentication tokens (`refreshToken`, `accessToken`, `WIEZ_ACCESS_TOKEN`, `WIEZ_REFRESH_TOKEN`, `WIEZ_USER`) the pending bag action (`wiez.pendingBagAction.v1`), and your cookie choice (`wiez.consent`) — are deployed on a strictly-necessary exemption basis. These items cannot be opted out of without losing access to core platform functionality (login, checkout, and bespoke tailoring), and do not require prior consent under applicable law.

**Optional Analytics (Consent Required)**:
The discovery-signal keys (`wiez.market.anonymousSessionId.v1`, `wiez.market.signalQueue.v1`, `wiez.market.signalRecent.v1`), the Google Analytics cookies, and the third-party analytics in Section 6.1 are optional. On the web:
* On your first visit, WIEZ shows a cookie notice with **Accept all**, **Reject optional**, and **Choose what to allow**. Accept and Reject are equally prominent, and every optional switch starts off.
* Until you choose, nothing optional runs: no analytics script loads, no analytics cookie is set, and no discovery signal is stored or sent.
* You can change your choice at any time from **Settings > Privacy > Change cookie settings**, from the button on this page, or from the **Cookie settings** link on the sign-in pages. Withdrawing is as easy as giving consent and takes effect at once (Section 6.1).
* Your choice is stored on your device (`wiez.consent`) for twelve months, after which we ask again. It applies to that browser only and is not sent to our servers. We also ask again if we add a new optional purpose.
* Declining analytics stops discovery signals from that browser, so recommendations rely on actions you take directly (such as likes, saves, and follows) and may be less tailored. It never prevents purchase, checkout, or bespoke tailoring.
* Inside the WIEZ app's embedded Brand Studio screens, the web cookie notice is not shown and optional web analytics stay off.

In the app:
* The first time you open the app, WIEZ asks once whether it may use analytics, with **Allow** and **Don't allow** given equal weight. Until you choose, no discovery signal is recorded, no install ID is created, and performance tracing stays off.
* You can change your choice at any time in **Settings > Privacy controls > Usage analytics**, signed in or not. Turning analytics off takes effect at once and deletes the install ID and any queued signals.
* Your choice is stored on your device (`wiez.consent`) for twelve months, after which we ask again.
* This choice is separate from notification permission, which your phone asks for on its own.

### 9.3. Do Not Track (DNT) Signal Policy

WIEZ honours the browser privacy signals **Global Privacy Control (GPC)** and **Do Not Track (DNT)**:
* **On the web**: when your browser sends either signal, WIEZ treats it as declining optional analytics, even if you selected **Accept all**. Google Analytics, Cloudflare Web Analytics, Sentry performance tracing, and discovery signals stay off, and the cookie notice shows the Analytics switch as off.
* **Advertising**: WIEZ deploys no cross-site advertising trackers, so there is nothing further for these signals to switch off.
* **In the app**: iOS and Android do not send these signals to apps. Use **Settings > Privacy controls > Usage analytics**, or contact `privacy@wiez.com`. WIEZ does not link app data with other companies' apps or websites for advertising, or share it with data brokers, so it does not show Apple's App Tracking Transparency prompt.

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

---

## Custom-order subscription queue terms

### Subscription custom-order policy scope and consumer rights

The subscription queue rules in this document apply to new custom-order queue purchases and subscription agreements shown and accepted under version `2026.10.23-v1.6`. Existing orders retain their recorded policy and payment snapshots; ready-to-wear rules are unchanged. Required notice of material changes remains applicable. Nothing here waives mandatory consumer rights, statutory refunds or access to the competent regulator or courts. Where mandatory law requires a different refund, that right prevails. [FCCPC consumer rights](https://fccpc.gov.ng/consumers/consumer-rights-responsibilities/rights-responsibilities/) explains cancellation rights and reasonable charges.

## Queue countdowns, billing and functional storage

The queue may use existing authenticated functional caches to display your position, billing state, held payment, expiry countdown and refund progress. These displays do not create a wallet or authorize payment. The server's order, payment and deadline records govern; a device clock or stale/offline cache cannot confirm retain, cancellation, payment or refund completion. Reopening or reconnecting refreshes those records. Recurring-payment and legal acceptance evidence stays on the server. This feature does not introduce a new advertising tracker or override cookie/marketing choices. Reminder failures or unavailable app access do not create an extension to the scheduled waiting-order expiry; see the Buyer and Payment Policies for the no-grace rule.

### Original-payment conversion for custom-order refunds

When the original custom-order payment was converted into a different provider currency, its refund uses the original payment's recorded exchange-rate snapshot. WIEZ records the refund conversion, currency and provider amount for reconciliation; later exchange-rate changes do not reprice the refund. Shared-payment refunds use cumulative minor-unit rounding so their total cannot exceed the captured amount. If the original conversion cannot be verified, cancellation remains recorded and the refund requires reconciliation before provider submission. The refund quote identifies any estimated converted amount; provider processing and bank credit remain separate.

An agreed post-Active partial dispute refund returns only the agreed amount. The order continues in its existing production/delivery lane. Each refund is recorded separately, repeat requests cannot duplicate it, and any later full remedy refunds only the remaining refundable balance. Future milestone earnings are reduced for the refunded share; no held milestone becomes payable because of a partial refund.
