import type { Metadata } from "next";
import "./globals.css";
import "./styles/board.css";
import { featureFlags, isPlaytestUiEnabled } from "@/lib/constants/featureFlags";
import { GearMenu } from "@/components/ui/GearMenu";

export const metadata: Metadata = {
  title: "Wottle Board",
  description: "MVP board scaffold with Supabase-backed swaps",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const playtestEnabled = isPlaytestUiEnabled();
  const enabledExperiences = [
    featureFlags.playtestLobby && "lobby",
    featureFlags.playtestMatchView && "match",
  ].filter(Boolean);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <main className="flex min-h-screen flex-col">
          <header className="relative border-b border-white/10 px-6 py-4">
            <div className="flex items-start justify-between">
            <h1 className="text-xl font-semibold">Wottle MVP Board Scaffold</h1>
            <GearMenu />
            </div>
            <p className="text-sm text-white/60">
              Foundation for Supabase-powered grid and swap workflows
            </p>
            {playtestEnabled && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-emerald-200">
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-semibold tracking-wide uppercase">
                  Playtest Mode
                </span>
                <span>
                  Previewing {enabledExperiences.join(" & ")} experience {enabledExperiences.length > 1 ? "s" : ""}.
                  Toggle via `NEXT_PUBLIC_ENABLE_PLAYTEST_*` env vars.
                </span>
              </div>
            )}
          </header>

          <div className="flex flex-1 flex-col px-6 py-8">{children}</div>
        </main>
      </body>
    </html>
  );
}
