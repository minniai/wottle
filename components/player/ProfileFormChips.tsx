import type { MatchResult } from "@/lib/types/match";

interface ProfileFormChipsProps {
  form: MatchResult[]; // newest first
}

const STYLE: Record<MatchResult, string> = {
  W: "bg-good/25 text-good",
  L: "bg-bad/25 text-bad",
  D: "bg-paper-2 text-ink-3",
};

export function ProfileFormChips({ form }: ProfileFormChipsProps) {
  const chips: (MatchResult | null)[] = Array.from(
    { length: 10 },
    (_, i) => form[i] ?? null,
  );

  return (
    <div
      data-testid="profile-form-chips"
      className="flex flex-wrap gap-1"
      aria-label="Last 10 match results"
    >
      {chips.map((result, i) => (
        <span
          key={i}
          data-testid="form-chip"
          className={`flex h-[22px] w-[22px] items-center justify-center rounded-sm font-mono text-[10px] font-semibold ${
            result ? STYLE[result] : "bg-paper-2/30"
          }`}
        >
          {result ?? ""}
        </span>
      ))}
    </div>
  );
}
