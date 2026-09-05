export type VerificationStatusValue =
  | 'NOT_SUBMITTED'
  | 'PENDING'
  | 'IN_REVIEW'
  | 'ADDITIONAL_INFO_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type VerificationAuthorityTypeValue =
  | 'LEGAL_OWNER'
  | 'DIRECTOR'
  | 'AUTHORIZED_REPRESENTATIVE';

export type VerificationIdDocumentTypeValue =
  | 'NIN_SLIP'
  | 'NATIONAL_ID'
  | 'INTERNATIONAL_PASSPORT'
  | 'DRIVERS_LICENSE'
  | 'VOTERS_CARD';

export type VerificationLegalEntityTypeValue =
  | 'SOLE_PROPRIETORSHIP'
  | 'BUSINESS_NAME'
  | 'LIMITED_COMPANY'
  | 'PARTNERSHIP'
  | 'OTHER';

export type VerificationOwnerGenderValue =
  | 'MALE'
  | 'FEMALE'
  | 'NON_BINARY'
  | 'PREFER_NOT_TO_SAY';

export interface VerificationAttemptHistoryItem {
  id: string;
  attemptNumber: number;
  status: VerificationStatusValue;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  cancelledAt?: string | null;
  rejectionReasons?: VerificationReason[] | null;
}

export interface VerificationDocumentItem {
  key: string;
  label: string;
  s3Key: string;
  signedUrl: string | null;
  mimeType?: string | null;
  size?: number | null;
}

export interface VerificationBadgeState {
  isVerifiedBrand: boolean;
  verificationBadgeVisible: boolean;
  verifiedExplanationUrl: string | null;
}

export interface VerificationBusinessAddress {
  street: string;
  city: string;
  state: string;
  country: string;
}

export interface VerificationReason {
  code: string;
  label: string;
  category?: string;
  customReason?: string;
}

export interface VerificationInfoItem {
  field: string;
  label: string;
  message?: string;
}

export interface VerificationDraftData {
  ownerLegalFirstName?: string;
  ownerLegalLastName?: string;
  ownerDateOfBirth?: string;
  ownerGender?: VerificationOwnerGenderValue;
  ownerPhoneNumber?: string;
  ownerNin?: string;
  cacNumber?: string;
  businessAddress?: VerificationBusinessAddress;
  idDocumentType?: VerificationIdDocumentTypeValue;
  idDocumentNumber?: string;
  idDocumentExpiryDate?: string;
  legalEntityType?: VerificationLegalEntityTypeValue;
  authorityType?: VerificationAuthorityTypeValue;
  authorityProofDescription?: string;
  ownerPhotoKey?: string;
  idDocumentFrontKey?: string;
  idDocumentBackKey?: string;
  cacCertificateKey?: string;
  authorityProofKey?: string;
  letterKey?: string;
}

/**
 * Store-setup steps still outstanding before verification may be applied for.
 *
 * The verified badge requires an APPROVED verification AND an open store, so a
 * brand that verified with an unpublished store got an approval that produced
 * no badge and no explanation. Submission is now gated on this, and each entry
 * carries the route that fixes it.
 */
export interface VerificationStorePendingStep {
  code: string;
  label: string;
  href: string;
}

export interface VerificationStoreReadiness {
  isReady: boolean;
  pending: VerificationStorePendingStep[];
}

export interface VerificationStatusResponse {
  brandId: string;
  verificationStatus: VerificationStatusValue;
  updatedAt: string;
  verificationSubmittedAt?: string | null;
  verificationReviewedAt?: string | null;
  verificationReviewStartedAt?: string | null;
  verificationCancelledAt?: string | null;
  verificationAttemptNumber: number;
  verificationRejectionCount: number;
  cooldownExpiresAt?: string | null;
  cooldownRemainingDays: number;
  rejectionReasons: VerificationReason[];
  infoRequestedAt?: string | null;
  infoRequestedItems: VerificationInfoItem[];
  infoRequestMessage?: string | null;
  badgeState: VerificationBadgeState;
  canSubmit: boolean;
  storeReadiness?: VerificationStoreReadiness;
  nudgeOptOut?: boolean;
  attemptHistory?: VerificationAttemptHistoryItem[];
  latestAttempt?: Record<string, unknown> | null;
}

export interface VerificationDraftResponse {
  draftData: VerificationDraftData | null;
  lastSavedAt?: string | null;
  /**
   * Where `draftData` came from. `LAST_ATTEMPT` means the saved draft was
   * consumed by a previous submission and the server rebuilt the form from the
   * attempt on file — the owner is correcting a filed package, not resuming an
   * unsent one, and the UI says so.
   */
  source?: 'DRAFT' | 'LAST_ATTEMPT' | 'EMPTY';
}

export interface VerificationLetterResponse {
  version: number;
  title: string;
  body: string;
  brandName: string;
  ownerName: string;
}

export interface VerificationUploadInstruction {
  fileId: string;
  expectedKey: string;
  uploadUrl: string;
  uploadFields?: Record<string, string> | null;
  method: 'POST' | 'PUT';
  expiresIn?: number;
}

export interface VerificationUploadResult {
  fileId: string;
  s3Key: string;
  s3Url: string;
  mimeType: string;
  size: number;
}

export interface VerificationNote {
  id: string;
  brandId: string;
  adminId: string;
  text: string;
  createdAt: string;
}

/**
 * One entry in the verification audit trail: either an admin asking for more
 * information, or the brand filing a submission.
 *
 * Reconstructed server-side from the admin audit log (requests) and the attempt
 * rows (submissions), because the live `infoRequested*` columns are overwritten
 * by each new request and cleared the moment the brand replies.
 */
export type VerificationHistoryEvent =
  | {
      id: string;
      kind: 'INFO_REQUESTED';
      at: string;
      /**
       * `VerificationInfoItem` objects — `{ field, label, message? }` — NOT
       * strings. Rendering them directly produced "[object Object]" in the
       * request history. Older audit rows may hold bare strings, so read them
       * through `verificationInfoItemLabel`.
       */
      items: Array<VerificationInfoItem | string>;
      message: string | null;
      actor: { id: string; name: string } | null;
    }
  | {
      id: string;
      kind: 'BRAND_SUBMITTED';
      at: string;
      attemptNumber: number;
      status: VerificationStatusValue;
      /** What this particular submission was answering, if anything. */
      respondedToItems: Array<VerificationInfoItem | string>;
      respondedToMessage: string | null;
    };

/**
 * Display label for one requested item, tolerating both the object form the
 * admin console sends and any bare-string rows already in the audit log.
 */
export const verificationInfoItemLabel = (
  item: VerificationInfoItem | string,
): string => {
  if (typeof item === 'string') return item.replace(/_/g, ' ');
  return (item.label || item.field || '').replace(/_/g, ' ');
};

/** The reviewer's per-item note, when they attached one. */
export const verificationInfoItemMessage = (
  item: VerificationInfoItem | string,
): string | null =>
  typeof item === 'string' ? null : item.message?.trim() || null;

export interface VerificationHistoryResponse {
  events: VerificationHistoryEvent[];
  totalInfoRequests: number;
  totalSubmissions: number;
}

export interface VerificationQueueItem {
  id: string;
  name: string;
  verificationStatus: VerificationStatusValue;
  createdAt?: string;
  updatedAt?: string;
  verificationSubmittedAt?: string | null;
  verificationAttemptNumber?: number;
  verificationReviewedById?: string | null;
  verificationInfoRequestedAt?: string | null;
  verificationInfoRespondedAt?: string | null;
  /**
   * The brand has answered an information request and no reviewer has acted on
   * the answer yet. Derived server-side so every client agrees.
   *
   * Without it a resubmission just puts the row back to IN_REVIEW, which looks
   * identical to every other in-review brand — the reviewer who asked for the
   * change had nothing on the table telling them it had arrived.
   */
  hasUnreviewedInfoResponse?: boolean;
  owner?: {
    id: string;
    email: string;
    username?: string;
    firstName: string;
    lastName: string;
    status?: string;
    profileImage?: string | null;
  };
}

export interface VerificationQueueResponse {
  items: VerificationQueueItem[];
  nextCursor?: string;
  totalPending: number;
}

export interface AdminVerificationDetails extends VerificationQueueItem {
  ownerId?: string;
  owner?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status?: string;
  };
  verificationStatus: VerificationStatusValue;
  verificationAttempts?: Array<Record<string, unknown>>;
  verificationNotes?: VerificationNote[];
  latestAttempt?: Record<string, unknown> | null;
  maskedOwnerNin?: string | null;
  verificationInfoRequestedItems?: VerificationInfoItem[] | null;
  verificationInfoRequestMessage?: string | null;
  documents?: VerificationDocumentItem[];
  badgeState?: VerificationBadgeState;
}
