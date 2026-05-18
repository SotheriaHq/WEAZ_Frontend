import type { ReviewPromptDto } from '@/api/ReviewApi';
import Button from '@/components/ui/Button';
import { promptTitle, targetLabel } from './reviewDisplay';

type ReviewPromptCardProps = {
  prompt: ReviewPromptDto;
  onReview: (prompt: ReviewPromptDto) => void;
  onSkip: (prompt: ReviewPromptDto) => void;
  skipping?: boolean;
};

export default function ReviewPromptCard({ prompt, onReview, onSkip, skipping = false }: ReviewPromptCardProps) {
  return (
    <article className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white">{promptTitle(prompt)}</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Share a verified-purchase review for this completed {targetLabel(prompt.targetType)}. This is optional.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => onReview(prompt)}>
            Write review
          </Button>
          <Button type="button" size="sm" variant="secondary" loading={skipping} onClick={() => onSkip(prompt)}>
            Skip
          </Button>
        </div>
      </div>
    </article>
  );
}
