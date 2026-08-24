import { Board } from "wottle";

const row = (letters: string) => letters.split("");

/** 10x10 Icelandic board with embedded words: ÚLFUR, BORÐA, SKÁLD, VINUR, ÞOKA, TAFL. */
const BOARD = [
  row("TAKRÓSEMIN"),
  row("ÚLFUREKATS"),
  row("NBORÐAGILT"),
  row("GÝMÆTÖNFÁR"),
  row("ASKÁLDISTÓ"),
  row("HREVINUROF"),
  row("ÞOKANDEMUR"),
  row("EIKURTAFLI"),
  row("LÁNSEMDÓTA"),
  row("GRÖFINKÝRN"),
];

/* BoardCoordLabels stretches its A–J header across the full container width
 * while the grid itself keeps an intrinsic max width, so previews must
 * constrain the container for the labels to align with the columns. */

export function CanonicalWithCoordLabels() {
  return (
    <div style={{ maxWidth: 440 }}>
      <Board initialGrid={BOARD} matchId="preview-match" />
    </div>
  );
}

export function MobileWidth() {
  return (
    <div style={{ maxWidth: 340 }}>
      <Board initialGrid={BOARD} matchId="preview-match" />
    </div>
  );
}
