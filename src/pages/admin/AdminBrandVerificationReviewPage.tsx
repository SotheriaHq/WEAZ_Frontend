import { useEffect, useMemo, useState } from 'react';
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

  const load = async () => {
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
  };

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
  }, [id]);

  const latestAttempt = details?.latestAttempt as Record<string, any> | null;
  const returnTo =
    typeof (location.state as { returnTo?: unknown } | null)?.returnTo === 'string'
      ? ((location.state as { returnTo?: string }).returnTo || '/admin/verification')
      : '/admin/verification';
  const selectedDocument = useMemo(
    () =>
      details?.documents?.find((document) => document.key === selectedDocumentKey) ??
      details?.documents?.[0] ??
      null,
    [details?.documents, selectedDocumentKey],
  );

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
      <div className="rounded-[1.75rem] border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
        Loading verification review...
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <AdminBreadcrumb segments={[{ label: 'Brands', path: '/admin/brands' }, { label: 'Verification Review' }]} />
      <section className="min-w-0 rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(135deg,_#f9fcff,_#ffffff_48%,_#f7f7ff)] p-6 shadow-[0_30px_80px_-40px_rgba(14,165,233,0.35)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <Link
              to="/admin/verification"
              className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700"
            >
              Back to verification queue
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

        <div className="mt-6 flex flex-wrap gap-3">
          <Button size="sm" variant="secondary" onClick={() => void handleClaim()} disabled={saving}>
            Claim
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void handleRelease()} disabled={saving}>
            Release
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void handleReassign()} disabled={saving}>
            Reassign to me
          </Button>
        </div>
        <div className="mt-4 grid gap-2 text-xs text-gray-600 md:grid-cols-2 xl:grid-cols-3">
          <p className="rounded-xl border border-gray-200 bg-white/70 px-3 py-2 break-words">
            <span className="font-semibold text-gray-900">Claim:</span> take ownership of this review so you can submit final decisions.
          </p>
          <p className="rounded-xl border border-gray-200 bg-white/70 px-3 py-2 break-words">
            <span className="font-semibold text-gray-900">Release:</span> put it back in queue so another admin can continue.
          </p>
          <p className="rounded-xl border border-gray-200 bg-white/70 px-3 py-2 break-words">
            <span className="font-semibold text-gray-900">Reassign to me:</span> move an already-assigned review to your account.
          </p>
        </div>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="min-w-0 space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-[1.5rem] border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                Owner identity
              </p>
              <p className="mt-3 text-sm font-semibold text-gray-900">
                {latestAttempt?.ownerLegalFirstName} {latestAttempt?.ownerLegalLastName}
              </p>
              <p className="mt-2 text-sm text-gray-600">
                NIN:{' '}
                {isNinRevealed
                  ? latestAttempt?.ownerNin || details.maskedOwnerNin || 'Not available'
                  : details.maskedOwnerNin || 'Not available'}
              </p>
              {!isNinRevealed && latestAttempt?.ownerNin ? (
                <button
                  type="button"
                  onClick={() => setIsRevealNinDialogOpen(true)}
                  className="mt-2 inline-flex items-center rounded-full border border-gray-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-700 transition hover:bg-gray-100"
                >
                  Reveal NIN
                </button>
              ) : null}
              <p className="mt-1 text-sm text-gray-600">
                DOB:{' '}
                {latestAttempt?.ownerDateOfBirth
                  ? new Date(latestAttempt.ownerDateOfBirth).toLocaleDateString()
                  : 'Not available'}
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                Business
              </p>
              <p className="mt-3 text-sm font-semibold text-gray-900">
                CAC: {latestAttempt?.cacNumber || 'Not available'}
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Entity: {String(latestAttempt?.legalEntityType || 'UNKNOWN').replace(/_/g, ' ')}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Authority: {String(latestAttempt?.authorityType || 'UNKNOWN').replace(/_/g, ' ')}
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                Queue record
              </p>
              <p className="mt-3 text-sm font-semibold text-gray-900">
                Attempt {details.verificationAttemptNumber ?? 0}
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Submitted:{' '}
                {details.verificationSubmittedAt
                  ? new Date(details.verificationSubmittedAt).toLocaleString()
                  : 'Not available'}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Version:{' '}
                {details.updatedAt
                  ? new Date(details.updatedAt).toLocaleString()
                  : 'Not available'}
              </p>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                  Evidence review
                </p>
                <h2 className="mt-2 text-xl font-black text-gray-900">
                  Document workspace
                </h2>
                <p className="mt-2 text-sm leading-7 text-gray-600">
                  Preview submitted evidence directly from this verification record. Links are secure, short-lived, and refresh when this page reloads.
                </p>
              </div>
              {selectedDocument?.signedUrl ? (
                <a
                  href={selectedDocument.signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-800 transition hover:border-sky-300 hover:bg-sky-100"
                >
                  Open file
                </a>
              ) : null}
            </div>

            <div className="mt-5 grid gap-5 2xl:grid-cols-[240px_minmax(0,1fr)]">
              <div className="min-w-0 space-y-3">
                {(details.documents ?? []).map((document) => (
                  <button
                    key={document.key}
                    type="button"
                    onClick={() => setSelectedDocumentKey(document.key)}
                    className={`w-full rounded-[1.25rem] border px-4 py-4 text-left transition ${
                      selectedDocument?.key === document.key
                        ? 'border-sky-300 bg-sky-50'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900">{document.label}</p>
                    <p className="mt-1 break-all text-xs uppercase tracking-[0.18em] text-gray-400">
                      {document.mimeType || 'Unknown type'}
                    </p>
                  </button>
                ))}
                <div className="rounded-[1.25rem] border border-indigo-200 bg-indigo-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Signed verification letter</p>
                  <p className="mt-2 text-sm font-semibold text-indigo-900">What this means</p>
                  <p className="mt-2 text-sm leading-6 text-indigo-900/90">
                    The owner confirms that submitted business and identity details are accurate, and accepts platform verification terms.
                  </p>
                  <p className="mt-2 text-xs text-indigo-800/80">
                    Signature method: {String(latestAttempt?.signatureMethod || 'Not recorded').replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-indigo-800/80">
                    Letter version: {latestAttempt?.letterVersion ?? 'Not recorded'}
                  </p>
                  <p className="text-xs text-indigo-800/80">
                    Signed at: {latestAttempt?.letterSignedAt ? new Date(latestAttempt.letterSignedAt).toLocaleString() : 'Not recorded'}
                  </p>
                </div>
              </div>

              <div className="min-w-0 overflow-hidden rounded-[1.5rem] border border-gray-200 bg-gray-50">
                {selectedDocument?.signedUrl ? (
                  isPdfDocument(selectedDocument) ? (
                    <iframe
                      title={selectedDocument.label}
                      src={selectedDocument.signedUrl}
                      className="h-[62vh] min-h-[420px] w-full bg-white"
                    />
                  ) : (
                    <div className="flex min-h-[420px] items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_36%),linear-gradient(180deg,_#ffffff,_#f8fafc)] p-4">
                      <img
                        src={selectedDocument.signedUrl}
                        alt={selectedDocument.label}
                        className="block max-h-[85vh] max-w-full rounded-[1.25rem] shadow-lg"
                      />
                    </div>
                  )
                ) : (
                  <div className="flex min-h-[420px] items-center justify-center px-6 text-sm text-gray-500">
                    No reviewer preview is available for the selected document yet.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
              Evidence manifest
            </p>
            <pre className="mt-4 max-h-72 overflow-auto rounded-[1.25rem] bg-gray-950 p-4 text-xs leading-6 text-gray-100">
              {JSON.stringify(latestAttempt?.evidenceManifest ?? {}, null, 2)}
            </pre>
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          <section className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
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
                  className="rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3"
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

          <section className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
              Review decision
            </p>
            <div className="mt-4 space-y-2">
              {reasons.map((reason) => (
                <label
                  key={reason.code}
                  className="flex items-start gap-3 rounded-[1.25rem] border border-gray-200 px-4 py-3 text-sm text-gray-700"
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

          <section className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
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
                  className="rounded-[1.25rem] border border-gray-200 bg-gray-50 px-4 py-4"
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
