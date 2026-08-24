import { RoundPipBar } from "wottle";

export function FirstRound() {
  return <RoundPipBar current={1} total={10} />;
}

export function MidMatch() {
  return <RoundPipBar current={5} total={10} />;
}

export function FinalRound() {
  return <RoundPipBar current={10} total={10} />;
}
