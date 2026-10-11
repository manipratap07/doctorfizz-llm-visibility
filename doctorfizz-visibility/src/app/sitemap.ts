import type { MetadataRoute } from "next";
export const dynamic = "force-dynamic";
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL || "http://localhost:3000";
  return ["", "/privacy", "/terms"].map((path) => ({ url: base + path }));
}
