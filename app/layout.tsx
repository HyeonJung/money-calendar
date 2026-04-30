import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { CalendarDays, Home, LineChart } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "공모주 캘린더",
  description: "한국 공모주 청약, 환불, 상장 일정을 한눈에 확인하세요.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicons/favicon.svg", type: "image/svg+xml" },
      { url: "/favicons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicons/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicons/favicon-64.png", sizes: "64x64", type: "image/png" },
      { url: "/favicons/favicon-128.png", sizes: "128x128", type: "image/png" },
      { url: "/favicons/favicon-256.png", sizes: "256x256", type: "image/png" },
    ],
    apple: [{ url: "/favicons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var theme=localStorage.getItem('theme');document.documentElement.classList.toggle('dark',theme!=='light')}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full bg-stone-50 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-100">
        <div className="min-h-dvh">
          <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
              <Link href="/" className="flex items-center gap-2 font-semibold dark:text-white">
                <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
                  <LineChart size={18} aria-hidden="true" />
                </span>
                <span className="text-base">공모주 캘린더</span>
              </Link>
              <div className="flex items-center gap-2">
                <nav className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1 text-sm font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                  <Link
                    href="/"
                    className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 hover:bg-white hover:text-neutral-950 dark:hover:bg-neutral-800 dark:hover:text-white"
                  >
                    <Home size={16} aria-hidden="true" />
                    홈
                  </Link>
                  <Link
                    href="/calendar"
                    className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 hover:bg-white hover:text-neutral-950 dark:hover:bg-neutral-800 dark:hover:text-white"
                  >
                    <CalendarDays size={16} aria-hidden="true" />
                    캘린더
                  </Link>
                </nav>
                <ThemeToggle />
              </div>
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
