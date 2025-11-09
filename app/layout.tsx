import type { Metadata } from "next";
import "./globals.css";
import "./styles/board.css";

export const metadata: Metadata = {
  title: "Wottle Board",
  description: "MVP board scaffold with Supabase-backed swaps",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <main className="flex min-h-screen flex-col">
          <header className="border-b border-white/10 px-6 py-4">
            <h1 className="text-xl font-semibold">Wottle MVP Board Scaffold</h1>
            <p className="text-sm text-white/60">
              Foundation for Supabase-powered grid and swap workflows
            </p>
          </header>
          <div className="flex flex-1 flex-col px-6 py-8">{children}</div>
        </main>
      </body>
    </html>
  );
}
