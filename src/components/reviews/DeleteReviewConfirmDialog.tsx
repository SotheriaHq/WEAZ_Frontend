import ConfirmDialog from '@/components/ui/ConfirmDialog';

type DeleteReviewConfirmDialogProps = {
  open: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export default function DeleteReviewConfirmDialog({
  open,
  loading = false,
  onCancel,
  onConfirm,
}: DeleteReviewConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title="Delete review?"
      message="Your review will be removed from public review lists and summaries. This does not affect the completed order."
      confirmText="Delete review"
      cancelText="Keep review"
      isDestructive
      isLoading={loading}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
