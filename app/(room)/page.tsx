import { redirect } from "next/navigation";

import { LandingScreen } from "@/components/landing/LandingScreen";
import { readLobbySession } from "@/lib/matchmaking/profile";

export default async function LandingPage() {
  const session = await readLobbySession();
  if (session) {
    redirect("/lobby");
  }
  return <LandingScreen />;
}
