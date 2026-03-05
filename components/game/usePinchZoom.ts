import { useState, useCallback } from "react";

export function usePinchZoom(minScale = 0.5, maxScale = 1.5) {
  const [scale, setScale] = useState(1);
  const [initialDistance, setInitialDistance] = useState<number | null>(null);
  const [initialScale, setInitialScale] = useState<number>(1);

  const getDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setInitialDistance(getDistance(e.touches));
      setInitialScale(scale);
    }
  }, [scale]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialDistance !== null) {
      const currentDistance = getDistance(e.touches);
      const distanceRatio = currentDistance / initialDistance;
      const newScale = Math.min(Math.max(initialScale * distanceRatio, minScale), maxScale);
      setScale(newScale);
    }
  }, [initialDistance, initialScale, minScale, maxScale]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      setInitialDistance(null);
    }
  }, []);

  return { scale, handleTouchStart, handleTouchMove, handleTouchEnd };
}
