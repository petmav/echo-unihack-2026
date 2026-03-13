import type { NextConfig } from "next";

// NEXT_OUTPUT controls the build output mode:
//   'export'     → static export for Capacitor APK  (set by build:mobile / CI APK workflow)
//   'standalone' → self-contained server for Docker  (set by the Dockerfile)
//   (unset)      → standard Next.js output for Vercel (Vercel's native integration)
const output = process.env.NEXT_OUTPUT === 'export'
  ? 'export'
  : process.env.NEXT_OUTPUT === 'standalone'
  ? 'standalone'
  : undefined;

const nextConfig: NextConfig = {
  output,
};

export default nextConfig;
