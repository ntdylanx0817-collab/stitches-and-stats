import type { Metadata } from "next";
import { Geist, Geist_Mono, Oswald } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers";
import { ErrorBoundary } from "@/components/error-boundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Oswald: bold, condensed, athletic "scoreboard" font for all headers
const oswald = Oswald({
  variable: "--font-scoreboard",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Stitches and Stats — Real-Time Statcast Baseball Analytics",
  description: "An immersive, real-time MLB Statcast analytics platform with live pitch tracking, player percentile rankings, and advanced sabermetric leaderboards.",
  keywords: ["MLB", "Statcast", "Sabermetrics", "Baseball Savant", "Pitch Tracking", "Exit Velocity", "xBA"],
  authors: [{ name: "Stitches and Stats" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${oswald.variable} antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <ErrorBoundary>
          <Providers>
            {children}
          </Providers>
        </ErrorBoundary>
        <Toaster />
      </body>
    </html>
  );
}
