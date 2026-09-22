import type { Metadata } from "next";
import { Red_Hat_Mono, Zilla_Slab } from "next/font/google";
import "../globals.css";
import "../styles/room.css";

import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { getCopy } from "@/lib/i18n/getCopy";
import { getLocale, LOCALE_IDS } from "@/lib/i18n/locales";
import { readLocaleParam, type LocaleParams } from "@/lib/i18n/params";

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

export const dynamicParams = false;

export function generateStaticParams(): Array<{ locale: string }> {
  return LOCALE_IDS.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const locale = await readLocaleParam(params);
  return { title: getLocale(locale).wordmark, description: getCopy(locale).SITE_DESCRIPTION };
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: LocaleParams;
}>) {
  const locale = await readLocaleParam(params);
  return (
    <html lang={getLocale(locale).htmlLang} className={`${zillaSlab.variable} ${redHatMono.variable}`}>
      <body className="min-h-screen overflow-x-clip bg-paper text-ink antialiased">
        <LocaleProvider locale={locale}>
          <div className="relative flex min-h-screen flex-col">{children}</div>
        </LocaleProvider>
      </body>
    </html>
  );
}
