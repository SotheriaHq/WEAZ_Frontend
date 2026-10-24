import { lazy } from 'react';
import { useSelector } from 'react-redux';
import { selectIsMobile } from '@/features/uiSlice';
import { useOverlayBackClose } from '@/hooks/useOverlayBackClose';
import { DeferredOverlay } from '@/components/ui/DeferredOverlay';
import type { DesignViewModalProps } from './DesignViewModalContent';

const DesignViewModalContent = lazy(() => import('./DesignViewModalContent'));

export default function DesignViewModal(props: DesignViewModalProps) {
  const isMobile = useSelector(selectIsMobile);
  // Arm Back immediately, including while the viewer chunk is downloading.
  useOverlayBackClose(props.open, props.onClose, isMobile);
  return <DeferredOverlay open={props.open}><DesignViewModalContent {...props} /></DeferredOverlay>;
}
