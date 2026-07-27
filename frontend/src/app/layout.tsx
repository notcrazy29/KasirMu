import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import StateInitializer from "../components/shared/StateInitializer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KasirMu - SmartPOS QRIS & Realtime Dashboard",
  description: "Solusi kasir modern berbasis cloud untuk UMKM, Toko, Cafe, dan Laundry dengan integrasi QRIS dan dashboard owner realtime.",
  keywords: "POS, Point of Sale, Kasir Online, QRIS, Midtrans, Realtime Dashboard, Aplikasi Kasir, UMKM, KasirMu",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('kasirmu_theme');
                if (t === 'dark' || !t) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <StateInitializer />
        {children}
      </body>
    </html>
  );
}
