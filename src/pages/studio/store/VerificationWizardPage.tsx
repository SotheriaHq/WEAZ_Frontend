import {
  startTransition,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import VLoader from '@/components/loaders/VLoader';
import VerificationHero from '@/components/studio/verification/VerificationHero';
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
import { brandApi } from '@/api/BrandApi';
import type { RootState } from '@/store';
import type {
  VerificationDraftData,
  VerificationLetterResponse,
  VerificationStatusResponse,
} from '@/types/verification';
import { setUser } from '@/features/userSlice';
import Modal from '@/components/ui/Modal';

const DOCUMENT_UPLOADS = [
  { key: 'ownerPhotoKey', label: 'Owner selfie', documentType: 'OWNER_PHOTO' },
  { key: 'idDocumentFrontKey', label: 'ID front', documentType: 'ID_FRONT' },
  { key: 'idDocumentBackKey', label: 'ID back', documentType: 'ID_BACK' },
  {
    key: 'cacCertificateKey',
    label: 'CAC certificate',
    documentType: 'CAC_CERTIFICATE',
  },
  {
    key: 'authorityProofKey',
    label: 'Authority proof',
    documentType: 'AUTHORITY_PROOF',
  },
] as const;

type UploadFieldKey = (typeof DOCUMENT_UPLOADS)[number]['key'];

export default function VerificationWizardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.user.profile);
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
  const [showSubmitPreview, setShowSubmitPreview] = useState(false);
  const [uploadPreviewUrls, setUploadPreviewUrls] = useState<Partial<Record<UploadFieldKey, string>>>({});
  const [lastSignedAt, setLastSignedAt] = useState<string | null>(null);

  const originPath =
    typeof (location.state as { from?: unknown } | null)?.from === 'string'
      ? String((location.state as { from?: string }).from)
      : '/studio/verification';
  const originLabel =
    originPath.startsWith('/studio/store')
      ? 'Store'
      : originPath.startsWith('/studio/verification')
        ? 'Verification'
        : 'Back';

  const signatureText = useMemo(
    () => buildSignatureText(form, letter),
    [form, letter],
  );
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
      return 'This attempt is already in the review queue. The wizard unlocks again only if Threadly requests more information or a new attempt becomes available.';
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
        if (user) {
          dispatch(
            setUser({
              ...user,
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
    let cancelled = false;
    const syncPreviewUrls = async () => {
      const uploads = DOCUMENT_UPLOADS.map((item) => {
        const key = item.key as UploadFieldKey;
        const s3Key = String(form[key] ?? '').trim();
        return { key, s3Key };
      }).filter((item) => item.s3Key.length > 0);

      for (const item of uploads) {
        if (uploadPreviewUrls[item.key]) {
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
  }, [form, uploadPreviewUrls]);

  const setField = <K extends keyof VerificationDraftData>(
    key: K,
    value: VerificationDraftData[K],
  ) => {
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
    if (!brandId) return;
    try {
      setSavingDraft(true);
      await brandApi.saveVerificationDraft(brandId, form, nextStep);
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
    }
  };

  const handleUpload = async (
    field: keyof VerificationDraftData,
    documentType: string,
    file: File | null,
  ) => {
    if (!brandId || !file) return;
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
      if (!form.ownerLegalFirstName?.trim() || !form.ownerLegalLastName?.trim()) {
        throw new Error('Enter the legal first and last name');
      }
      if (!form.ownerDateOfBirth || !form.ownerPhoneNumber?.trim()) {
        throw new Error('Date of birth and phone number are required');
      }
      if (!form.ownerNin?.trim()) {
        throw new Error('NIN is required');
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
    if (!brandId || !status) return;

    try {
      validateStep(4);
      setSubmitting(true);
      // Submit endpoint accepts only verification fields; strip draft-only metadata like `currentStep`.
      const payload: Record<string, unknown> = {
        ownerLegalFirstName: form.ownerLegalFirstName,
        ownerLegalLastName: form.ownerLegalLastName,
        ownerDateOfBirth: form.ownerDateOfBirth,
        ownerGender: form.ownerGender,
        ownerPhoneNumber: form.ownerPhoneNumber,
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
    }
  };

  const step = VERIFICATION_STEPS[stepIndex];
  const locationLockedLabel = useMemo(() => {
    const country = String(form.businessAddress?.country ?? '').trim() || 'Nigeria';
    const state = String(form.businessAddress?.state ?? '').trim() || 'Not set';
    return `${state}, ${country}`;
  }, [form.businessAddress?.country, form.businessAddress?.state]);

  if (loading) {
    return (
      <div className="rounded-[2rem] border border-gray-200 bg-white p-8 text-sm text-gray-500 shadow-sm">
        Loading verification wizard...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
        <Link to={originPath} className="transition hover:text-gray-700">
          {originLabel}
        </Link>
        <span>/</span>
        <Link
          to="/studio/verification"
          className="transition hover:text-gray-700"
        >
          Verification
        </Link>
        <span>/</span>
        <span className="text-gray-800">Apply</span>
      </nav>

      <VerificationHero
        eyebrow="Verification application"
        title="Guided seller verification"
        description="Move through the same structured sequence every time: identity, business, authority, evidence, then review. Draft state is preserved as you go."
        statusLabel={
          status?.verificationStatus === 'NOT_SUBMITTED' && hasDraft
            ? 'Drafted'
            : verificationStatusLabel(status?.verificationStatus)
        }
        statusTone={verificationStatusTone(status?.verificationStatus)}
      />

      {wizardLockMessage ? (
        <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
            Submission locked
          </p>
          <p className="mt-3 text-sm leading-7 text-amber-900">
            {wizardLockMessage}
          </p>
          <div className="mt-5">
            <Button onClick={() => navigate('/studio/verification')}>
              Return to status workspace
            </Button>
          </div>
        </section>
      ) : null}

      {!wizardLockMessage ? (
      <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
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
                  className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                    isActive
                      ? 'border-sky-300 bg-sky-50 shadow-sm'
                      : isComplete
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                    Step {index + 1}
                  </p>
                  <p className="mt-2 text-base font-bold text-gray-900">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-gray-600">{item.summary}</p>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
              Step {stepIndex + 1}
            </p>
            <h2 className="mt-2 text-2xl font-black text-gray-900">{step.title}</h2>
            <p className="mt-2 text-sm leading-7 text-gray-600">{step.summary}</p>
          </div>

          {step.id === 'identity' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Legal first name"
                value={form.ownerLegalFirstName ?? ''}
                onChange={(event) => setField('ownerLegalFirstName', event.target.value)}
              />
              <Input
                label="Legal last name"
                value={form.ownerLegalLastName ?? ''}
                onChange={(event) => setField('ownerLegalLastName', event.target.value)}
              />
              <Input
                label="Date of birth"
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
                label="Phone number"
                value={form.ownerPhoneNumber ?? ''}
                onChange={(event) => setField('ownerPhoneNumber', event.target.value)}
              />
              <Input
                label="NIN"
                value={form.ownerNin ?? ''}
                onChange={(event) => setField('ownerNin', event.target.value)}
              />
            </div>
          ) : null}

          {step.id === 'business' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="CAC number"
                value={form.cacNumber ?? ''}
                onChange={(event) => setField('cacNumber', event.target.value)}
              />
              <Select
                label="Entity type"
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
              <div className="md:col-span-2">
                <Input
                  label="Street address"
                  value={form.businessAddress?.street ?? ''}
                  onChange={(event) => setAddressField('street', event.target.value)}
                />
              </div>
              <Input
                label="City"
                value={form.businessAddress?.city ?? ''}
                onChange={(event) => setAddressField('city', event.target.value)}
              />
              <Input
                label="State"
                value={form.businessAddress?.state ?? ''}
                disabled
                helperText="State is locked from your verified profile location. Update it from Settings after successful verification."
              />
              <Input
                label="Country"
                value={form.businessAddress?.country ?? ''}
                disabled
                helperText="Country is locked from your verified profile location."
              />
              <div className="md:col-span-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900">
                Location used for verification: <span className="font-semibold">{locationLockedLabel}</span>
              </div>
            </div>
          ) : null}

          {step.id === 'authority' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Authority type"
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
                label="ID type"
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
                label="ID number"
                value={form.idDocumentNumber ?? ''}
                onChange={(event) => setField('idDocumentNumber', event.target.value)}
              />
              <Input
                label="ID expiry date"
                type="date"
                value={form.idDocumentExpiryDate ?? ''}
                onChange={(event) =>
                  setField('idDocumentExpiryDate', event.target.value)
                }
              />
              {form.authorityType === 'AUTHORIZED_REPRESENTATIVE' ? (
                <div className="md:col-span-2">
                  <Textarea
                    label="Authority arrangement"
                    rows={4}
                    value={form.authorityProofDescription ?? ''}
                    onChange={(event) =>
                      setField('authorityProofDescription', event.target.value)
                    }
                    helperText="Explain who authorized the submission and how the evidence supports it."
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {step.id === 'uploads' ? (
            <div className="grid gap-4 lg:grid-cols-2">
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

                const value = form[item.key as keyof VerificationDraftData] as
                  | string
                  | undefined;

                return (
                  <label
                    key={item.key}
                    className="rounded-[1.5rem] border border-gray-200 bg-gray-50 px-4 py-4"
                  >
                    <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-400">
                      {value ? 'File ready' : 'No file selected'}
                    </p>
                    {value ? (
                      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5">
                        <p className="truncate text-[11px] font-semibold text-emerald-800">
                          {String(value).split('/').pop() || 'Uploaded file'}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          {uploadPreviewUrls[item.key as UploadFieldKey] ? (
                            /\.(png|jpe?g|webp|gif|avif|bmp|svg)(\?|$)/i.test(uploadPreviewUrls[item.key as UploadFieldKey] as string)
                              ? (
                                <img
                                  src={uploadPreviewUrls[item.key as UploadFieldKey] as string}
                                  alt={`${item.label} preview`}
                                  className="h-10 w-10 rounded-lg object-cover"
                                />
                              )
                              : <span className="text-base" aria-hidden="true">📄</span>
                          ) : (
                            <VLoader size={14} phase="loading" showLabel={false} />
                          )}
                          {uploadPreviewUrls[item.key as UploadFieldKey] ? (
                            <a
                              href={uploadPreviewUrls[item.key as UploadFieldKey] as string}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-semibold text-emerald-800 underline decoration-emerald-300 underline-offset-2"
                            >
                              Open uploaded file
                            </a>
                          ) : (
                            <span className="text-[11px] text-emerald-700">Preparing preview…</span>
                          )}
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-xs leading-6 text-gray-500">
                        JPEG, PNG, or PDF. Use a flat, readable capture.
                      </span>
                      <span className="relative inline-flex overflow-hidden rounded-full">
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="absolute inset-0 cursor-pointer opacity-0"
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
                        <span className="inline-flex rounded-full border border-sky-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 shadow-sm">
                          {uploadingField === item.key
                            ? (
                              <span className="inline-flex items-center gap-1.5">
                                <VLoader size={12} phase="loading" showLabel={false} />
                                Uploading...
                              </span>
                            )
                            : value
                              ? 'Replace file'
                              : 'Upload file'}
                        </span>
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          ) : null}

          {step.id === 'review' ? (
            <div className="space-y-5">
              <section className="rounded-[1.5rem] border border-gray-200 bg-gray-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                  Summary
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2 text-sm text-gray-700">
                  <p>
                    <span className="font-semibold text-gray-900">Name:</span>{' '}
                    {[form.ownerLegalFirstName, form.ownerLegalLastName]
                      .filter(Boolean)
                      .join(' ')}
                  </p>
                  <p>
                    <span className="font-semibold text-gray-900">Entity:</span>{' '}
                    {form.legalEntityType}
                  </p>
                  <p>
                    <span className="font-semibold text-gray-900">Authority:</span>{' '}
                    {form.authorityType}
                  </p>
                  <p>
                    <span className="font-semibold text-gray-900">ID type:</span>{' '}
                    {form.idDocumentType}
                  </p>
                </div>
              </section>

              {letter ? (
                <section className="rounded-[1.5rem] border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                    Verification letter
                  </p>
                  <div className="mt-4 rounded-[1.5rem] border border-gray-200 bg-gray-50 p-5 text-sm leading-7 text-gray-700">
                    <p className="font-semibold text-gray-900">{letter.title}</p>
                    <p className="mt-3 whitespace-pre-line">{letter.body}</p>
                  </div>
                  {form.letterKey ? (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <p className="text-sm font-semibold text-emerald-900">✅ Letter signed and attached</p>
                      <p className="mt-1 text-xs text-emerald-800">
                        {lastSignedAt
                          ? `Last signed ${new Date(lastSignedAt).toLocaleString()}.`
                          : 'Your signature has been captured for this submission attempt.'}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-xs text-amber-900">
                        Sign the verification letter to confirm legal consent before submission.
                      </p>
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      onClick={() => void handleSignLetter()}
                      loading={signing}
                      className="shadow-md"
                    >
                      {form.letterKey ? 'Re-sign letter' : 'Sign letter'}
                    </Button>
                    <Button variant="ghost" onClick={() => void saveDraft(5)}>
                      Save current review state
                    </Button>
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-6">
            <div className="text-xs uppercase tracking-[0.22em] text-gray-400">
              Step {stepIndex + 1} of {VERIFICATION_STEPS.length}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() => void saveDraft(stepIndex + 1, { redirectToCatalog: true })}
                loading={savingDraft}
              >
                Save draft
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate('/studio/verification', { state: { from: originPath } })}
              >
                Back to status
              </Button>
              {stepIndex > 0 ? (
                <Button
                  variant="ghost"
                  onClick={() => setStepIndex((current) => current - 1)}
                >
                  Back
                </Button>
              ) : null}
              {stepIndex < VERIFICATION_STEPS.length - 1 ? (
                <Button onClick={() => void goToStep(stepIndex + 1)}>
                  Continue
                </Button>
              ) : (
                <Button
                  onClick={() => setShowSubmitPreview(true)}
                  className="shadow-md"
                >
                  {status?.verificationStatus === 'ADDITIONAL_INFO_REQUESTED'
                    ? 'Preview requested updates'
                    : 'Preview submission package'}
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>
      ) : null}

      <Modal
        open={showSubmitPreview}
        onClose={() => setShowSubmitPreview(false)}
        title="Verification Submission Preview"
        size="xl"
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
            Review exactly what will be submitted for approval. You can go back and edit before final submission.
          </div>

          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Identity + Business</p>
            <div className="mt-3 grid gap-2 text-sm text-gray-800 md:grid-cols-2">
              <p><span className="font-semibold">Legal name:</span> {[form.ownerLegalFirstName, form.ownerLegalLastName].filter(Boolean).join(' ') || 'Not provided'}</p>
              <p><span className="font-semibold">DOB:</span> {form.ownerDateOfBirth || 'Not provided'}</p>
              <p><span className="font-semibold">Phone:</span> {form.ownerPhoneNumber || 'Not provided'}</p>
              <p><span className="font-semibold">NIN:</span> {form.ownerNin || 'Not provided'}</p>
              <p><span className="font-semibold">CAC number:</span> {form.cacNumber || 'Not provided'}</p>
              <p><span className="font-semibold">Entity:</span> {form.legalEntityType || 'Not provided'}</p>
              <p className="md:col-span-2"><span className="font-semibold">Address:</span> {form.businessAddress?.street || 'Not provided'}{form.businessAddress?.city ? `, ${form.businessAddress.city}` : ''}{form.businessAddress?.state ? `, ${form.businessAddress.state}` : ''}{form.businessAddress?.country ? `, ${form.businessAddress.country}` : ''}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Authority + Documents</p>
            <div className="mt-3 grid gap-2 text-sm text-gray-800 md:grid-cols-2">
              <p><span className="font-semibold">Authority type:</span> {form.authorityType || 'Not provided'}</p>
              <p><span className="font-semibold">ID type:</span> {form.idDocumentType || 'Not provided'}</p>
              <p><span className="font-semibold">ID number:</span> {form.idDocumentNumber || 'Not provided'}</p>
              <p><span className="font-semibold">ID expiry:</span> {form.idDocumentExpiryDate || 'Not provided'}</p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {DOCUMENT_UPLOADS.map((item) => {
                const value = String(form[item.key as keyof VerificationDraftData] ?? '').trim();
                if (!value) return null;
                return (
                  <div key={item.key} className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">{item.label}</p>
                    <p className="mt-1 truncate text-xs text-emerald-900">{value.split('/').pop() || value}</p>
                    {uploadPreviewUrls[item.key as UploadFieldKey] ? (
                      <a
                        href={uploadPreviewUrls[item.key as UploadFieldKey] as string}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex text-xs font-semibold text-emerald-800 underline decoration-emerald-300 underline-offset-2"
                      >
                        Open file
                      </a>
                    ) : (
                      <span className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-800">
                        <VLoader size={12} phase="loading" showLabel={false} />
                        Preparing preview
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Consent Letter</p>
            <p className="mt-2 text-sm text-gray-800">
              {form.letterKey
                ? 'Signed letter is attached and will be submitted with this attempt.'
                : 'Letter is not signed yet. Please close this preview and sign before submitting.'}
            </p>
          </section>

          <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
            <Button variant="ghost" onClick={() => setShowSubmitPreview(false)}>
              Close preview
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
