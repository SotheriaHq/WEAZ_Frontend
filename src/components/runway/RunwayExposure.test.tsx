import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import RunwayExposure from "./RunwayExposure";
import { enqueueWebMarketSignal } from "@/services/marketSignalQueue";

vi.mock("@/services/marketSignalQueue", () => ({
  createWebMarketSignalClientId: () => "session",
  enqueueWebMarketSignal: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Runway exposure quality", () => {
  it("waits for visible design media and excludes an already loaded avatar", () => {
    vi.useFakeTimers();
    let intersect: IntersectionObserverCallback = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          intersect = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    const view = render(
      <RunwayExposure designId="design">
        <img alt="avatar" />
        <div data-runway-content="true">
          <img alt="design" />
        </div>
      </RunwayExposure>,
    );
    const avatar = view.getByAltText("avatar");
    const media = view.getByAltText("design");
    Object.defineProperty(avatar, "naturalWidth", { value: 100 });
    Object.defineProperty(media, "naturalWidth", {
      value: 0,
      configurable: true,
    });
    intersect(
      [
        {
          isIntersecting: true,
          intersectionRatio: 0.8,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    );
    vi.advanceTimersByTime(1500);
    expect(enqueueWebMarketSignal).not.toHaveBeenCalled();
    Object.defineProperty(media, "naturalWidth", { value: 100 });
    fireEvent.load(media);
    vi.advanceTimersByTime(1000);
    expect(enqueueWebMarketSignal).toHaveBeenCalledWith(
      expect.objectContaining({ signalType: "IMPRESSION", targetId: "design" }),
      expect.anything(),
    );
    view.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not measure an inactive prerendered reel", () => {
    vi.stubGlobal("IntersectionObserver", vi.fn());
    render(
      <RunwayExposure designId="design" active={false}>
        <div data-runway-content="true">
          <img alt="design" />
        </div>
      </RunwayExposure>,
    );
    expect(IntersectionObserver).not.toHaveBeenCalled();
    expect(enqueueWebMarketSignal).not.toHaveBeenCalled();
  });
});
