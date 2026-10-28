import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "./service-worker-register";

export const metadata: Metadata = {
  title: "Medhat AI — مساعدك الذكي",
  description: "مساحة عمل ذكية للمحادثة والوكيل والملفات والصور والفيديو والذاكرة.",
  applicationName: "Medhat AI",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Medhat AI" },
};
export const viewport: Viewport = { themeColor: "#0b0d12", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body><ServiceWorkerRegister />{children}</body></html>;
}
