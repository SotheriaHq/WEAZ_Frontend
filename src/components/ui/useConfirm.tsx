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

  const confirm = useCallback((options: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, options, resolve });
    });
  }, []);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState({ open: false, options: {} });
  }, [state.resolve]);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState({ open: false, options: {} });
  }, [state.resolve]);

  const dialog = useMemo(
    () => (
      <ConfirmDialog
        open={state.open}
        title={state.options.title}
        message={state.options.message}
        confirmText={state.options.confirmText}
        cancelText={state.options.cancelText}
        isDestructive={state.options.isDestructive}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    ),
    [state.open, state.options, handleConfirm, handleCancel],
  );

  return { confirm, ConfirmDialog: dialog };
}

export default useConfirm;
