import { useQuery } from '@tanstack/react-query';
import { brandApi } from '@/api/BrandApi';
import type { VerificationStatusResponse, VerificationDraftResponse, VerificationLetterResponse } from '@/types/verification';

interface VerificationWizardResource {
  status: VerificationStatusResponse;
  draft: VerificationDraftResponse;
  letter: VerificationLetterResponse;
}

export const verificationWizardKey = (actorId?: string, workspaceId?: string | null) =>
  ['verification', 'wizard', actorId ?? null, workspaceId ?? null] as const;

/** Private evidence stays in memory; the verification root is never persisted. */
export function useVerificationWizardResource(actorId?: string, workspaceId?: string | null) {
  return useQuery<VerificationWizardResource, Error, VerificationWizardResource | undefined>({
    queryKey: verificationWizardKey(actorId, workspaceId),
    enabled: Boolean(actorId),
    refetchOnMount: true,
    select: (data) => !workspaceId || data.status.brandId === workspaceId ? data : undefined,
    queryFn: async ({ signal }) => {
      // The endpoint accepts the owner identity; workspaceId isolates the UI cache.
      const [status, draft, letter] = await Promise.all([
        brandApi.getVerificationStatus(actorId!, { force: true, signal }),
        brandApi.getVerificationDraft(actorId!, { signal }),
        brandApi.getVerificationLetter(actorId!, { signal }),
      ]);
      if (workspaceId && status.brandId !== workspaceId) {
        throw new Error('Verification details belong to a different workspace. Please retry.');
      }
      return { status, draft, letter };
    },
  });
}
