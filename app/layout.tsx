import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppHeader } from "@/components/app-header";
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
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://korea-ipo-calendar.vercel.app",
  ),
  title: "머니캘린더",
  description: "공모주 청약, 환불, 상장 일정과 돈 되는 일정을 한눈에 확인하세요.",
  openGraph: {
    title: "머니캘린더",
    description: "공모주 청약, 환불, 상장 일정과 돈 되는 일정을 한눈에 확인하세요.",
    url: "/",
    siteName: "머니캘린더",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/meta-image.png",
        width: 1731,
        height: 909,
        alt: "머니캘린더",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "머니캘린더",
    description: "공모주 청약, 환불, 상장 일정과 돈 되는 일정을 한눈에 확인하세요.",
    images: ["/meta-image.png"],
  },
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var theme=localStorage.getItem('theme');document.documentElement.classList.toggle('dark',theme==='dark')}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full bg-stone-50 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-100">
        <div className="min-h-dvh">
          <AppHeader />
          {children}
        </div>
      </body>
    </html>
  );
}
