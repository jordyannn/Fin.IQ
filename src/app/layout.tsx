import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TRPCProvider } from "@/lib/trpc/Provider";
import { ThemeProvider } from "next-themes";

export const metadata: Metadata = {
  title: "Fin.IQ — Cloud Financial Management",
  description:
    "Aplikasi manajemen keuangan personal modern dengan multi-device sync, pelacak pengeluaran, anggaran, dan integrasi AI.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#3b82f6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <TRPCProvider>{children}</TRPCProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
