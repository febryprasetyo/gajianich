import type { NextConfig } from "next";

import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  outputFileTracingRoot: path.resolve(__dirname),
  output: "standalone",
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "192.168.10.23",
    "192.168.10.212",
    "192.168.20.53",
    "*.loca.lt",
    "*.trycloudflare.com",
    "*.ngrok-free.app",
    "*.ngrok.io",
  ],
  async rewrites() {
    if (process.env.NODE_ENV !== "development") {
      return [];
    }

    const destinationBase = (
      process.env.INTERNAL_API_URL || "http://127.0.0.1:5000/api/v1"
    ).replace(/\/+$/, "");

    return [
      {
        source: "/api/v1/:path*",
        destination: `${destinationBase}/:path*`,
      },
    ];
  },
};

export default nextConfig;
