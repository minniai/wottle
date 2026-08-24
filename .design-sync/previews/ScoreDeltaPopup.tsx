import { ScoreDeltaPopup } from "wottle";

// The popup is absolutely positioned above its nearest relative ancestor and
// runs a 3s fade-out animation. For a stable screenshot we freeze the
// animation at its visible keyframe and anchor it over a mock score readout.
function FrozenPopupStage({
  letterPoints,
  lengthBonus,
  score,
}: {
  letterPoints: number;
  lengthBonus: number;
  score: number;
}) {
  return (
    <div style={{ paddingTop: 28, display: "flex", justifyContent: "center" }}>
      <style>{`.score-delta-popup { animation: none !important; opacity: 1 !important; }`}</style>
      <div style={{ position: "relative", display: "inline-block" }}>
        <span className="font-mono text-[28px] font-semibold text-ink">{score}</span>
        <ScoreDeltaPopup delta={{ letterPoints, lengthBonus }} />
      </div>
    </div>
  );
}

export function LettersAndLengthBonus() {
  return <FrozenPopupStage letterPoints={12} lengthBonus={15} score={132} />;
}

export function LettersOnly() {
  return <FrozenPopupStage letterPoints={7} lengthBonus={0} score={58} />;
}
