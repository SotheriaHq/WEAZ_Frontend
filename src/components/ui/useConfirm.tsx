import { useCallback, useMemo, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

export interface ConfirmOptions {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions;
  resolve?: (value: boolean) => void;
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    options: {},
  });
  const { open, options, resolve } = state;

  const confirm = useCallback((options: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, options, resolve });
    });
  }, []);

  const handleCancel = useCallback(() => {
    resolve?.(false);
    setState({ open: false, options: {} });
  }, [resolve]);

  const handleConfirm = useCallback(() => {
    resolve?.(true);
    setState({ open: false, options: {} });
  }, [resolve]);

  const dialog = useMemo(
    () => (
      <ConfirmDialog
        open={open}
        title={options.title}
        message={options.message}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        isDestructive={options.isDestructive}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    ),
    [open, options, handleConfirm, handleCancel],
  );

  return { confirm, ConfirmDialog: dialog };
}

export default useConfirm;
