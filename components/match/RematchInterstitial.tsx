"use client";

export function RematchInterstitial() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90"
      data-testid="rematch-interstitial"
    >
      <p className="text-xl font-semibold text-white animate-pulse">
        Starting new game...
      </p>
    </div>
  );
}
