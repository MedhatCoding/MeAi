import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Medhat AI",
    short_name: "Medhat AI",
    description: "مساعد ذكاء اصطناعي شخصي باللغة العربية",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#0b0d12",
    theme_color: "#0b0d12",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
    ],
    categories: ["productivity", "utilities"],
  };
}
