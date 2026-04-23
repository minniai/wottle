import type { BestWord } from "@/lib/types/match";

interface ProfileWordCloudProps {
  words: BestWord[];
}

function fontSizeFor(points: number): number {
  const raw = 16 + points * 0.5;
  return Math.min(40, Math.max(16, Math.round(raw)));
}

export function ProfileWordCloud({ words }: ProfileWordCloudProps) {
  if (words.length === 0) {
    return (
      <div
        data-testid="profile-word-cloud"
        className="px-2 py-4 text-center text-sm text-ink-soft"
      >
        No scored words yet.
      </div>
    );
  }

  return (
    <div
      data-testid="profile-word-cloud"
      className="flex flex-wrap items-baseline gap-x-3.5 gap-y-2"
    >
      {words.map((w, i) => {
        const isTopThree = i < 3;
        const colorClass = isTopThree ? "text-ochre-deep" : "text-ink";
        return (
          <span
            key={`${w.word}-${i}`}
            data-testid="word-cloud-item"
            className={`font-display font-semibold italic ${colorClass}`}
            style={{ fontSize: `${fontSizeFor(w.points)}px` }}
          >
            {w.word}
            <sub className="ml-[3px] font-mono text-[10px] not-italic text-ink-soft">
              +{w.points}
            </sub>
          </span>
        );
      })}
    </div>
  );
}
