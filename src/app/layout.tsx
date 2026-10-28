import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { TRPCProvider } from "@/lib/trpc/Provider";
import { ThemeProvider } from "next-themes";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

import { PwaRegister } from "@/components/pwa/PwaRegister";

export const metadata: Metadata = {
  title: "Fin.IQ: Manajemen Keuangan Personal",
  description:
    "Aplikasi manajemen keuangan personal modern dengan multi-device sync, pelacak pengeluaran, anggaran, dan integrasi AI.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192" },
      { url: "/icon-512.png", sizes: "512x512" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Fin.IQ",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={plusJakartaSans.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  function cleanElement(el) {
                    if (!el || el.nodeType !== 1) return;
                    var attrs = el.attributes;
                    if (!attrs) return;
                    for (var i = attrs.length - 1; i >= 0; i--) {
                      var name = attrs[i].name;
                      if (
                        name.indexOf('bis_') === 0 ||
                        name.indexOf('data-bis-') === 0 ||
                        name === 'cz-shortcut-listen'
                      ) {
                        el.removeAttribute(name);
                      }
                    }
                  }

                  if (typeof MutationObserver !== 'undefined') {
                    var observer = new MutationObserver(function(mutations) {
                      for (var i = 0; i < mutations.length; i++) {
                        var m = mutations[i];
                        if (m.type === 'attributes') {
                          var name = m.attributeName;
                          if (
                            name &&
                            (name.indexOf('bis_') === 0 ||
                             name.indexOf('data-bis-') === 0 ||
                             name === 'cz-shortcut-listen') &&
                            m.target.hasAttribute(name)
                          ) {
                            m.target.removeAttribute(name);
                          }
                        } else if (m.type === 'childList') {
                          for (var j = 0; j < m.addedNodes.length; j++) {
                            var n = m.addedNodes[j];
                            if (n.nodeType === 1) {
                              cleanElement(n);
                              if (n.firstElementChild) {
                                var children = n.querySelectorAll('*');
                                for (var k = 0; k < children.length; k++) {
                                  cleanElement(children[k]);
                                }
                              }
                            }
                          }
                        }
                      }
                    });

                    observer.observe(document.documentElement, {
                      attributes: true,
                      childList: true,
                      subtree: true,
                    });
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased selection:bg-emerald-500/20 selection:text-emerald-900 dark:selection:text-emerald-200" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <PwaRegister />
          <TRPCProvider>{children}</TRPCProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

