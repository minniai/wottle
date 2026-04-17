import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import "./globals.css";
import "./styles/board.css";
import "./styles/lobby.css";
import { GearMenu } from "@/components/ui/GearMenu";
import { ToastProvider } from "@/components/ui/ToastProvider";

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: true,
  variable: "--font-fraunces",
  axes: ["opsz"],
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
    <html lang="en" className={fraunces.variable}>
      <body className="min-h-screen overflow-x-clip bg-surface-0 text-text-primary antialiased">
        <ToastProvider>
          <div className="relative flex min-h-screen flex-col">
            <div className="pointer-events-none absolute right-4 top-4 z-20">
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
