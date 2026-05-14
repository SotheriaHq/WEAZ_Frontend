import { lazy, Suspense } from 'react';
import type { CustomOrderComposerPageProps } from '@/pages/custom-orders/CustomOrderComposerPage';

const CustomOrderComposerPage = lazy(() => import('@/pages/custom-orders/CustomOrderComposerPage'));

const CustomOrderComposerFallback = () => (
  <div className="flex min-h-[420px] items-center justify-center px-6 text-sm font-medium text-slate-500 dark:text-slate-300">
    Loading custom order composer...
  </div>
);

export default function LazyCustomOrderComposerPage(props: CustomOrderComposerPageProps) {
  return (
    <Suspense fallback={<CustomOrderComposerFallback />}>
      <CustomOrderComposerPage {...props} />
    </Suspense>
  );
}
