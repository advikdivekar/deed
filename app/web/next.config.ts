import type { NextConfig } from "next";

const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // When the Python API is running, /api/* is proxied to it; otherwise the UI falls back to its in-browser demo reader.
  async rewrites() {
    return process.env.NEXT_PUBLIC_BACKEND === "1" ? [{ source: "/api/:path*", destination: `${backend}/api/:path*` }] : [];
  },
};

export default nextConfig;
