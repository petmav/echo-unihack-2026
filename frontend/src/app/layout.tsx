import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";

import { DarkModeToggle } from "@/components/echo/DarkModeToggle";
import { ErrorBoundary } from "@/components/echo/ErrorBoundary";
import { ThemeProvider } from "@/lib/theme";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Echo",
  description:
    "Echo finds others who have felt exactly what you're feeling right now — anonymously, privately, without judgement.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF7F2" },
    { media: "(prefers-color-scheme: dark)", color: "#1A1816" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${fraunces.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          document.addEventListener('gesturestart', function(e) { e.preventDefault(); }, {passive: false});
          document.addEventListener('gesturechange', function(e) { e.preventDefault(); }, {passive: false});
          document.addEventListener('gestureend', function(e) { e.preventDefault(); }, {passive: false});
          document.addEventListener('touchstart', function(e) { if (e.touches.length > 1) e.preventDefault(); }, {passive: false});
          document.addEventListener('wheel', function(e) { if (e.ctrlKey) e.preventDefault(); }, {passive: false});
        `}} />
      </head>
      <body><ThemeProvider><ErrorBoundary>{children}</ErrorBoundary><DarkModeToggle /></ThemeProvider></body>
    </html>
  );
}
