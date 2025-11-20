const FORWARD_KEYS = new Set(["ArrowRight", "ArrowDown"]);
const BACKWARD_KEYS = new Set(["ArrowLeft", "ArrowUp"]);

export function getNextRovingIndex(
  currentIndex: number,
  totalItems: number,
  key: string,
): number {
  if (totalItems <= 0) {
    return currentIndex;
  }

  if (key === "Home") {
    return 0;
  }

  if (key === "End") {
    return Math.max(0, totalItems - 1);
  }

  if (FORWARD_KEYS.has(key)) {
    return (currentIndex + 1) % totalItems;
  }

  if (BACKWARD_KEYS.has(key)) {
    return (currentIndex - 1 + totalItems) % totalItems;
  }

  return currentIndex;
}


