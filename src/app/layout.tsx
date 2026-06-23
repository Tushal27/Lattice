import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { CommandPalette } from "@/components/CommandPalette";
import { Toaster } from "@/components/Toast";
import { ServiceWorker } from "@/components/ServiceWorker";
import { FloatingChat } from "@/components/FloatingChat";
import { Guide } from "@/components/Guide";
import { Onboarding } from "@/components/Onboarding";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lattice — your personal operating system",
  description:
    "Capture decisions, lessons, aha moments, questions, and projects. Reflect, connect, and let your knowledge compound over years.",
  applicationName: "Lattice",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lattice",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <MobileNav />
            <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-28 pt-6 md:px-10 md:py-8">{children}</main>
          </div>
        </div>
        <CommandPalette />
        <FloatingChat />
        <Guide />
        <Onboarding />
        <Toaster />
        <ServiceWorker />
      </body>
    </html>
  );
}
