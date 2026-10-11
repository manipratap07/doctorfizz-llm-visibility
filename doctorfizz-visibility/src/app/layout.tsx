import type { Metadata } from "next";
import { Manrope, Fira_Code } from "next/font/google";
import "./globals.css";
import "./reference.css";
const sans = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--df-font-sans",
});
const mono = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--df-font-mono",
});
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  icons: { icon: "/brand/doctorfizz-black.png" },
  title: "LLM Visibility Checker | DoctorFizz",
  description:
    "See whether AI providers mention your brand, recommend competitors or cite your website. Five free checks with the answer behind every result.",
  openGraph: {
    title: "Where does your brand appear in AI answers?",
    description: "Check the answer. Read the evidence.",
    images: ["/opengraph-image"],
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
