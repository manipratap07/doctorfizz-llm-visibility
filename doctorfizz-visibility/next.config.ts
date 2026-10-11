export default {
  output: "standalone",
  devIndicators: false,
  serverExternalPackages: [
    "bullmq",
    "ioredis",
    "pg",
    "pino",
    "@playwright/test",
  ],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
