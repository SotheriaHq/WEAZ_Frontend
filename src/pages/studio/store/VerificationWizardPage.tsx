import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import VLoader from '@/components/loaders/VLoader';
import MediaRenderer from '@/components/media/MediaRenderer';
import {
  AUTHORITY_OPTIONS,
  buildSignatureText,
  ENTITY_OPTIONS,
  GENDER_OPTIONS,
  ID_OPTIONS,
  mergeDraftIntoForm,
  needsBackImage,
  uploadBinary,
  VERIFICATION_INITIAL_FORM,
  VERIFICATION_STEPS,
  verificationStatusLabel,
  verificationStatusTone,
} from '@/components/studio/verification/verificationShared';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import StudioPageSkeleton from '@/components/studio/StudioPageSkeleton';
import { brandApi } from '@/api/BrandApi';
import type { RootState } from '@/store';
import type {
  VerificationDraftData,
  VerificationLetterResponse,
  VerificationStatusResponse,
} from '@/types/verification';
import { setUser } from '@/features/userSlice';
import Modal from '@/components/ui/Modal';
import {
  isEmptyPhone,
  isValidPhone,
  normalizePhoneToE164,
  PHONE_INVALID_MESSAGE,
  PHONE_REQUIRED_MESSAGE,
  sanitizePhoneInput,
} from '@/utils/phoneNumber';

const DOCUMENT_UPLOADS = [
  { key: 'ownerPhotoKey', label: 'Owner Selfie / Photo', documentType: 'OWNER_PHOTO', hint: 'Frontal clear portrait of store owner or director.' },
  { key: 'idDocumentFrontKey', label: 'Government ID (Front)', documentType: 'ID_FRONT', hint: 'Clear capture of the front of your government ID.' },
  { key: 'idDocumentBackKey', label: 'Government ID (Back)', documentType: 'ID_BACK', hint: 'Clear capture of the back side of your ID card.' },
  {
    key: 'cacCertificateKey',
    label: 'CAC Certificate / Registration',
    documentType: 'CAC_CERTIFICATE',
    hint: 'Corporate Affairs Commission or business registration proof.',
  },
  {
    key: 'authorityProofKey',
    label: 'Letter of Authorization',
    documentType: 'AUTHORITY_PROOF',
    hint: 'Must be signed by a current Director if representative is not listed.',
  },
] as const;

type UploadFieldKey = (typeof DOCUMENT_UPLOADS)[number]['key'];

const isExpiryDateTooSoon = (expiryDateStr?: string): boolean => {
  if (!expiryDateStr) return false;
  const expiryDate = new Date(expiryDateStr);
  if (Number.isNaN(expiryDate.getTime())) return false;
  
  const oneWeekFromToday = new Date();
  oneWeekFromToday.setHours(0, 0, 0, 0);
  oneWeekFromToday.setDate(oneWeekFromToday.getDate() + 7);
  
  return expiryDate.getTime() <= oneWeekFromToday.getTime();
};

export default function VerificationWizardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.user.profile);
  const userRef = useRef(user);
  const brandId = user?.id;

  const [status, setStatus] = useState<VerificationStatusResponse | null>(null);
  const [letter, setLetter] = useState<VerificationLetterResponse | null>(null);
  const [form, setForm] = useState<VerificationDraftData>(
    VERIFICATION_INITIAL_FORM,
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasDraft, setHasDraft] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signing, setSigning] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [dragActiveField, setDragActiveField] = useState<string | null>(null);
  const [showSubmitPreview, setShowSubmitPreview] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    details: true,
    guidelines: false,
  });
  const [uploadPreviewUrls, setUploadPreviewUrls] = useState<Partial<Record<UploadFieldKey, string>>>({});
  const [localObjectUrls, setLocalObjectUrls] = useState<Partial<Record<UploadFieldKey, string>>>({});
  const [lastSignedAt, setLastSignedAt] = useState<string | null>(null);
  const saveDraftLockRef = useRef(false);
  const submitLockRef = useRef(false);
  const ownerPhoneNumberEditedRef = useRef(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    return () => {
      Object.values(localObjectUrls).forEach((url) => {
        if (url && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [localObjectUrls]);

  const originPath =
    typeof (location.state as { from?: unknown } | null)?.from === 'string'
      ? String((location.state as { from?: string }).from)
      : '/studio/verification';

  const signatureText = useMemo(
    () => buildSignatureText(form, letter),
    [form, letter],
  );

  const getPreviewUrl = (fieldKey: UploadFieldKey): string | undefined => {
    return localObjectUrls[fieldKey] || uploadPreviewUrls[fieldKey];
  };

  const wizardLockMessage = useMemo(() => {
    if (!status) return null;
    if (status.verificationStatus === 'ADDITIONAL_INFO_REQUESTED') return null;
    if (status.canSubmit) return null;
    if (status.verificationStatus === 'APPROVED') {
      return 'Verification is already approved for this store. Use the status workspace to review the active badge state.';
    }
    if (
      status.verificationStatus === 'PENDING' ||
      status.verificationStatus === 'IN_REVIEW'
    ) {
      return 'This attempt is already in the review queue. The wizard unlocks again only if WIEZ requests more information or a new attempt becomes available.';
    }
    if (
      status.verificationStatus === 'REJECTED' &&
      status.cooldownRemainingDays > 0
    ) {
      return `A cooldown is active for ${status.cooldownRemainingDays} more day(s). Start the next attempt from the status workspace when that lockout ends.`;
    }
    return 'This submission path is currently locked. Return to the verification workspace for the latest state.';
  }, [status]);

  useEffect(() => {
    if (!brandId) return;

    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        ownerPhoneNumberEditedRef.current = false;
        const [statusData, draftData, letterData] = await Promise.all([
          brandApi.getVerificationStatus(brandId),
          brandApi.getVerificationDraft(brandId),
          brandApi.getVerificationLetter(brandId),
        ]);
        if (!active) return;
        setStatus(statusData);
        setLetter(letterData);
        if (draftData.draftData) {
          setForm((current) => mergeDraftIntoForm(current, draftData.draftData!));
        }
        const loadedDraft = draftData?.draftData;
        const loadedHasDraft =
          !!draftData?.lastSavedAt ||
          Object.values(loadedDraft ?? {}).some((value) => {
            if (typeof value === 'string') return value.trim().length > 0;
            if (typeof value === 'number') return Number.isFinite(value);
            if (!value || typeof value !== 'object') return false;
            return Object.values(value as Record<string, unknown>).some((nested) =>
              typeof nested === 'string' ? nested.trim().length > 0 : nested != null,
            );
          });
        setHasDraft(loadedHasDraft);
        const draftStep = Number(
          (draftData.draftData as Record<string, unknown> | null)?.currentStep ??
            1,
        );
        if (Number.isFinite(draftStep) && draftStep > 0) {
          setStepIndex(Math.min(VERIFICATION_STEPS.length - 1, draftStep - 1));
        }
        const currentUser = userRef.current;
        if (currentUser) {
          dispatch(
            setUser({
              ...currentUser,
              verificationStatus: statusData.verificationStatus,
              isVerifiedBrand: statusData.badgeState.isVerifiedBrand,
              verificationBadgeVisible:
                statusData.badgeState.verificationBadgeVisible,
              verifiedExplanationUrl:
                statusData.badgeState.verifiedExplanationUrl,
            }),
          );
        }
      } catch (error: any) {
        if (!active) return;
        toast.error(
          error?.response?.data?.message ||
            'Unable to load verification wizard',
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [brandId, dispatch]);

  useEffect(() => {
    const lockedCountry = String((user as { brandCountry?: string } | null)?.brandCountry ?? '').trim() || 'Nigeria';
    const lockedState = String((user as { brandState?: string } | null)?.brandState ?? '').trim();
    if (!lockedCountry && !lockedState) return;

    setForm((current) => {
      const currentAddress = current.businessAddress ?? VERIFICATION_INITIAL_FORM.businessAddress!;
      const nextCountry = lockedCountry || currentAddress.country || 'Nigeria';
      const nextState = lockedState || currentAddress.state || '';
      if (currentAddress.country === nextCountry && currentAddress.state === nextState) {
        return current;
      }
      return mergeDraftIntoForm(current, {
        businessAddress: {
          ...currentAddress,
          country: nextCountry,
          state: nextState,
        },
      });
    });
  }, [user]);

  useEffect(() => {
    const savedPhoneNumber = String(user?.phoneNumber ?? '').trim();
    if (!savedPhoneNumber || ownerPhoneNumberEditedRef.current) {
      return;
    }

    setForm((current) => {
      if ((current.ownerPhoneNumber ?? '').trim() === savedPhoneNumber) {
        return current;
      }

      return mergeDraftIntoForm(current, { ownerPhoneNumber: savedPhoneNumber });
    });
  }, [user?.phoneNumber]);

  useEffect(() => {
    let cancelled = false;
    const syncPreviewUrls = async () => {
      const uploads = DOCUMENT_UPLOADS.map((item) => {
        const key = item.key as UploadFieldKey;
        const s3Key = String(form[key] ?? '').trim();
        return { key, s3Key };
      }).filter((item) => item.s3Key.length > 0);

      for (const item of uploads) {
        if (uploadPreviewUrls[item.key] || localObjectUrls[item.key]) {
          continue;
        }
        try {
          const signedUrl = await brandApi.getSignedS3KeyUrl(item.s3Key);
          if (!cancelled && signedUrl) {
            setUploadPreviewUrls((current) => ({ ...current, [item.key]: signedUrl }));
          }
        } catch {
          // Best-effort preview fetch only.
        }
      }
    };

    void syncPreviewUrls();

    return () => {
      cancelled = true;
    };
  }, [form, localObjectUrls, uploadPreviewUrls]);

  const setField = <K extends keyof VerificationDraftData>(
    key: K,
    value: VerificationDraftData[K],
  ) => {
    if (key === 'ownerPhoneNumber') {
      ownerPhoneNumberEditedRef.current = true;
    }
    setForm((current) => ({ ...current, [key]: value }));
  };

  const setAddressField = (
    key: keyof NonNullable<VerificationDraftData['businessAddress']>,
    value: string,
  ) => {
    setForm((current) =>
      mergeDraftIntoForm(current, {
        businessAddress: {
          ...(current.businessAddress ?? VERIFICATION_INITIAL_FORM.businessAddress!),
          [key]: value,
        },
      }),
    );
  };

  const saveDraft = async (
    nextStep = stepIndex + 1,
    options?: { redirectToCatalog?: boolean; silent?: boolean },
  ) => {
    if (!brandId || saveDraftLockRef.current) return;
    try {
      saveDraftLockRef.current = true;
      setSavingDraft(true);
      await brandApi.saveVerificationDraft(brandId, form, nextStep);
      const resolvedPhoneNumber =
        normalizePhoneToE164(form.ownerPhoneNumber) ??
        String(form.ownerPhoneNumber ?? '').trim();
      if (user && resolvedPhoneNumber && (user.phoneNumber ?? '').trim() !== resolvedPhoneNumber) {
        dispatch(
          setUser({
            ...user,
            phoneNumber: resolvedPhoneNumber,
          }),
        );
      }
      if (!options?.silent) {
        toast.success('Draft saved');
      }
      if (options?.redirectToCatalog) {
        navigate('/studio/store');
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || 'Unable to save verification draft',
      );
    } finally {
      setSavingDraft(false);
      saveDraftLockRef.current = false;
    }
  };

  const handleUpload = async (
    field: keyof VerificationDraftData,
    documentType: string,
    file: File | null,
  ) => {
    if (!brandId || !file) return;

    // Cache local blob URL for instant 0ms preview rendering without network overhead
    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
      const localUrl = URL.createObjectURL(file);
      setLocalObjectUrls((prev) => {
        if (prev[field as UploadFieldKey]?.startsWith('blob:')) {
          URL.revokeObjectURL(prev[field as UploadFieldKey]!);
        }
        return { ...prev, [field as UploadFieldKey]: localUrl };
      });
    }

    try {
      setUploadingField(field);
      const presign = await brandApi.presignVerificationUpload(brandId, {
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        documentType,
      });
      await uploadBinary(
        presign.uploadUrl,
        presign.method,
        file,
        presign.uploadFields,
      );
      const finalized = await brandApi.finalizeVerificationUpload(brandId, {
        fileId: presign.fileId,
        key: presign.expectedKey,
        actualMimeType: file.type || 'application/octet-stream',
        actualSize: file.size,
      });
      setField(field, finalized.s3Key as VerificationDraftData[typeof field]);
      toast.success(`${file.name} uploaded`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Upload failed');
    } finally {
      setUploadingField(null);
    }
  };

  const handleSignLetter = async () => {
    if (!brandId || !letter) return;
    if (!signatureText) {
      toast.error('Enter the legal first and last name before signing the letter');
      return;
    }
    try {
      setSigning(true);
      const response = await brandApi.signVerificationLetter(brandId, {
        signatureMethod: 'TYPED',
        typedSignatureText: signatureText,
        signatureImage:
          typeof window !== 'undefined'
            ? window.btoa(signatureText)
            : signatureText,
        letterVersion: letter.version,
      });
      setField('letterKey', response.letterKey);
      setLastSignedAt(new Date().toISOString());
      toast.success('Verification letter signed');
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          'Unable to sign the verification letter',
      );
    } finally {
      setSigning(false);
    }
  };

  const validateStep = (index: number) => {
    if (index === 0) {
      const resolvedPhoneNumber =
        form.ownerPhoneNumber?.trim() || String(user?.phoneNumber ?? '').trim();
      if (!form.ownerLegalFirstName?.trim() || !form.ownerLegalLastName?.trim()) {
        throw new Error('Enter the legal first and last name');
      }
      if (!form.ownerDateOfBirth) {
        throw new Error('Date of birth is required');
      }
      if (isEmptyPhone(resolvedPhoneNumber)) {
        throw new Error(PHONE_REQUIRED_MESSAGE);
      }
      if (!isValidPhone(resolvedPhoneNumber)) {
        throw new Error(PHONE_INVALID_MESSAGE);
      }
      if (!form.ownerNin?.trim()) {
        throw new Error('Owner NIN is required');
      }
    }

    if (index === 1) {
      if (!form.cacNumber?.trim()) {
        throw new Error('CAC number is required');
      }
      if (
        !form.businessAddress?.street?.trim() ||
        !form.businessAddress?.city?.trim() ||
        !form.businessAddress?.state?.trim() ||
        !form.businessAddress?.country?.trim()
      ) {
        throw new Error('Complete the full business address');
      }
    }

    if (index === 2) {
      if (!form.idDocumentNumber?.trim()) {
        throw new Error('ID document number is required');
      }
      if (form.idDocumentExpiryDate && isExpiryDateTooSoon(form.idDocumentExpiryDate)) {
        throw new Error('ID document expiry date must be valid for at least 1 week from today');
      }
      if (
        form.authorityType === 'AUTHORIZED_REPRESENTATIVE' &&
        !form.authorityProofDescription?.trim()
      ) {
        throw new Error('Explain the authority arrangement');
      }
    }

    if (index === 3) {
      if (!form.ownerPhotoKey || !form.idDocumentFrontKey || !form.cacCertificateKey) {
        throw new Error('Upload the required evidence files');
      }
      if (needsBackImage(form.idDocumentType) && !form.idDocumentBackKey) {
        throw new Error('Upload the back of the selected ID document');
      }
      if (
        form.authorityType === 'AUTHORIZED_REPRESENTATIVE' &&
        !form.authorityProofKey
      ) {
        throw new Error('Upload proof of authority');
      }
    }

    if (index === 4 && !form.letterKey) {
      throw new Error('Sign the verification letter before submitting');
    }
  };

  const goToStep = async (nextIndex: number) => {
    try {
      validateStep(Math.min(stepIndex, nextIndex));
      setStepIndex(nextIndex);
      await saveDraft(nextIndex + 1);
    } catch (error: any) {
      toast.error(error.message || 'Complete the current step before moving on');
    }
  };

  const handleSubmit = async () => {
    if (!brandId || !status || submitLockRef.current) return;

    try {
      submitLockRef.current = true;
      validateStep(4);
      const rawPhone =
        form.ownerPhoneNumber?.trim() || String(user?.phoneNumber ?? '').trim();
      const resolvedPhoneNumber = normalizePhoneToE164(rawPhone) ?? rawPhone;
      setSubmitting(true);
      const payload: Record<string, unknown> = {
        ownerLegalFirstName: form.ownerLegalFirstName,
        ownerLegalLastName: form.ownerLegalLastName,
        ownerDateOfBirth: form.ownerDateOfBirth,
        ownerGender: form.ownerGender,
        ownerPhoneNumber: resolvedPhoneNumber,
        ownerNin: form.ownerNin,
        cacNumber: form.cacNumber,
        businessAddress: form.businessAddress,
        idDocumentType: form.idDocumentType,
        idDocumentNumber: form.idDocumentNumber,
        idDocumentExpiryDate: form.idDocumentExpiryDate,
        legalEntityType: form.legalEntityType,
        authorityType: form.authorityType,
        authorityProofDescription: form.authorityProofDescription,
        ownerPhotoKey: form.ownerPhotoKey,
        idDocumentFrontKey: form.idDocumentFrontKey,
        idDocumentBackKey: form.idDocumentBackKey,
        cacCertificateKey: form.cacCertificateKey,
        authorityProofKey: form.authorityProofKey,
        letterKey: form.letterKey,
      };
      if (status.verificationStatus === 'ADDITIONAL_INFO_REQUESTED') {
        await brandApi.resubmitVerificationInfo(brandId, payload);
        toast.success('Requested verification updates submitted');
      } else {
        await brandApi.submitVerification(brandId, payload);
        toast.success('Verification submitted');
      }
      const refreshed = await brandApi.getVerificationStatus(brandId, {
        force: true,
      });
      setStatus(refreshed);
      if (user) {
        dispatch(
          setUser({
            ...user,
            phoneNumber: resolvedPhoneNumber || user.phoneNumber,
            verificationStatus: refreshed.verificationStatus,
            isVerifiedBrand: refreshed.badgeState.isVerifiedBrand,
            verificationBadgeVisible:
              refreshed.badgeState.verificationBadgeVisible,
            verifiedExplanationUrl:
              refreshed.badgeState.verifiedExplanationUrl,
          }),
        );
      }
      startTransition(() => {
        navigate('/studio/verification/submitted');
      });
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || error?.message || 'Unable to submit verification',
      );
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  };

  const completionStats = useMemo(() => {
    const requiredChecklist = [
      Boolean(form.ownerLegalFirstName?.trim()),
      Boolean(form.ownerLegalLastName?.trim()),
      Boolean(form.ownerDateOfBirth),
      Boolean(form.ownerPhoneNumber?.trim() || String(user?.phoneNumber ?? '').trim()),
      Boolean(form.ownerNin?.trim()),
      Boolean(form.cacNumber?.trim()),
      Boolean(form.businessAddress?.street?.trim()),
      Boolean(form.businessAddress?.city?.trim()),
      Boolean(form.businessAddress?.state?.trim()),
      Boolean(form.businessAddress?.country?.trim()),
      Boolean(form.idDocumentNumber?.trim()),
      Boolean(form.ownerPhotoKey),
      Boolean(form.idDocumentFrontKey),
      Boolean(form.cacCertificateKey),
      Boolean(form.letterKey),
    ];
    if (needsBackImage(form.idDocumentType)) {
      requiredChecklist.push(Boolean(form.idDocumentBackKey));
    }
    if (form.authorityType === 'AUTHORIZED_REPRESENTATIVE') {
      requiredChecklist.push(Boolean(form.authorityProofDescription?.trim()));
      requiredChecklist.push(Boolean(form.authorityProofKey));
    }
    const completedCount = requiredChecklist.filter(Boolean).length;
    const totalCount = requiredChecklist.length;
    const percent = Math.min(100, Math.round((completedCount / totalCount) * 100));
    return { completedCount, totalCount, percent };
  }, [form, user?.phoneNumber]);

  const step = VERIFICATION_STEPS[stepIndex];

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return <StudioPageSkeleton variant="form" />;
  }

  return (
    <div className="space-y-4 bg-surface min-h-[calc(100vh-100px)] flex flex-col">
      {/* Top Header: Single Minimal Row (Scaled down 80%) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-surface-container-lowest p-3.5 sm:p-4 rounded-xl border border-outline-variant/20 shadow-sm relative overflow-hidden shrink-0">
        <div className="absolute top-0 left-0 right-0 h-1 bg-surface-container-highest">
          <div
            className="h-full bg-gradient-to-r from-primary via-tertiary to-primary transition-all duration-500 ease-out"
            style={{ width: `${completionStats.percent}%` }}
          ></div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/studio/verification', { state: { from: originPath } })}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant text-xs shadow-sm hover:bg-surface-container-low transition-all"
              aria-label="Back to verification"
            >
              ←
            </button>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-highest text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              Step {stepIndex + 1} of {VERIFICATION_STEPS.length} — {step.title}
            </div>
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-on-surface leading-tight">Guided Seller Verification</h1>
            <p className="text-xs text-on-surface-variant truncate max-w-xl">
              {step.summary}. Matches official legal documents.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-end lg:self-center">
          <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1 rounded-lg border border-outline-variant/20">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Completion</span>
            <span className="text-xs font-bold text-primary tabular-nums">{completionStats.percent}% ({completionStats.completedCount}/{completionStats.totalCount})</span>
          </div>
          <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${verificationStatusTone(status?.verificationStatus)}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            {status?.verificationStatus === 'NOT_SUBMITTED' && hasDraft
              ? 'Drafted'
              : verificationStatusLabel(status?.verificationStatus)}
          </div>
        </div>
      </div>

      {wizardLockMessage ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm shrink-0">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
            Submission locked
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-amber-900">
            {wizardLockMessage}
          </p>
          <div className="mt-3">
            <Button size="sm" onClick={() => navigate('/studio/verification')}>
              Return to status workspace
            </Button>
          </div>
        </section>
      ) : null}

      {!wizardLockMessage ? (
        <div className="flex flex-col lg:flex-row gap-6 w-full items-start flex-1 min-h-0">
          {/* Left Sidebar: Stepper Path */}
          <aside className="w-full lg:w-64 shrink-0 lg:sticky lg:top-24">
            <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.02)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/5 to-transparent rounded-bl-full pointer-events-none"></div>
              <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-5">Verification Path</h3>
              
              <div className="relative space-y-6">
                {/* Vertical Connecting Line */}
                <div className="absolute left-[11px] top-2 bottom-4 w-0.5 bg-outline-variant/30"></div>

                {VERIFICATION_STEPS.map((item, index) => {
                  const isActive = index === stepIndex;
                  const isComplete = index < stepIndex;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (index <= stepIndex) {
                          setStepIndex(index);
                          return;
                        }
                        void goToStep(index);
                      }}
                      className="relative flex items-start gap-3.5 text-left w-full group transition-all"
                    >
                      {isComplete ? (
                        <div className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 z-10 shadow-[0_0_10px_rgba(109,35,249,0.3)] transition-transform group-hover:scale-110">
                          <span className="text-xs font-bold">✓</span>
                        </div>
                      ) : isActive ? (
                        <div className="w-6 h-6 rounded-full bg-surface-container-lowest ring-2 ring-primary flex items-center justify-center shrink-0 z-10 relative">
                          <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                          <div className="absolute -inset-2 rounded-full bg-primary/10 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-surface-container-high border border-outline-variant/40 text-on-surface-variant flex items-center justify-center shrink-0 z-10 text-[11px] font-medium group-hover:border-primary/50 group-hover:text-primary transition-colors">
                          {index + 1}
                        </div>
                      )}

                      <div className="pt-0.5">
                        <p className={`text-xs font-bold transition-colors ${
                          isActive
                            ? 'text-primary'
                            : isComplete
                              ? 'text-on-surface'
                              : 'text-on-surface-variant/70 group-hover:text-on-surface'
                        }`}>
                          {item.title}
                        </p>
                        <p className={`text-[11px] mt-0.5 ${
                          isActive
                            ? 'text-primary/80 font-medium'
                            : 'text-on-surface-variant/70'
                        }`}>
                          {isComplete ? 'Verified' : isActive ? 'In Progress' : item.summary}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Right Main Form Container (Inline Scrollable, Screen height preserved) */}
          <div className="flex-1 min-w-0 max-w-4xl lg:max-h-[calc(100vh-180px)] lg:overflow-y-auto lg:pr-2 space-y-6 rounded-2xl scrollbar-thin scrollbar-thumb-outline-variant/40">
            <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-8 border border-outline-variant/30 shadow-[0_8px_32px_rgba(0,0,0,0.03)] relative overflow-hidden flex flex-col justify-between min-h-[500px]">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-tertiary to-primary opacity-80"></div>
              
              {/* Form Content */}
              <div className="space-y-6">
                <div className="flex items-start justify-between border-b border-outline-variant/20 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-on-surface tracking-tight">{step.title} Details</h2>
                    <p className="mt-1 text-xs text-on-surface-variant leading-relaxed">
                      {step.summary}. Ensure information provided matches registered legal documents.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSection('guidelines')}
                    className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-primary hover:bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/20 transition-colors shrink-0"
                  >
                    <span>{expandedSections.guidelines ? 'Hide instructions' : 'View instructions'}</span>
                  </button>
                </div>

                {expandedSections.guidelines && (
                  <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs leading-relaxed text-on-surface-variant space-y-1">
                    <p className="font-semibold text-on-surface">💡 System Guidelines:</p>
                    <p>• Provide exact legal spelling as shown on government IDs or CAC registration.</p>
                    <p>• Uploaded documents must be clear, flat, legible captures in JPEG, PNG, or PDF formats.</p>
                    <p>• Your progress is continuously autosaved. You can return at any time to finish your draft.</p>
                  </div>
                )}

                {/* Step 1: Identity */}
                {step.id === 'identity' ? (
                  <div className="space-y-6">
                    <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-on-surface flex items-center gap-3">
                      <span className="text-lg shrink-0">👤</span>
                      <p className="leading-normal">
                        <strong className="text-primary font-bold">Owner / CEO / Founder Data Collection:</strong> Provide your exact personal legal details as shown on official government ID. Used solely for cryptographic identity resolution.
                      </p>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2">
                      <Input
                        label="Legal First Name *"
                        placeholder="e.g. Jane"
                        value={form.ownerLegalFirstName ?? ''}
                        onChange={(event) => setField('ownerLegalFirstName', event.target.value)}
                      />
                      <Input
                        label="Legal Last Name *"
                        placeholder="e.g. Doe"
                        value={form.ownerLegalLastName ?? ''}
                        onChange={(event) => setField('ownerLegalLastName', event.target.value)}
                      />
                      <Input
                        label="Date of Birth *"
                        type="date"
                        value={form.ownerDateOfBirth ?? ''}
                        onChange={(event) => setField('ownerDateOfBirth', event.target.value)}
                      />
                      <Select
                        label="Gender"
                        value={form.ownerGender ?? 'PREFER_NOT_TO_SAY'}
                        onChange={(event) =>
                          setField('ownerGender', event.target.value as VerificationDraftData['ownerGender'])
                        }
                      >
                        {GENDER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                      <Input
                        label="Phone Number *"
                        placeholder="080XXXXXXXX or +234..."
                        required
                        value={form.ownerPhoneNumber ?? ''}
                        onChange={(event) =>
                          setField(
                            'ownerPhoneNumber',
                            sanitizePhoneInput(event.target.value),
                          )
                        }
                        helperText="Syncs with your profile; used for verification notifications."
                      />
                      <Input
                        label="National ID (NIN) *"
                        placeholder="XXX-XX-XXXX"
                        required
                        value={form.ownerNin ?? ''}
                        onChange={(event) => setField('ownerNin', event.target.value)}
                        helperText="Must match owner's government-issued ID."
                      />
                    </div>
                  </div>
                ) : null}

                {/* Step 2: Business */}
                {step.id === 'business' ? (
                  <div className="grid gap-6 sm:grid-cols-2">
                    <Input
                      label="CAC Number *"
                      placeholder="e.g. RC123456"
                      value={form.cacNumber ?? ''}
                      onChange={(event) => setField('cacNumber', event.target.value)}
                    />
                    <Select
                      label="Legal Entity Type *"
                      value={form.legalEntityType ?? 'BUSINESS_NAME'}
                      onChange={(event) =>
                        setField(
                          'legalEntityType',
                          event.target.value as VerificationDraftData['legalEntityType'],
                        )
                      }
                    >
                      {ENTITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                    <div className="sm:col-span-2">
                      <Input
                        label="Street Address *"
                        placeholder="e.g. 123 Fashion Avenue"
                        value={form.businessAddress?.street ?? ''}
                        onChange={(event) => setAddressField('street', event.target.value)}
                      />
                    </div>
                    <Input
                      label="City *"
                      placeholder="e.g. Ikeja"
                      value={form.businessAddress?.city ?? ''}
                      onChange={(event) => setAddressField('city', event.target.value)}
                    />
                    <Input
                      label="State"
                      value={form.businessAddress?.state ?? ''}
                      disabled
                      helperText="Locked from verified store profile state."
                    />
                    <Input
                      label="Country"
                      value={form.businessAddress?.country ?? ''}
                      disabled
                      helperText="Locked from verified store profile country."
                    />
                  </div>
                ) : null}

                {/* Step 3: Authority */}
                {step.id === 'authority' ? (
                  <div className="grid gap-6 sm:grid-cols-2">
                    <Select
                      label="Authority Type *"
                      value={form.authorityType ?? 'LEGAL_OWNER'}
                      onChange={(event) =>
                        setField(
                          'authorityType',
                          event.target.value as VerificationDraftData['authorityType'],
                        )
                      }
                    >
                      {AUTHORITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                    <Select
                      label="ID Document Type *"
                      value={form.idDocumentType ?? 'NIN_SLIP'}
                      onChange={(event) =>
                        setField(
                          'idDocumentType',
                          event.target.value as VerificationDraftData['idDocumentType'],
                        )
                      }
                    >
                      {ID_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                    <Input
                      label="ID Document Number *"
                      placeholder="e.g. A12345678"
                      value={form.idDocumentNumber ?? ''}
                      onChange={(event) => setField('idDocumentNumber', event.target.value)}
                    />
                    <div className="flex flex-col gap-1.5">
                      <Input
                        label="ID Expiry Date"
                        type="date"
                        value={form.idDocumentExpiryDate ?? ''}
                        onChange={(event) =>
                          setField('idDocumentExpiryDate', event.target.value)
                        }
                        error={isExpiryDateTooSoon(form.idDocumentExpiryDate) ? 'ID expires within 1 week or is already expired' : undefined}
                      />
                      {isExpiryDateTooSoon(form.idDocumentExpiryDate) ? (
                        <div className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium flex items-center gap-1.5">
                          <span>⚠️</span>
                          <span>Document Expiry Warning: Your ID expires within 7 days or is already expired. Please provide a document valid for more than 1 week.</span>
                        </div>
                      ) : null}
                    </div>
                    {form.authorityType === 'AUTHORIZED_REPRESENTATIVE' ? (
                      <div className="sm:col-span-2">
                        <Textarea
                          label="Authority Arrangement Description *"
                          rows={4}
                          placeholder="Explain authorization granted by company directors..."
                          value={form.authorityProofDescription ?? ''}
                          onChange={(event) =>
                            setField('authorityProofDescription', event.target.value)
                          }
                          helperText="Provide details of representation authorization."
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Step 4: Evidence Uploads with Drag & Drop */}
                {step.id === 'uploads' ? (
                  <div className="grid gap-6 sm:grid-cols-2">
                    {DOCUMENT_UPLOADS.map((item) => {
                      const hidden =
                        item.key === 'idDocumentBackKey' &&
                        !needsBackImage(form.idDocumentType);
                      const authorityHidden =
                        item.key === 'authorityProofKey' &&
                        form.authorityType !== 'AUTHORIZED_REPRESENTATIVE';

                      if (hidden || authorityHidden) {
                        return null;
                      }

                      const value = form[item.key as keyof VerificationDraftData] as string | undefined;
                      const isDragActive = dragActiveField === item.key;
                      const isUploading = uploadingField === item.key;
                      const previewUrl = getPreviewUrl(item.key as UploadFieldKey);

                      return (
                        <div
                          key={item.key}
                          className={`relative rounded-2xl border-2 border-dashed p-5 transition-all duration-200 flex flex-col justify-between ${
                            isDragActive
                              ? 'border-primary bg-primary/10 scale-[0.99]'
                              : value
                                ? 'border-emerald-300 bg-emerald-50/40'
                                : 'border-outline-variant/40 bg-surface-container-low hover:border-primary/50'
                          }`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDragActiveField(item.key);
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDragActiveField(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDragActiveField(null);
                            const file = e.dataTransfer.files?.[0] ?? null;
                            if (file) {
                              void handleUpload(item.key as keyof VerificationDraftData, item.documentType, file);
                            }
                          }}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold uppercase tracking-widest text-on-surface">{item.label}</span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${value ? 'bg-emerald-100 text-emerald-800' : 'bg-surface-container-high text-on-surface-variant'}`}>
                                {value ? 'Uploaded' : 'Required'}
                              </span>
                            </div>
                            <p className="text-xs text-on-surface-variant mb-4">{item.hint}</p>

                            {value ? (
                              <div className="mb-4 rounded-xl border border-emerald-200 bg-white p-3 shadow-sm">
                                <p className="truncate text-xs font-semibold text-emerald-900">
                                  📄 {String(value).split('/').pop() || 'Uploaded file'}
                                </p>
                                <div className="mt-2 flex items-center gap-3">
                                  {previewUrl ? (
                                    /\.(png|jpe?g|webp|gif|avif|bmp|svg)(\?|$)|blob:/i.test(previewUrl) ? (
                                      <MediaRenderer
                                        kind="image"
                                        src={previewUrl}
                                        alt={`${item.label} preview`}
                                        className="w-12 h-12 rounded-lg border border-emerald-200 bg-white"
                                        mediaClassName="object-contain"
                                        maxHeightClassName="max-h-12"
                                        maxWidthClassName="max-w-12"
                                      />
                                    ) : (
                                      <span className="text-2xl">📄</span>
                                    )
                                  ) : (
                                    <VLoader size={16} phase="loading" showLabel={false} />
                                  )}

                                  {previewUrl ? (
                                    <a
                                      href={previewUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-xs font-semibold text-primary underline hover:text-primary-container"
                                    >
                                      View full file
                                    </a>
                                  ) : (
                                    <span className="text-xs text-on-surface-variant">Generating preview…</span>
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </div>

                          <div className="relative mt-2 flex items-center justify-between gap-3 pt-3 border-t border-outline-variant/20">
                            <span className="text-[11px] text-on-surface-variant">
                              Click or drag file here (PDF, JPG, PNG)
                            </span>
                            <label className="relative inline-flex cursor-pointer overflow-hidden rounded-xl">
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                onChange={(event) => {
                                  const file = event.target.files?.[0] ?? null;
                                  void handleUpload(
                                    item.key as keyof VerificationDraftData,
                                    item.documentType,
                                    file,
                                  );
                                  event.currentTarget.value = '';
                                }}
                              />
                              <span className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-primary to-tertiary text-on-primary text-xs font-semibold shadow-sm hover:shadow-md transition-all flex items-center gap-1.5">
                                {isUploading ? (
                                  <>
                                    <VLoader size={12} phase="loading" showLabel={false} />
                                    Uploading...
                                  </>
                                ) : value ? (
                                  'Replace File'
                                ) : (
                                  'Upload File'
                                )}
                              </span>
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {/* Step 5: Review & Consent */}
                {step.id === 'review' ? (
                  <div className="space-y-6">
                    {/* Summary Bento Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/20">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-outline-variant/20">
                          <span className="text-xs font-bold text-primary uppercase tracking-widest">1. Personal Identity</span>
                          <button type="button" onClick={() => setStepIndex(0)} className="text-xs text-primary hover:underline">Edit</button>
                        </div>
                        <dl className="space-y-2 text-xs">
                          <div>
                            <dt className="text-on-surface-variant uppercase text-[10px]">Legal Name</dt>
                            <dd className="font-semibold text-on-surface">{[form.ownerLegalFirstName, form.ownerLegalLastName].filter(Boolean).join(' ') || 'Not set'}</dd>
                          </div>
                          <div>
                            <dt className="text-on-surface-variant uppercase text-[10px]">DOB & NIN</dt>
                            <dd className="font-semibold text-on-surface">{form.ownerDateOfBirth || 'N/A'} • {form.ownerNin || 'N/A'}</dd>
                          </div>
                        </dl>
                      </div>

                      <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/20">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-outline-variant/20">
                          <span className="text-xs font-bold text-tertiary uppercase tracking-widest">2. Business Profile</span>
                          <button type="button" onClick={() => setStepIndex(1)} className="text-xs text-tertiary hover:underline">Edit</button>
                        </div>
                        <dl className="space-y-2 text-xs">
                          <div>
                            <dt className="text-on-surface-variant uppercase text-[10px]">CAC & Entity</dt>
                            <dd className="font-semibold text-on-surface">{form.cacNumber || 'N/A'} ({form.legalEntityType})</dd>
                          </div>
                          <div>
                            <dt className="text-on-surface-variant uppercase text-[10px]">Location</dt>
                            <dd className="font-semibold text-on-surface">{form.businessAddress?.street}, {form.businessAddress?.city}</dd>
                          </div>
                        </dl>
                      </div>

                      {/* Evidence Files Preview Section in Review */}
                      <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/20 md:col-span-2">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-outline-variant/20">
                          <span className="text-xs font-bold text-primary uppercase tracking-widest">3. Uploaded Evidence Documents</span>
                          <button type="button" onClick={() => setStepIndex(3)} className="text-xs text-primary hover:underline">Edit</button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {DOCUMENT_UPLOADS.map((item) => {
                            const value = String(form[item.key as keyof VerificationDraftData] ?? '').trim();
                            if (!value) return null;
                            const previewUrl = getPreviewUrl(item.key as UploadFieldKey);
                            return (
                              <div key={item.key} className="rounded-xl border border-emerald-200 bg-white p-3 shadow-sm flex items-center gap-3">
                                {previewUrl && /\.(png|jpe?g|webp|gif|avif|bmp|svg)(\?|$)|blob:/i.test(previewUrl) ? (
                                  <MediaRenderer
                                    kind="image"
                                    src={previewUrl}
                                    alt={`${item.label} preview`}
                                    className="w-12 h-12 rounded-lg border border-emerald-200 bg-white shrink-0"
                                    mediaClassName="object-contain"
                                    maxHeightClassName="max-h-12"
                                    maxWidthClassName="max-w-12"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-xl shrink-0">📄</div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">{item.label}</p>
                                  <p className="truncate text-xs font-semibold text-emerald-950 mt-0.5">{value.split('/').pop() || 'Uploaded document'}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Verification Letter Box */}
                    {letter ? (
                      <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm">
                        <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">Verification Consent Letter</h3>
                        <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 text-xs leading-relaxed text-on-surface max-h-40 overflow-y-auto">
                          <p className="font-bold text-xs mb-1.5">{letter.title}</p>
                          <p className="whitespace-pre-line text-on-surface-variant">{letter.body}</p>
                        </div>

                        {form.letterKey ? (
                          <div className="mt-3.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
                            <p className="font-bold">✅ Verification letter digitally signed</p>
                            <p className="mt-0.5 text-[11px] text-emerald-800">
                              {lastSignedAt
                                ? `Signed on ${new Date(lastSignedAt).toLocaleString()}`
                                : 'Signature captured for submission attempt.'}
                            </p>
                          </div>
                        ) : (
                          <div className="mt-3.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                            Sign the letter below to confirm legal declaration before final submission.
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap gap-3">
                          <Button
                            onClick={() => void handleSignLetter()}
                            loading={signing}
                            size="sm"
                            className="shadow-sm"
                          >
                            {form.letterKey ? 'Re-sign verification letter' : 'Sign verification letter'}
                          </Button>
                        </div>
                      </section>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* Sticky Bottom Action Bar Inside Right Scroll Container */}
              <div className="sticky bottom-0 bg-surface-container-lowest/95 backdrop-blur-md pt-4 pb-2 mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/20 z-20">
                <button
                  type="button"
                  onClick={() => navigate('/studio/verification', { state: { from: originPath } })}
                  className="text-xs font-semibold text-on-surface-variant hover:text-on-surface"
                >
                  Exit to Status
                </button>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void saveDraft(stepIndex + 1, { redirectToCatalog: true })}
                    disabled={savingDraft}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-primary hover:bg-primary/5 transition-all border border-primary/30 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {savingDraft ? (
                      <>
                        <VLoader size={12} phase="loading" showLabel={false} />
                        Saving draft...
                      </>
                    ) : (
                      'Save draft'
                    )}
                  </button>

                  {stepIndex > 0 ? (
                    <Button
                      variant="ghost"
                      onClick={() => setStepIndex((current) => current - 1)}
                      size="sm"
                    >
                      Back
                    </Button>
                  ) : null}

                  {stepIndex < VERIFICATION_STEPS.length - 1 ? (
                    <Button onClick={() => void goToStep(stepIndex + 1)} size="sm">
                      Continue
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setShowSubmitPreview(true)}
                      className="shadow-md"
                      size="sm"
                    >
                      {status?.verificationStatus === 'ADDITIONAL_INFO_REQUESTED'
                        ? 'Preview requested updates'
                        : 'Preview submission package'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Submission Preview Modal */}
      <Modal
        open={showSubmitPreview}
        onClose={() => setShowSubmitPreview(false)}
        title="Verification Submission Preview"
        size="xl"
      >
        <div className="space-y-6">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs text-on-surface leading-relaxed">
            Review your full verification package. Once submitted, your application will enter the admin compliance review queue.
          </div>

          <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Identity & Business Summary</p>
            <div className="grid gap-3 text-xs text-on-surface sm:grid-cols-2">
              <p><span className="font-semibold">Legal Name:</span> {[form.ownerLegalFirstName, form.ownerLegalLastName].filter(Boolean).join(' ') || 'Not provided'}</p>
              <p><span className="font-semibold">DOB:</span> {form.ownerDateOfBirth || 'Not provided'}</p>
              <p><span className="font-semibold">Phone:</span> {form.ownerPhoneNumber || 'Not provided'}</p>
              <p><span className="font-semibold">NIN:</span> {form.ownerNin || 'Not provided'}</p>
              <p><span className="font-semibold">CAC Number:</span> {form.cacNumber || 'Not provided'}</p>
              <p><span className="font-semibold">Entity Type:</span> {form.legalEntityType || 'Not provided'}</p>
              <p className="sm:col-span-2"><span className="font-semibold">Address:</span> {form.businessAddress?.street}, {form.businessAddress?.city}, {form.businessAddress?.state}, {form.businessAddress?.country}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-tertiary mb-3">Authority & Evidence Files</p>
            <div className="grid gap-3 text-xs text-on-surface sm:grid-cols-2 mb-4">
              <p><span className="font-semibold">Authority Type:</span> {form.authorityType || 'Not provided'}</p>
              <p><span className="font-semibold">ID Type:</span> {form.idDocumentType || 'Not provided'}</p>
              <p><span className="font-semibold">ID Number:</span> {form.idDocumentNumber || 'Not provided'}</p>
              <p><span className="font-semibold">ID Expiry:</span> {form.idDocumentExpiryDate || 'Not provided'}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {DOCUMENT_UPLOADS.map((item) => {
                const value = String(form[item.key as keyof VerificationDraftData] ?? '').trim();
                if (!value) return null;
                const previewUrl = getPreviewUrl(item.key as UploadFieldKey);
                return (
                  <div key={item.key} className="rounded-xl border border-emerald-200 bg-white p-3 shadow-sm flex items-center gap-3">
                    {previewUrl && /\.(png|jpe?g|webp|gif|avif|bmp|svg)(\?|$)|blob:/i.test(previewUrl) ? (
                      <MediaRenderer
                        kind="image"
                        src={previewUrl}
                        alt={`${item.label} preview`}
                        className="w-12 h-12 rounded-lg border border-emerald-200 bg-white shrink-0"
                        mediaClassName="object-contain"
                        maxHeightClassName="max-h-12"
                        maxWidthClassName="max-w-12"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-xl shrink-0">📄</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">{item.label}</p>
                      <p className="truncate text-xs font-semibold text-emerald-950 mt-0.5">{value.split('/').pop() || value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface mb-2">Consent Status</p>
            <p className="text-xs text-on-surface-variant">
              {form.letterKey
                ? '✅ Digitally signed verification letter attached.'
                : '❌ Letter not signed. Please sign the letter before submitting.'}
            </p>
          </section>

          <div className="flex flex-wrap justify-end gap-3 border-t border-outline-variant/20 pt-4">
            <Button variant="ghost" onClick={() => setShowSubmitPreview(false)}>
              Back to editing
            </Button>
            <Button
              onClick={() => {
                void handleSubmit();
              }}
              loading={submitting}
              disabled={!form.letterKey}
              className="shadow-md"
            >
              {status?.verificationStatus === 'ADDITIONAL_INFO_REQUESTED'
                ? 'Submit requested updates'
                : 'Submit verification'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
