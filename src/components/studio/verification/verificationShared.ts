import type {
  VerificationDraftData,
  VerificationLetterResponse,
  VerificationStatusResponse,
} from '@/types/verification';

export const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'NON_BINARY', label: 'Non-binary' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
] as const;

export const ENTITY_OPTIONS = [
  { value: 'SOLE_PROPRIETORSHIP', label: 'Sole proprietorship' },
  { value: 'BUSINESS_NAME', label: 'Registered business name' },
  { value: 'LIMITED_COMPANY', label: 'Limited company' },
  { value: 'PARTNERSHIP', label: 'Partnership' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const AUTHORITY_OPTIONS = [
  { value: 'LEGAL_OWNER', label: 'I own this business' },
  { value: 'DIRECTOR', label: 'I am a director of this business' },
  { value: 'AUTHORIZED_REPRESENTATIVE', label: 'I am an authorized representative' },
] as const;

export const ID_OPTIONS = [
  { value: 'NIN_SLIP', label: 'NIN Slip' },
  { value: 'NATIONAL_ID', label: 'National ID' },
  { value: 'INTERNATIONAL_PASSPORT', label: 'International Passport' },
  { value: 'DRIVERS_LICENSE', label: "Driver's License" },
  { value: 'VOTERS_CARD', label: "Voter's Card" },
] as const;

export const VERIFICATION_INITIAL_FORM: VerificationDraftData = {
  ownerLegalFirstName: '',
  ownerLegalLastName: '',
  ownerDateOfBirth: '',
  ownerGender: 'PREFER_NOT_TO_SAY',
  ownerPhoneNumber: '',
  ownerNin: '',
  cacNumber: '',
  businessAddress: {
    street: '',
    city: '',
    state: '',
    country: 'Nigeria',
  },
  idDocumentType: 'NIN_SLIP',
  idDocumentNumber: '',
  idDocumentExpiryDate: '',
  legalEntityType: 'BUSINESS_NAME',
  authorityType: 'LEGAL_OWNER',
  authorityProofDescription: '',
  ownerPhotoKey: '',
  idDocumentFrontKey: '',
  idDocumentBackKey: '',
  cacCertificateKey: '',
  authorityProofKey: '',
  letterKey: '',
};

export const VERIFICATION_STEPS = [
  {
    id: 'identity',
    title: 'Identity',
    summary: 'Legal name, age, and phone details',
  },
  {
    id: 'business',
    title: 'Business',
    summary: 'Entity, CAC, and operating address',
  },
  {
    id: 'authority',
    title: 'Authority',
    summary: 'Representation and document identity',
  },
  {
    id: 'uploads',
    title: 'Evidence',
    summary: 'Upload the required proof set',
  },
  {
    id: 'review',
    title: 'Review',
    summary: 'Letter, consent, and final submission',
  },
] as const;

export const uploadBinary = async (
  uploadUrl: string,
  method: 'POST' | 'PUT',
  file: File,
  fields?: Record<string, string> | null,
) => {
  if (method === 'POST') {
    const formData = new FormData();
    Object.entries(fields ?? {}).forEach(([key, value]) => {
      formData.append(key, value);
    });
    formData.append('file', file, file.name);
    const response = await fetch(uploadUrl, { method: 'POST', body: formData });
    if (!response.ok) {
      throw new Error(`Upload failed with status ${response.status}`);
    }
    return;
  }

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }
};

export const needsBackImage = (idDocumentType?: string) =>
  idDocumentType === 'NIN_SLIP' ||
  idDocumentType === 'NATIONAL_ID' ||
  idDocumentType === 'DRIVERS_LICENSE' ||
  idDocumentType === 'VOTERS_CARD';

export const mergeDraftIntoForm = (
  current: VerificationDraftData,
  draft: VerificationDraftData,
): VerificationDraftData => ({
  ...current,
  ...draft,
  businessAddress: {
    ...(current.businessAddress ?? VERIFICATION_INITIAL_FORM.businessAddress!),
    ...(draft.businessAddress ?? {}),
    street:
      draft.businessAddress?.street ??
      current.businessAddress?.street ??
      VERIFICATION_INITIAL_FORM.businessAddress!.street,
    city:
      draft.businessAddress?.city ??
      current.businessAddress?.city ??
      VERIFICATION_INITIAL_FORM.businessAddress!.city,
    state:
      draft.businessAddress?.state ??
      current.businessAddress?.state ??
      VERIFICATION_INITIAL_FORM.businessAddress!.state,
    country:
      draft.businessAddress?.country ??
      current.businessAddress?.country ??
      VERIFICATION_INITIAL_FORM.businessAddress!.country,
  },
});

export const verificationStatusLabel = (status?: string) => {
  switch (status) {
    case 'PENDING':
      return 'Pending review';
    case 'IN_REVIEW':
      return 'In review';
    case 'ADDITIONAL_INFO_REQUESTED':
      return 'More information needed';
    case 'APPROVED':
      return 'Approved';
    case 'REJECTED':
      return 'Rejected';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return 'Not submitted';
  }
};

export const verificationStatusTone = (status?: string) => {
  switch (status) {
    case 'APPROVED':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'REJECTED':
      return 'border-rose-200 bg-rose-50 text-rose-800';
    case 'ADDITIONAL_INFO_REQUESTED':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'PENDING':
    case 'IN_REVIEW':
      return 'border-sky-200 bg-sky-50 text-sky-800';
    default:
      return 'border-gray-200 bg-gray-50 text-gray-700';
  }
};

export const getVerificationCallToAction = (
  status: VerificationStatusResponse | null,
) => {
  if (!status) {
    return {
      primaryLabel: 'Start verification',
      primaryTo: '/studio/verification/apply',
    };
  }

  if (status.verificationStatus === 'APPROVED') {
    return {
      primaryLabel: 'Review badge details',
      primaryTo: '/studio/verification',
    };
  }

  if (status.verificationStatus === 'ADDITIONAL_INFO_REQUESTED') {
    return {
      primaryLabel: 'Submit requested updates',
      primaryTo: '/studio/verification/apply',
    };
  }

  if (status.canSubmit) {
    return {
      primaryLabel: status.verificationAttemptNumber > 0 ? 'Start a new attempt' : 'Start verification',
      primaryTo: '/studio/verification/apply',
    };
  }

  return {
    primaryLabel: 'View status',
    primaryTo: '/studio/verification',
  };
};

export const buildSignatureText = (
  form: VerificationDraftData,
  letter: VerificationLetterResponse | null,
) => {
  const fullName = [form.ownerLegalFirstName, form.ownerLegalLastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (fullName) {
    return fullName;
  }

  return letter?.ownerName ?? '';
};
