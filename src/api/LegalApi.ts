import { apiClient } from './httpClient';

export type LegalDocumentKey =
  | 'TERMS_OF_SERVICE'
  | 'PRIVACY_POLICY'
  | 'COOKIE_POLICY'
  | 'COMMUNITY_GUIDELINES'
  | 'SELLER_TERMS'
  | 'STORE_GUIDELINES'
  | 'BUYER_POLICY'
  | 'PAYMENT_POLICY'
  | 'COPYRIGHT_POLICY'
  | 'ACCOUNT_DELETION_POLICY'
  | 'CONTENT_POLICY';

export type LegalAcceptancePayload = {
  documentKey: LegalDocumentKey;
  version: string;
};

export type LegalDocumentDefinition = {
  key: LegalDocumentKey;
  title: string;
  slug: string;
  route: string;
  version: string;
  effectiveDate: string;
  owner: 'legal' | 'trust-safety' | 'payments' | 'commerce';
  requiresCounselReview: boolean;
};

export type LegalVersionsResponse = {
  documents: LegalDocumentDefinition[];
  required: {
    signup: LegalDocumentKey[];
    checkout: LegalDocumentKey[];
    storePublish: LegalDocumentKey[];
    contentPublish: LegalDocumentKey[];
  };
};

export const LEGAL_SIGNUP_DOCUMENT_KEYS: LegalDocumentKey[] = [
  'TERMS_OF_SERVICE',
  'PRIVACY_POLICY',
];

export const LEGAL_PAYMENT_DOCUMENT_KEYS: LegalDocumentKey[] = [
  'PAYMENT_POLICY',
];

export const LEGAL_STORE_PUBLISH_DOCUMENT_KEYS: LegalDocumentKey[] = [
  'SELLER_TERMS',
  'STORE_GUIDELINES',
];

export const LEGAL_CONTENT_PUBLISH_DOCUMENT_KEYS: LegalDocumentKey[] = [
  'CONTENT_POLICY',
  'COMMUNITY_GUIDELINES',
  'COPYRIGHT_POLICY',
];

function unwrapData<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in (payload as any)) {
    return (payload as any).data as T;
  }
  return payload as T;
}

let cachedVersions: Promise<LegalVersionsResponse> | null = null;

export async function getLegalVersions(options?: { forceRefresh?: boolean }) {
  if (!cachedVersions || options?.forceRefresh) {
    cachedVersions = apiClient
      .get('/legal/versions')
      .then((response) => unwrapData<LegalVersionsResponse>(response.data));
  }
  return cachedVersions;
}

export async function getRequiredLegalAcceptances(
  requiredKeys: LegalDocumentKey[],
): Promise<LegalAcceptancePayload[]> {
  const versions = await getLegalVersions();
  const byKey = new Map(versions.documents.map((document) => [document.key, document]));
  return requiredKeys.map((documentKey) => {
    const document = byKey.get(documentKey);
    if (!document) {
      throw new Error(`Legal document version is unavailable: ${documentKey}`);
    }
    return {
      documentKey,
      version: document.version,
    };
  });
}

/**
 * True when a request failed specifically because the current legal terms were
 * not accepted (backend `assertRequiredCurrentAcceptances` throws a 400 whose
 * message starts with "Accept the current legal terms before continuing:").
 * Used to trigger a consent step and retry — e.g. a new user signing in with
 * Google from the Login page, where consent isn't collected up front.
 */
export function isLegalAcceptanceRequiredError(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: unknown } } | null)?.response;
  if (response?.status !== undefined && response.status !== 400) return false;
  const data = response?.data as { message?: unknown } | undefined;
  const message =
    (typeof data?.message === 'string' && data.message) ||
    (typeof (error as { message?: unknown })?.message === 'string'
      ? (error as { message: string }).message
      : '');
  return message.toLowerCase().includes('legal terms before continuing');
}

export async function acceptLegalDocuments(payload: {
  acceptances: LegalAcceptancePayload[];
  source?: string;
  surface?: string;
}) {
  const response = await apiClient.post('/legal/accept', payload);
  return unwrapData<{ message?: string }>(response.data);
}
