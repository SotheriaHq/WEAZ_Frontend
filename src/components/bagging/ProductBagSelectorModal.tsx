import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useBagging } from '@/hooks/useBagging';
import type { BagStatus } from '@/api/StoreApi';

type BagProductInput = {
  id: string;
  name?: string;
};

type ProductBagSelectorModalProps = {
  isOpen: boolean;
  product: BagProductInput | null;
  status: BagStatus | null;
  onClose: () => void;
};

const ProductBagSelectorModal: React.FC<ProductBagSelectorModalProps> = ({
  isOpen,
  product,
  status,
  onClose,
}) => {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const { addStandard, loadingByProductId } = useBagging();
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  useFocusTrap({
    containerRef: dialogRef,
    active: isOpen,
    onEscape: onClose,
  });

  useEffect(() => {
    if (!isOpen) return;
    setSelectedSize(status?.standard.selectedSize ?? null);
    setSelectedColor(status?.standard.selectedColor ?? null);
    setQuantity(1);
  }, [isOpen, status]);

  const isLoading = Boolean(product && loadingByProductId[product.id]);

  const requiresSize = Boolean(status?.standard.requiresSize);
  const requiresColor = Boolean(status?.standard.requiresColor);

  const canSubmit = useMemo(() => {
    if (!status || !product) return false;
    if (requiresSize && !selectedSize) return false;
    if (requiresColor && !selectedColor) return false;
    return !isLoading;
  }, [isLoading, product, requiresColor, requiresSize, selectedColor, selectedSize, status]);

  const handleSubmit = async () => {
    if (!product || !status) return;
    await addStandard(product.id, {
      size: selectedSize,
      color: selectedColor,
      quantity,
    });
    onClose();
  };

  const sizeOptions = status?.standard.sizes ?? [];
  const colorOptions = status?.standard.colors ?? [];

  return (
    <AnimatePresence>
      {isOpen && product && status && (
        <OverlayPortal>
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-layer-overlay bg-black/55 backdrop-blur-sm"
              onClick={onClose}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="fixed inset-0 z-layer-modal flex items-center justify-center p-4"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={`Select options for ${product.name || 'this item'}`}
            >
              <div
                ref={dialogRef}
                tabIndex={-1}
                className="relative w-full max-w-2xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-fuchsia-500" />
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute right-4 top-4 rounded-full p-2 transition-colors hover:bg-slate-100 dark:hover:bg-white/10"
                  aria-label="Close selector"
                >
                  <span aria-hidden="true" className="text-lg leading-none text-slate-500">x</span>
                </button>

                <div className="max-h-[90vh] overflow-y-auto p-6 sm:p-8">
                  <div className="mb-6 space-y-2 pr-10">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-600">
                      Bag options
                    </p>
                    <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">
                      Select options for {product.name || 'this item'}
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {status.ui.disabledReason || 'Choose the right size and color before adding this item to your bag.'}
                    </p>
                  </div>

                  <div className="space-y-5">
                    {requiresSize && (
                      <section className="space-y-3">
                        <div className="flex items-center justify-between gap-4">
                          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Size
                          </h3>
                          <span className="text-xs text-slate-500">Required</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {sizeOptions.length > 0 ? (
                            sizeOptions.map((size) => {
                              const selected = selectedSize === size;
                              return (
                                <button
                                  key={size}
                                  type="button"
                                  onClick={() => setSelectedSize(size)}
                                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                                    selected
                                      ? 'border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950'
                                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-200'
                                  }`}
                                >
                                  {size}
                                </button>
                              );
                            })
                          ) : (
                            <p className="text-sm text-rose-600">No size options are available for this item.</p>
                          )}
                        </div>
                      </section>
                    )}

                    {requiresColor && (
                      <section className="space-y-3">
                        <div className="flex items-center justify-between gap-4">
                          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Color
                          </h3>
                          <span className="text-xs text-slate-500">Required</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {colorOptions.length > 0 ? (
                            colorOptions.map((color) => {
                              const selected = selectedColor === color;
                              return (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() => setSelectedColor(color)}
                                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                                    selected
                                      ? 'border-rose-500 bg-rose-500 text-white'
                                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-200'
                                  }`}
                                >
                                  {color}
                                </button>
                              );
                            })
                          ) : (
                            <p className="text-sm text-rose-600">No color options are available for this item.</p>
                          )}
                        </div>
                      </section>
                    )}

                    <section className="space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Quantity
                        </h3>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                          aria-label="Decrease quantity"
                        >
                          <span aria-hidden="true">-</span>
                        </button>
                        <span className="min-w-12 text-center text-base font-semibold text-slate-950 dark:text-white">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity((current) => Math.min(10, current + 1))}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                          aria-label="Increase quantity"
                        >
                          <span aria-hidden="true">+</span>
                        </button>
                      </div>
                    </section>
                  </div>

                  <div className="mt-8 flex items-center gap-3 border-t border-slate-200 pt-5 dark:border-white/10">
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
                    >
                      <span aria-hidden="true">←</span>
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSubmit()}
                      disabled={!canSubmit}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                    >
                      Add to bag
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        </OverlayPortal>
      )}
    </AnimatePresence>
  );
};

export default ProductBagSelectorModal;
