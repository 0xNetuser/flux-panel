import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/lib/i18n";
import { SiteConfigProvider } from "@/lib/site-config";
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
  title: "Panel",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Patch history API to prevent Next.js router from corrupting URLs to localhost */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var R=history.replaceState.bind(history),P=history.pushState.bind(history);function f(u){if(!u)return u;var s=typeof u==='string'?u:u instanceof URL?u.href:String(u);if(/^https?:\\/\\/localhost(:\\d+)?/.test(s)){s=s.replace(/^https?:\\/\\/localhost(:\\d+)?/,'');}return s||'/';}history.replaceState=function(a,b,u){return R(a,b,f(u));};history.pushState=function(a,b,u){return P(a,b,f(u));};})();` }} />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <LanguageProvider>
            <SiteConfigProvider>
              <TooltipProvider>
                {children}
              </TooltipProvider>
              <Toaster richColors position="top-center" />
            </SiteConfigProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
