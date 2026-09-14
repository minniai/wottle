import type { Metadata } from "next";
import { Red_Hat_Mono, Zilla_Slab } from "next/font/google";
import "./globals.css";
import "./styles/room.css";
import "./styles/board.css";
import "./styles/profile.css";

const zillaSlab = Zilla_Slab({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  display: "swap",
  preload: true,
  variable: "--font-zilla-slab",
});

const redHatMono = Red_Hat_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
  preload: true,
  variable: "--font-red-hat-mono",
});

export const metadata: Metadata = {
  title: "wottle",
  description:
    "A two-player Icelandic word duel. Swap two letters; words of three or more score and freeze in your ink.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${zillaSlab.variable} ${redHatMono.variable}`}>
      <body className="min-h-screen overflow-x-clip bg-paper text-ink antialiased">
        <div className="relative flex min-h-screen flex-col">{children}</div>
      </body>
    </html>
  );
}
