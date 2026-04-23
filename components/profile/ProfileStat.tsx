interface ProfileStatProps {
  label: string;
  value: string | number;
}

export function ProfileStat({ label, value }: ProfileStatProps) {
  return (
    <div data-testid="profile-stat">
      <p className="font-display text-[26px] italic leading-none text-ink">
        {value}
      </p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        {label}
      </p>
    </div>
  );
}
