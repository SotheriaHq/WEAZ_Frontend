import { useCallback, useState } from 'react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import type { ConfirmOptions } from '@/components/ui/useConfirm';
import { useOverlayBackClose } from '@/hooks/useOverlayBackClose';

export function useQueueConfirm() {
  const [request, setRequest] = useState<{ options: ConfirmOptions; resolve: (result: boolean) => void } | null>(null);
  const finish = useCallback((result: boolean) => {
    request?.resolve(result);
    setRequest(null);
  }, [request]);
  const close = useCallback(() => finish(false), [finish]);
  useOverlayBackClose(Boolean(request), close, true);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => setRequest({ options, resolve })), []);
  return {
    confirm,
    ConfirmDialog: <ConfirmDialog open={Boolean(request)} title={request?.options.title} message={request?.options.message} confirmText={request?.options.confirmText} cancelText={request?.options.cancelText} isDestructive={request?.options.isDestructive} onConfirm={() => finish(true)} onCancel={close} />,
  };
}
