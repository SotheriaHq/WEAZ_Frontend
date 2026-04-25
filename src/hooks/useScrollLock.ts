import { useEffect, useRef } from 'react';

/**
 * Hook to lock/unlock body scroll when an overlay (modal, sidebar, etc.) is open.
 * This prevents the background page from scrolling while the overlay is active.
 * 
 * @param isLocked - Whether scroll should be locked (typically when overlay is open)
 * 
 * @example
 * ```tsx
 * function Modal({ open, onClose }) {
 *   useScrollLock(open);
 *   if (!open) return null;
 *   return <div>Modal content</div>;
 * }
 * ```
 */
export function useScrollLock(isLocked: boolean): void {
    const originalStyleRef = useRef<string | null>(null);
    const originalScrollY = useRef<number>(0);

    useEffect(() => {
        if (!isLocked) {
            return;
        }

        // Store original values
        originalStyleRef.current = document.body.style.overflow;
        originalScrollY.current = window.scrollY;

        // Lock scroll by adding class and setting overflow
        document.body.classList.add('modal-open');
        document.documentElement.classList.add('modal-open');
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        // Cleanup function to restore scroll
        return () => {
            document.body.classList.remove('modal-open');
            document.documentElement.classList.remove('modal-open');

            // Restore original overflow style
            if (originalStyleRef.current !== null) {
                document.body.style.overflow = originalStyleRef.current;
                // We don't store html overflow, just clear it
                document.documentElement.style.overflow = '';
            } else {
                document.body.style.overflow = '';
                document.documentElement.style.overflow = '';
            }

            // Optional: Restore scroll position if needed
            // This prevents jump when closing modal
            // window.scrollTo(0, originalScrollY.current);
        };
    }, [isLocked]);
}
