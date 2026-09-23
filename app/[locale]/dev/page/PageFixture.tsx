"use client";

import { DoorPage } from "@/components/page/door/DoorPage";

import { DOOR_EN, DOOR_IS, type PagePhase } from "./fixtures";

/** Renders one page phase from static facts (T017); each story adds its phases. */
export function PageFixture({ phase }: { phase: PagePhase }) {
  switch (phase) {
    case "door":
      return <DoorPage overview={DOOR_EN} returning={null} next={null} preferOther={false} />;
    case "is-door":
      return <DoorPage overview={DOOR_IS} returning={null} next={null} preferOther={false} />;
    case "door-returning":
      return <DoorPage overview={DOOR_EN} returning={{ displayName: "Birna", rating: 1310 }} next={null} preferOther={false} />;
  }
}
