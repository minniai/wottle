import type { Coordinate } from "@/lib/types/board";

import { HowToPlayCard } from "./HowToPlayCard";
import { LegendCard } from "./LegendCard";
import { YourMoveCard } from "./YourMoveCard";

interface MatchLeftRailProps {
  selection: Coordinate | null;
  submittedMove: [Coordinate, Coordinate] | null;
}

export function MatchLeftRail({ selection, submittedMove }: MatchLeftRailProps) {
  return (
    <>
      <HowToPlayCard />
      <LegendCard />
      <YourMoveCard selection={selection} submittedMove={submittedMove} />
    </>
  );
}
