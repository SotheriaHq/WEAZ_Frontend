import { apiClient } from '@/api/httpClient';

/**
 * The visit — the last step of brand verification.
 *
 * Two audiences, two prefixes: an agent works under `/verification/physical`
 * and a brand answers under `/brand/verification/physical`. Keeping them apart
 * here mirrors the server, where they are separate controllers with separate
 * guards, so a call cannot accidentally be made from the wrong side.
 */

export type PhysicalVerificationStatus =
  | 'PENDING_ASSIGNMENT'
  | 'ASSIGNED'
  | 'SCHEDULE_PROPOSED'
  | 'SCHEDULE_CONFIRMED'
  | 'RESCHEDULE_REQUESTED'
  | 'VISIT_COMPLETED'
  /** Postponed with no date. Not terminal — the agent proposes again. */
  | 'ON_HOLD'
  | 'PASSED'
  | 'FAILED'
  | 'DECLINED';

export type PhysicalVerificationBrandResponse =
  | 'AGREED'
  | 'RESCHEDULE_REQUESTED'
  | 'DECLINED';

export type PhysicalVerificationProofKind =
  | 'WORKSPACE'
  | 'PACKAGING'
  | 'BRANDING'
  | 'SIGNAGE'
  | 'EQUIPMENT'
  | 'OTHER';

export interface PhysicalVerificationProof {
  id: string;
  kind: PhysicalVerificationProofKind;
  fileKey: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  caption: string | null;
  createdAt: string;
}

export interface PhysicalVerificationSummary {
  id: string;
  brandId: string;
  brandName: string;
  attemptId: string;
  status: PhysicalVerificationStatus;
  assignedAgentId: string | null;
  assignedAt: string | null;
  claimedAt: string | null;
  proposedSlots: string[];
  selectedSlotAt: string | null;
  brandResponse: PhysicalVerificationBrandResponse | null;
  brandRespondedAt: string | null;
  brandResponseNote: string | null;
  rescheduleCount: number;
  visitCompletedAt: string | null;
  decidedAt: string | null;
  decisionNotes: string | null;
  failureReason: string | null;
  declineReason: string | null;
  proofCount: number;
  minProofsForDecision: number;
  createdAt: string;
}

export interface PhysicalVerificationDetail extends PhysicalVerificationSummary {
  proofs: PhysicalVerificationProof[];
}

/** What a brand sees: no agent identity, no evidence — just their own visit. */
export interface BrandVisitView extends Omit<PhysicalVerificationSummary, 'assignedAgentId'> {
  canRespond: boolean;
  remainingReschedules: number;
}

const unwrap = <T,>(payload: unknown): T => {
  const container = payload as { data?: unknown } | null;
  return ((container?.data ?? payload) as T);
};

export const physicalVerificationApi = {
  /* ── agent ─────────────────────────────────────────────────────────── */

  async list(params?: {
    status?: PhysicalVerificationStatus;
    mine?: boolean;
  }): Promise<PhysicalVerificationSummary[]> {
    const response = await apiClient.get('/verification/physical', {
      params: {
        ...(params?.status ? { status: params.status } : {}),
        ...(params?.mine ? { mine: 'true' } : {}),
      },
    });
    const rows = unwrap<PhysicalVerificationSummary[]>(response.data);
    return Array.isArray(rows) ? rows : [];
  },

  async detail(id: string): Promise<PhysicalVerificationDetail> {
    const response = await apiClient.get(
      `/verification/physical/${encodeURIComponent(id)}`,
    );
    return unwrap<PhysicalVerificationDetail>(response.data);
  },

  async assign(id: string, agentId: string): Promise<PhysicalVerificationDetail> {
    const response = await apiClient.post(
      `/verification/physical/${encodeURIComponent(id)}/assign`,
      { agentId },
    );
    return unwrap<PhysicalVerificationDetail>(response.data);
  },

  async claim(id: string): Promise<PhysicalVerificationDetail> {
    const response = await apiClient.post(
      `/verification/physical/${encodeURIComponent(id)}/claim`,
    );
    return unwrap<PhysicalVerificationDetail>(response.data);
  },

  async propose(
    id: string,
    input: { slots: string[]; note?: string },
  ): Promise<PhysicalVerificationDetail> {
    const response = await apiClient.post(
      `/verification/physical/${encodeURIComponent(id)}/propose`,
      input,
    );
    return unwrap<PhysicalVerificationDetail>(response.data);
  },

  async respondToReschedule(
    id: string,
    input: { decision: 'ACCEPTED' | 'DECLINED'; note?: string },
  ): Promise<PhysicalVerificationDetail> {
    const response = await apiClient.post(
      `/verification/physical/${encodeURIComponent(id)}/reschedule-response`,
      input,
    );
    return unwrap<PhysicalVerificationDetail>(response.data);
  },

  async addProof(
    id: string,
    input: {
      fileKey: string;
      kind?: PhysicalVerificationProofKind;
      fileName?: string;
      mimeType?: string;
      sizeBytes?: number;
      caption?: string;
    },
  ): Promise<PhysicalVerificationDetail> {
    const response = await apiClient.post(
      `/verification/physical/${encodeURIComponent(id)}/proofs`,
      input,
    );
    return unwrap<PhysicalVerificationDetail>(response.data);
  },

  async removeProof(
    id: string,
    proofId: string,
  ): Promise<PhysicalVerificationDetail> {
    const response = await apiClient.delete(
      `/verification/physical/${encodeURIComponent(id)}/proofs/${encodeURIComponent(proofId)}`,
    );
    return unwrap<PhysicalVerificationDetail>(response.data);
  },

  async decide(
    id: string,
    input: { outcome: 'PASSED' | 'FAILED'; notes?: string; failureReason?: string },
  ): Promise<PhysicalVerificationDetail> {
    const response = await apiClient.post(
      `/verification/physical/${encodeURIComponent(id)}/decision`,
      input,
    );
    return unwrap<PhysicalVerificationDetail>(response.data);
  },

  /* ── brand ─────────────────────────────────────────────────────────── */

  async mine(): Promise<BrandVisitView | null> {
    const response = await apiClient.get('/brand/verification/physical');
    return unwrap<BrandVisitView | null>(response.data) ?? null;
  },

  async reply(
    id: string,
    input: {
      response: PhysicalVerificationBrandResponse;
      selectedSlot?: string;
      note?: string;
    },
  ): Promise<BrandVisitView> {
    const response = await apiClient.post(
      `/brand/verification/physical/${encodeURIComponent(id)}/reply`,
      input,
    );
    return unwrap<BrandVisitView>(response.data);
  },
};

export default physicalVerificationApi;
