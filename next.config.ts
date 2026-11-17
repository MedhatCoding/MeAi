import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@napi-rs/canvas", "tesseract.js"],
  outputFileTracingIncludes: {
    "/api/files/extract": ["./node_modules/tesseract.js-core/**/*"],
  },
};
export default nextConfig;
