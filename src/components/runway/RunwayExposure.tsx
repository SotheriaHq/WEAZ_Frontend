import { useEffect, useRef, type ReactNode } from "react";
import {
  createWebMarketSignalClientId,
  enqueueWebMarketSignal,
} from "@/services/marketSignalQueue";

const sessionId = createWebMarketSignalClientId("runway");
export default function RunwayExposure({
  designId,
  children,
  active = true,
  className,
}: {
  designId: string;
  children: ReactNode;
  active?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || !active) return;
    let visible = false;
    let started: number | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const track = (
      signalType:
        | "IMPRESSION"
        | "DWELL_SHORT"
        | "DWELL_MEDIUM"
        | "DWELL_LONG"
        | "SCROLL_SKIP",
      value?: number,
    ) =>
      enqueueWebMarketSignal(
        {
          targetType: "DESIGN",
          targetId: designId,
          surface: "DESIGN_FEED",
          signalType,
          value,
        },
        { screenContext: "Runway", sessionId },
      );
    const finish = (skip: boolean) => {
      clearTimeout(timer);
      if (started === null) return;
      const elapsed = Math.max(0, performance.now() - started);
      started = null;
      if (elapsed >= 1000)
        track(
          elapsed >= 8000
            ? "DWELL_LONG"
            : elapsed >= 3000
              ? "DWELL_MEDIUM"
              : "DWELL_SHORT",
          Math.min(elapsed, 60000),
        );
      else if (skip && elapsed >= 250) track("SCROLL_SKIP");
    };
    const update = () => {
      const media = [
        ...root.querySelectorAll(
          '[data-runway-content="true"] img,[data-runway-content="true"] video',
        ),
      ].some((node) =>
        node instanceof HTMLImageElement
          ? node.complete && node.naturalWidth > 0
          : node instanceof HTMLVideoElement && node.readyState >= 2,
      );
      if (visible && media && document.visibilityState === "visible") {
        if (started === null) {
          started = performance.now();
          timer = setTimeout(() => track("IMPRESSION"), 1000);
        }
      } else finish(false);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries.some(
          (entry) => entry.isIntersecting && entry.intersectionRatio >= 0.6,
        );
        if (!visible) finish(true);
        update();
      },
      { threshold: [0.6] },
    );
    observer.observe(root);
    root.addEventListener("load", update, true);
    root.addEventListener("loadeddata", update, true);
    document.addEventListener("visibilitychange", update);
    return () => {
      finish(false);
      observer.disconnect();
      root.removeEventListener("load", update, true);
      root.removeEventListener("loadeddata", update, true);
      document.removeEventListener("visibilitychange", update);
    };
  }, [active, designId]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
