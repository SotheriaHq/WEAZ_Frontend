import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FC, ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import { toast } from 'sonner';
import { adminBrandsApi } from '@/api/AdminApi';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { unwrapApiResponse } from '@/types/auth';
import MediaRenderer from '@/components/media/MediaRenderer';
import type {
  AdminVerificationDetails,
  VerificationDocumentItem,
  VerificationInfoItem,
  VerificationNote,
  VerificationReason,
} from '@/types/verification';

const REQUEST_FIELD_OPTIONS = [
  { value: 'cacNumber', label: 'CAC number' },
  { value: 'businessAddress', label: 'Business address' },
  { value: 'ownerNin', label: 'Owner NIN' },
  { value: 'ownerPhotoKey', label: 'Owner selfie' },
  { value: 'idDocumentFrontKey', label: 'ID front' },
  { value: 'idDocumentBackKey', label: 'ID back' },
  { value: 'cacCertificateKey', label: 'CAC certificate' },
  { value: 'authorityProofKey', label: 'Authority proof' },
  { value: 'authorityProofDescription', label: 'Authority explanation' },
  { value: 'custom', label: 'Custom field' },
] as const;

const statusTone = (status?: string) => {
  if (status === 'IN_REVIEW') {
    return 'border-sky-200 bg-sky-50 text-sky-800';
  }
  if (status === 'ADDITIONAL_INFO_REQUESTED') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  if (status === 'APPROVED') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
  if (status === 'REJECTED') {
    return 'border-rose-200 bg-rose-50 text-rose-800';
  }
  return 'border-gray-200 bg-gray-50 text-gray-700';
};

const badgeTone = (isVisible?: boolean) =>
  isVisible
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-gray-200 bg-gray-50 text-gray-700';

const isPdfDocument = (document: VerificationDocumentItem | null) =>
  document?.mimeType?.toLowerCase().includes('pdf') ||
  document?.signedUrl?.toLowerCase().includes('.pdf') ||
  false;

const LETTER_DOCUMENT_KEY = 'letterOfConfirmationKey';

const NOT_PROVIDED = 'Not provided';

const formatBytes = (size?: number | null) => {
  if (!size || size <= 0) return NOT_PROVIDED;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return NOT_PROVIDED;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? NOT_PROVIDED : parsed.toLocaleString();
};

const formatDate = (value?: string | null) => {
  if (!value) return NOT_PROVIDED;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? NOT_PROVIDED : parsed.toLocaleDateString();
};

const humanizeEnum = (value?: unknown) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return NOT_PROVIDED;
  return text
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^./, (char) => char.toUpperCase());
};

/** Human label for a file type slug that reaches the manifest raw (e.g. BRAND_VERIFICATION). */
const humanizeFileType = (value?: unknown) => humanizeEnum(value);

const shortenHash = (value?: unknown) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return 'Not recorded';
  return text.length <= 16 ? text : `${text.slice(0, 8)}…${text.slice(-6)}`;
};

type ManifestEntry = {
  fileId?: string;
  s3Key?: string;
  mimeType?: string | null;
  size?: number | null;
  sha256?: string | null;
  uploadedAt?: string | null;
  fileType?: string | null;
};

/**
 * Property/value pair.
 *
 * The label sits directly above its value in one left-aligned column, so a
 * reviewer scanning down reads property → value → property → value. The old
 * layout ran "Label: value" together on a single line at the same weight, which
 * is what read as scattered. The value gets the heavier, darker type because it
 * is the thing being verified; the label is chrome.
 */
const DetailRow: FC<{
  label: string;
  children: ReactNode;
  /** Identity numbers and timestamps read better in a fixed-width face. */
  mono?: boolean;
}> = ({ label, children, mono = false }) => (
  <div>
    <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-gray-400">
      {label}
    </dt>
    <dd
      className={`mt-1 break-words text-[15px] font-semibold leading-snug text-gray-900 ${
        mono ? 'font-mono text-[13px] tracking-tight' : ''
      }`}
    >
      {children}
    </dd>
  </div>
);

const SummaryCard: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <div className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-gray-100">
    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
      {title}
    </p>
    <dl className="mt-4 space-y-4">{children}</dl>
  </div>
);

/**
 * Queue action with its explanation on hover/focus instead of a permanent
 * paragraph. The three descriptions used to occupy a full row of bordered cards
 * above the fold, pushing the actual evidence off screen.
 */
const HintedAction: FC<{
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'secondary' | 'ghost';
  children: ReactNode;
}> = ({ hint, onClick, disabled, variant = 'ghost', children }) => (
  <span className="group relative inline-flex">
    <Button size="sm" variant={variant} onClick={onClick} disabled={disabled} title={hint}>
      {children}
    </Button>
    <span
      role="tooltip"
      className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-xl bg-gray-900 px-3 py-2 text-left text-xs font-normal leading-relaxed text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
    >
      {hint}
    </span>
  </span>
);

export default function AdminBrandVerificationReviewPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [details, setDetails] = useState<AdminVerificationDetails | null>(null);
  const [reasons, setReasons] = useState<VerificationReason[]>([]);
  const [selectedReasonCodes, setSelectedReasonCodes] = useState<string[]>([]);
  const [customReason, setCustomReason] = useState('');
  const [selectedDocumentKey, setSelectedDocumentKey] = useState<string>('');
  const [requestInfoItems, setRequestInfoItems] = useState<VerificationInfoItem[]>([]);
  const [requestField, setRequestField] = useState<string>('ownerPhotoKey');
  const [requestFieldLabel, setRequestFieldLabel] = useState('');
  const [requestFieldMessage, setRequestFieldMessage] = useState('');
  const [requestInfoMessage, setRequestInfoMessage] = useState('');
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [isRevealNinDialogOpen, setIsRevealNinDialogOpen] = useState(false);
  const [isNinRevealed, setIsNinRevealed] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;

    const [detailsResponse, reasonsResponse, notesResponse] = await Promise.all([
      adminBrandsApi.getVerificationDetails(id),
      adminBrandsApi.getVerificationRejectionReasons(),
      adminBrandsApi.getVerificationNotes(id),
    ]);

    const nextDetails = unwrapApiResponse<AdminVerificationDetails>(
      detailsResponse.data as never,
    );
    const nextReasons = unwrapApiResponse<{ reasons: VerificationReason[] }>(
      reasonsResponse.data as never,
    );
    const nextNotes = unwrapApiResponse<{ notes: VerificationNote[] }>(
      notesResponse.data as never,
    );

    const merged = {
      ...nextDetails,
      verificationNotes: nextNotes.notes ?? [],
    };

    setDetails(merged);
    setReasons(nextReasons.reasons ?? []);
    setRequestInfoItems(merged.verificationInfoRequestedItems ?? []);
    setSelectedDocumentKey((current) => {
      if (
        current &&
        (merged.documents ?? []).some((document) => document.key === current)
      ) {
        return current;
      }
      return merged.documents?.[0]?.key ?? '';
    });
  }, [id]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        await load();
      } catch (error: any) {
        if (!active) return;
        toast.error(
          error?.response?.data?.message ||
            'Unable to load verification review',
        );
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [load]);

  const latestAttempt = details?.latestAttempt as Record<string, any> | null;
  const returnTo =
    typeof (location.state as { returnTo?: unknown } | null)?.returnTo === 'string'
      ? ((location.state as { returnTo?: string }).returnTo || '/admin/users?tab=in-review')
      : '/admin/users?tab=in-review';
  const selectedDocument = useMemo(
    () =>
      details?.documents?.find((document) => document.key === selectedDocumentKey) ??
      details?.documents?.[0] ??
      null,
    [details?.documents, selectedDocumentKey],
  );

  const letterDocument = useMemo(
    () =>
      details?.documents?.find((document) => document.key === LETTER_DOCUMENT_KEY) ?? null,
    [details?.documents],
  );

  const businessAddressText = useMemo(() => {
    const address = latestAttempt?.businessAddress as
      | { street?: string; city?: string; state?: string; country?: string }
      | null
      | undefined;
    if (!address) return NOT_PROVIDED;
    const parts = [address.street, address.city, address.state, address.country]
      .map((part) => (typeof part === 'string' ? part.trim() : ''))
      .filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : NOT_PROVIDED;
  }, [latestAttempt?.businessAddress]);

  /**
   * The manifest is stored as raw file rows (`s3Key`, `sha256`, byte counts) so
   * it survives as an audit record. Dumping that JSON at a reviewer is unusable
   * — resolve each entry against the reviewer document list so the row says
   * "CAC certificate • PNG • 177 KB" instead of a UUID and a bucket path.
   */
  const manifestRows = useMemo(() => {
    const raw = latestAttempt?.evidenceManifest;
    const entries: ManifestEntry[] = Array.isArray(raw) ? (raw as ManifestEntry[]) : [];
    const labelByKey = new Map(
      (details?.documents ?? []).map((document) => [document.s3Key, document.label]),
    );
    return entries.map((entry, index) => ({
      id: entry.fileId || entry.s3Key || `manifest-${index}`,
      label:
        (entry.s3Key ? labelByKey.get(entry.s3Key) : undefined) ??
        humanizeFileType(entry.fileType),
      mimeType: entry.mimeType || 'Unknown type',
      size: formatBytes(entry.size),
      uploadedAt: formatDateTime(entry.uploadedAt),
      checksum: shortenHash(entry.sha256),
      fullChecksum: typeof entry.sha256 === 'string' ? entry.sha256 : '',
      s3Key: entry.s3Key || '',
    }));
  }, [details?.documents, latestAttempt?.evidenceManifest]);

  const selectedReasons = useMemo(() => {
    return reasons
      .filter((reason) => selectedReasonCodes.includes(reason.code))
      .map((reason) => ({
        code: reason.code,
        label: reason.label,
        customReason: reason.code === 'CUSTOM' ? customReason.trim() || undefined : undefined,
      }));
  }, [customReason, reasons, selectedReasonCodes]);

  const toggleReason = (code: string) => {
    setSelectedReasonCodes((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code],
    );
  };

  const addRequestField = () => {
    const template = REQUEST_FIELD_OPTIONS.find((option) => option.value === requestField);
    const label =
      requestField === 'custom' ? requestFieldLabel.trim() : template?.label ?? '';
    const field = requestField === 'custom' ? label : requestField;

    if (!field || !label) {
      toast.error('Select a field and label before adding it');
      return;
    }

    setRequestInfoItems((current) => {
      if (current.some((item) => item.field === field && item.label === label)) {
        return current;
      }
      return [...current, { field, label, message: requestFieldMessage.trim() || undefined }];
    });
    setRequestFieldMessage('');
    setRequestFieldLabel('');
  };

  const removeRequestField = (field: string, label: string) => {
    setRequestInfoItems((current) =>
      current.filter((item) => !(item.field === field && item.label === label)),
    );
  };

  const withFreshDetails = async () => {
    try {
      await load();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || 'Unable to refresh verification data',
      );
    }
  };

  const handleClaim = async () => {
    if (!id) return;
    try {
      setSaving(true);
      await adminBrandsApi.claimVerification(id, details?.updatedAt);
      toast.success('Verification review claimed');
      await withFreshDetails();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to claim verification');
    } finally {
      setSaving(false);
    }
  };

  const handleRelease = async () => {
    if (!id) return;
    try {
      setSaving(true);
      await adminBrandsApi.releaseVerification(id, details?.updatedAt);
      toast.success('Verification review released');
      await withFreshDetails();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to release verification');
    } finally {
      setSaving(false);
    }
  };

  const handleReassign = async () => {
    if (!id) return;
    try {
      setSaving(true);
      await adminBrandsApi.reassignVerificationToSelf(id, details?.updatedAt);
      toast.success('Verification review reassigned');
      await withFreshDetails();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to reassign verification');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestInfo = async () => {
    if (!id) return;
    if (requestInfoItems.length === 0) {
      toast.error('Add at least one requested field');
      return;
    }
    try {
      setSaving(true);
      await adminBrandsApi.requestVerificationInfo(id, {
        items: requestInfoItems,
        generalMessage: requestInfoMessage.trim() || undefined,
        expectedUpdatedAt: details?.updatedAt,
      });
      toast.success('Requested more information from the brand');
      setRequestInfoMessage('');
      await withFreshDetails();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to request more information');
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!id) return;
    if (decision === 'REJECTED' && selectedReasons.length === 0) {
      toast.error('Select at least one rejection reason');
      return;
    }
    try {
      setSaving(true);
      await adminBrandsApi.reviewVerification(id, {
        decision,
        rejectionReasons: decision === 'REJECTED' ? selectedReasons : undefined,
        expectedUpdatedAt: details?.updatedAt,
      });
      toast.success(
        decision === 'APPROVED' ? 'Verification approved' : 'Verification rejected',
      );
      navigate(returnTo, { replace: true, state: { verificationActionCompleted: true } });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to submit review decision');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!id || !noteText.trim()) return;
    try {
      setSaving(true);
      await adminBrandsApi.addVerificationNote(id, noteText.trim());
      toast.success('Review note added');
      setNoteText('');
      await withFreshDetails();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to save note');
    } finally {
      setSaving(false);
    }
  };

  if (!details) {
    return (
      <div className="rounded-[1.75rem] bg-white p-6 text-sm text-gray-500 shadow-sm ring-1 ring-gray-100">
        Loading verification review...
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <AdminBreadcrumb segments={[{ label: 'Users', path: '/admin/users?tab=in-review' }, { label: 'Verification Review' }]} />
      <section className="min-w-0 rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(135deg,_#f9fcff,_#ffffff_48%,_#f7f7ff)] p-6 shadow-[0_30px_80px_-40px_rgba(14,165,233,0.35)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <Link
              to="/admin/users?tab=in-review"
              className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700"
            >
              Back to review queue
            </Link>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-gray-900">
              {details.name || 'Unnamed brand'}
            </h1>
            <p className="mt-2 break-words text-sm text-gray-600">
              {details.owner?.firstName} {details.owner?.lastName} •{' '}
              {details.owner?.email}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div
              className={`inline-flex rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${statusTone(details.verificationStatus)}`}
            >
              {details.verificationStatus.replace(/_/g, ' ')}
            </div>
            <div
              className={`inline-flex rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${badgeTone(details.badgeState?.verificationBadgeVisible)}`}
            >
              {details.badgeState?.verificationBadgeVisible ? 'Badge visible' : 'Badge hidden'}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <HintedAction
            variant="secondary"
            hint="Take ownership of this review so you can submit final decisions."
            onClick={() => void handleClaim()}
            disabled={saving}
          >
            Claim
          </HintedAction>
          <HintedAction
            hint="Put it back in the queue so another admin can continue."
            onClick={() => void handleRelease()}
            disabled={saving}
          >
            Release
          </HintedAction>
          <HintedAction
            hint="Move an already-assigned review to your account."
            onClick={() => void handleReassign()}
            disabled={saving}
          >
            Reassign to me
          </HintedAction>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="min-w-0 space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SummaryCard title="Owner identity">
              <DetailRow label="Name">
                {[latestAttempt?.ownerLegalFirstName, latestAttempt?.ownerLegalLastName]
                  .filter(Boolean)
                  .join(' ') || NOT_PROVIDED}
              </DetailRow>
              <DetailRow label="ID number (NIN)" mono>
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span>
                    {isNinRevealed
                      ? (latestAttempt?.ownerNin as string) ||
                        details.maskedOwnerNin ||
                        NOT_PROVIDED
                      : details.maskedOwnerNin || NOT_PROVIDED}
                  </span>
                  {!isNinRevealed && latestAttempt?.ownerNin ? (
                    <button
                      type="button"
                      onClick={() => setIsRevealNinDialogOpen(true)}
                      className="rounded-full bg-gray-100 px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-600 transition hover:bg-gray-200"
                    >
                      Reveal
                    </button>
                  ) : null}
                </span>
              </DetailRow>
              <DetailRow label="Date of birth" mono>
                {formatDate(latestAttempt?.ownerDateOfBirth as string | undefined)}
              </DetailRow>
              <DetailRow label="Phone" mono>
                {(latestAttempt?.ownerPhoneNumber as string) || NOT_PROVIDED}
              </DetailRow>
              <DetailRow label="Account email">
                {details.owner?.email || NOT_PROVIDED}
              </DetailRow>
            </SummaryCard>

            <SummaryCard title="Business">
              <DetailRow label="Registration (CAC)" mono>
                {(latestAttempt?.cacNumber as string) || NOT_PROVIDED}
              </DetailRow>
              <DetailRow label="Entity type">
                {humanizeEnum(latestAttempt?.legalEntityType)}
              </DetailRow>
              <DetailRow label="Authority">
                {humanizeEnum(latestAttempt?.authorityType)}
              </DetailRow>
              <DetailRow label="ID document">
                {humanizeEnum(latestAttempt?.idDocumentType)}
              </DetailRow>
              <DetailRow label="Business address">{businessAddressText}</DetailRow>
            </SummaryCard>

            <SummaryCard title="Queue record">
              <DetailRow label="Attempt">
                Attempt {details.verificationAttemptNumber ?? 0}
              </DetailRow>
              <DetailRow label="Submitted" mono>
                {formatDateTime(details.verificationSubmittedAt)}
              </DetailRow>
              <DetailRow label="Version date" mono>
                {formatDateTime(details.updatedAt)}
              </DetailRow>
              <DetailRow label="Letter version" mono>
                {latestAttempt?.letterVersion
                  ? `v${latestAttempt.letterVersion}`
                  : 'Not recorded'}
              </DetailRow>
              <DetailRow label="Letter signed" mono>
                {latestAttempt?.letterSignedAt
                  ? formatDateTime(latestAttempt.letterSignedAt as string)
                  : 'Not recorded'}
              </DetailRow>
            </SummaryCard>
          </section>

          <section className="rounded-[1.75rem] bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                  Evidence review
                </p>
                <h2 className="mt-1 text-lg font-black text-gray-900">Document workspace</h2>
              </div>
              {selectedDocument?.signedUrl ? (
                <a
                  href={selectedDocument.signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-full bg-sky-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-800 transition hover:bg-sky-100"
                >
                  Open in new tab
                </a>
              ) : null}
            </div>

            <div className="mt-4 grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)] 2xl:grid-cols-[240px_minmax(0,1fr)]">
              <div className="min-w-0 space-y-2 xl:max-w-[240px]">
                {(details.documents ?? []).map((document) => (
                  <button
                    key={document.key}
                    type="button"
                    onClick={() => setSelectedDocumentKey(document.key)}
                    className={`w-full rounded-[1.25rem] px-4 py-3 text-left transition ${
                      selectedDocument?.key === document.key
                        ? 'bg-sky-50 ring-1 ring-sky-200'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900">{document.label}</p>
                    <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-gray-500">
                      <span className="uppercase tracking-[0.12em]">
                        {document.mimeType?.split('/')[1] || 'File'}
                      </span>
                      <span>{formatBytes(document.size)}</span>
                      {!document.signedUrl ? (
                        <span className="font-semibold text-rose-600">Unavailable</span>
                      ) : null}
                    </p>
                  </button>
                ))}

                {/* The letter used to render only as an inert explainer card, which
                    reviewers read as "this IS the letter" — so a document that was
                    right there in the list looked unviewable. It is now a summary
                    that opens the real file. */}
                <div className="rounded-[1.25rem] bg-indigo-50 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-600">
                    Signed verification letter
                  </p>
                  <p className="mt-2 text-[13px] leading-6 text-indigo-900/90">
                    The owner confirms that submitted business and identity details are
                    accurate, and accepts platform verification terms.
                  </p>
                  <dl className="mt-3 divide-y divide-indigo-200/60 text-indigo-900">
                    <div className="flex items-baseline justify-between gap-3 py-1.5">
                      <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-indigo-500">
                        Method
                      </dt>
                      <dd className="text-[13px] font-semibold">
                        {latestAttempt?.signatureMethod
                          ? humanizeEnum(latestAttempt.signatureMethod)
                          : 'Not recorded'}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 py-1.5">
                      <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-indigo-500">
                        Version
                      </dt>
                      <dd className="text-[13px] font-semibold">
                        {latestAttempt?.letterVersion
                          ? `v${latestAttempt.letterVersion}`
                          : 'Not recorded'}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 py-1.5">
                      <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-indigo-500">
                        Signed
                      </dt>
                      <dd className="text-right text-[13px] font-semibold">
                        {latestAttempt?.letterSignedAt
                          ? formatDateTime(latestAttempt.letterSignedAt as string)
                          : 'Not recorded'}
                      </dd>
                    </div>
                  </dl>
                  {letterDocument ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDocumentKey(letterDocument.key)}
                        className="rounded-full bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-indigo-700"
                      >
                        View letter
                      </button>
                      {letterDocument.signedUrl ? (
                        <a
                          href={letterDocument.signedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-700 transition hover:bg-indigo-100"
                        >
                          Download
                        </a>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-[12px] font-semibold text-rose-700">
                      No letter file is attached to this attempt.
                    </p>
                  )}
                </div>
              </div>

              <div className="min-w-0 overflow-hidden rounded-[1.5rem] bg-gray-50 ring-1 ring-gray-100">
                {selectedDocument?.signedUrl ? (
                  isPdfDocument(selectedDocument) ? (
                    <iframe
                      title={selectedDocument.label}
                      src={selectedDocument.signedUrl}
                      className="h-[50vh] min-h-[320px] w-full bg-white sm:h-[56vh] sm:min-h-[380px] xl:h-[62vh] xl:min-h-[420px]"
                    />
                  ) : (
                    <div className="flex min-h-[420px] items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_36%),linear-gradient(180deg,_#ffffff,_#f8fafc)] p-4">
                      <MediaRenderer
                        kind="image"
                        src={selectedDocument.signedUrl}
                        alt={selectedDocument.label}
                        className="block rounded-[1.25rem] shadow-lg"
                        maxHeightClassName="max-h-[85vh]"
                      />
                    </div>
                  )
                ) : (
                  <div className="flex min-h-[420px] flex-col items-center justify-center gap-1 px-6 text-center">
                    <p className="text-sm font-semibold text-gray-700">
                      {selectedDocument
                        ? `${selectedDocument.label} could not be loaded`
                        : 'No evidence was submitted with this attempt'}
                    </p>
                    <p className="max-w-sm text-xs leading-relaxed text-gray-500">
                      {selectedDocument
                        ? 'The secure link expired or the stored file is missing. Reload this page to re-sign the link before rejecting on evidence grounds.'
                        : 'Ask the brand to resubmit before deciding.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[1.75rem] bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                Evidence manifest
              </p>
              <p className="text-[11px] text-gray-400">
                Recorded at submission — {manifestRows.length}{' '}
                {manifestRows.length === 1 ? 'file' : 'files'}
              </p>
            </div>

            {manifestRows.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">
                No manifest was recorded for this attempt.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.14em] text-gray-400">
                      <th className="py-2 pr-4 font-medium">Document</th>
                      <th className="py-2 pr-4 font-medium">Type</th>
                      <th className="py-2 pr-4 font-medium">Size</th>
                      <th className="py-2 pr-4 font-medium">Uploaded</th>
                      <th className="py-2 font-medium">Checksum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {manifestRows.map((row) => (
                      <tr key={row.id} className="align-top">
                        <td className="py-2.5 pr-4 font-semibold text-gray-900">{row.label}</td>
                        <td className="py-2.5 pr-4 text-gray-600">{row.mimeType}</td>
                        <td className="py-2.5 pr-4 tabular-nums text-gray-600">{row.size}</td>
                        <td className="py-2.5 pr-4 text-gray-600">{row.uploadedAt}</td>
                        <td
                          className="py-2.5 font-mono text-xs text-gray-500"
                          title={row.fullChecksum || undefined}
                        >
                          {row.checksum}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          <section className="rounded-[1.75rem] bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
              Request information
            </p>
            <div className="mt-4 space-y-4">
              <Select
                label="Field"
                value={requestField}
                onChange={(event) => setRequestField(event.target.value)}
              >
                {REQUEST_FIELD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              {requestField === 'custom' ? (
                <Input
                  label="Custom label"
                  value={requestFieldLabel}
                  onChange={(event) => setRequestFieldLabel(event.target.value)}
                  placeholder="Describe the requested item"
                />
              ) : null}
              <Textarea
                label="Field note"
                rows={3}
                value={requestFieldMessage}
                onChange={(event) => setRequestFieldMessage(event.target.value)}
                placeholder="Optional note for this requested field"
              />
              <Button size="sm" variant="secondary" onClick={addRequestField}>
                Add requested field
              </Button>
            </div>

            <div className="mt-5 space-y-3">
              {requestInfoItems.map((item) => (
                <div
                  key={`${item.field}-${item.label}`}
                  className="rounded-[1.25rem] bg-amber-50 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-amber-900">{item.label}</p>
                      {item.message ? (
                        <p className="mt-1 text-sm text-amber-800">{item.message}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRequestField(item.field, item.label)}
                      className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5">
              <Textarea
                label="General reviewer note"
                rows={4}
                value={requestInfoMessage}
                onChange={(event) => setRequestInfoMessage(event.target.value)}
                placeholder="Optional overall message for the brand"
              />
            </div>
            <Button
              className="mt-4"
              fullWidth
              onClick={() => void handleRequestInfo()}
              disabled={saving}
            >
              Send request
            </Button>
          </section>

          <section className="rounded-[1.75rem] bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
              Review decision
            </p>
            <div className="mt-4 space-y-2">
              {reasons.map((reason) => (
                <label
                  key={reason.code}
                  className="flex items-start gap-3 rounded-[1.25rem] bg-gray-50 px-4 py-3 text-sm text-gray-700 transition hover:bg-gray-100"
                >
                  <input
                    type="checkbox"
                    checked={selectedReasonCodes.includes(reason.code)}
                    onChange={() => toggleReason(reason.code)}
                    className="mt-1"
                  />
                  <span>{reason.label}</span>
                </label>
              ))}
            </div>

            {selectedReasonCodes.includes('CUSTOM') ? (
              <Textarea
                className="mt-4"
                label="Custom rejection reason"
                rows={3}
                value={customReason}
                onChange={(event) => setCustomReason(event.target.value)}
              />
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Button
                variant="danger"
                onClick={() => void handleReview('REJECTED')}
                disabled={saving}
              >
                Reject
              </Button>
              <Button
                onClick={() => void handleReview('APPROVED')}
                disabled={saving}
              >
                Approve
              </Button>
            </div>
          </section>

          <section className="rounded-[1.75rem] bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
              Reviewer notes
            </p>
            <Textarea
              className="mt-4"
              rows={3}
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              placeholder="Add an internal audit note"
            />
            <Button
              className="mt-4"
              variant="secondary"
              fullWidth
              onClick={() => void handleAddNote()}
              disabled={saving || !noteText.trim()}
            >
              Add note
            </Button>

            <div className="mt-5 space-y-3">
              {(details.verificationNotes ?? []).map((note) => (
                <article
                  key={note.id}
                  className="rounded-[1.25rem] bg-gray-50 px-4 py-4"
                >
                  <p className="text-sm text-gray-700">{note.text}</p>
                  <p className="mt-2 text-xs text-gray-500">
                    {new Date(note.createdAt).toLocaleString()}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>

      <ConfirmDialog
        open={isRevealNinDialogOpen}
        title="Reveal full NIN?"
        message="This shows sensitive identity data. Confirm only if this is required to complete the verification review."
        confirmText="Reveal NIN"
        cancelText="Cancel"
        isDestructive
        isLoading={saving}
        onCancel={() => setIsRevealNinDialogOpen(false)}
        onConfirm={() => {
          setIsNinRevealed(true);
          setIsRevealNinDialogOpen(false);
        }}
      />
    </div>
  );
}
