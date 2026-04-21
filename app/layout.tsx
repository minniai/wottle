import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./styles/board.css";
import "./styles/lobby.css";
import "./styles/matchmaking.css";
import { GearMenu } from "@/components/ui/GearMenu";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { TopBar } from "@/components/ui/TopBar";

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: true,
  variable: "--font-fraunces",
  axes: ["opsz"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: true,
  variable: "--font-jetbrains-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Wottle — Icelandic word duel",
  description:
    "ORÐUSTA. A two-player Icelandic word duel: swap tiles, find words, race the clock.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen overflow-x-clip bg-surface-0 text-text-primary antialiased">
        <ToastProvider>
          <div className="relative flex min-h-screen flex-col">
            <TopBar />
            <div className="pointer-events-none absolute right-4 top-4 z-30">
              <div className="pointer-events-auto">
                <GearMenu />
              </div>
            </div>
            {children}
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
