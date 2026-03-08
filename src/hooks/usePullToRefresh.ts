import { useRef, useCallback, useState, useEffect } from "react";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPull?: number;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 120,
}: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const scrollParent = containerRef.current?.closest("[data-scroll-container]") as HTMLElement | null;
    const scrollTop = scrollParent?.scrollTop ?? 0;
    if (scrollTop <= 0 && !isRefreshing) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
      // Dampen the pull with a diminishing factor
      const dampened = Math.min(delta * 0.5, maxPull);
      setPullDistance(dampened);
    } else {
      pulling.current = false;
      setPullDistance(0);
    }
  }, [maxPull]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current && pullDistance === 0) return;
    pulling.current = false;

    if (pullDistance >= threshold) {
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(15);
      }
      setIsRefreshing(true);
      setPullDistance(threshold * 0.6); // Settle to spinner position
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: true });
    el.addEventListener("touchend", handleTouchEnd);
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { containerRef, pullDistance, isRefreshing };
}
