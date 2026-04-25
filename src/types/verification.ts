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
  nudgeOptOut?: boolean;
  attemptHistory?: VerificationAttemptHistoryItem[];
  latestAttempt?: Record<string, unknown> | null;
}

export interface VerificationDraftResponse {
  draftData: VerificationDraftData | null;
  lastSavedAt?: string | null;
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

export interface VerificationQueueItem {
  id: string;
  name: string;
  verificationStatus: VerificationStatusValue;
  updatedAt?: string;
  verificationSubmittedAt?: string | null;
  verificationAttemptNumber?: number;
  verificationReviewedById?: string | null;
  owner?: {
    id: string;
    email: string;
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
