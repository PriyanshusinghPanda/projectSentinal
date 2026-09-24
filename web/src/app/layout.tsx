import type { Metadata } from "next";
import localFont from "next/font/local";
import { Instrument_Serif } from "next/font/google";
import "./globals.css";
import type { Viewport } from "next";
import { Providers } from "@/components/Providers";

const geistSans = localFont({ src: "./fonts/GeistVF.woff", variable: "--font-geist-sans", weight: "100 900" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });
const geistMono = localFont({ src: "./fonts/GeistMonoVF.woff", variable: "--font-geist-mono", weight: "100 900" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100"),
  title: { default: "Sentinel — Agentic Fraud Investigation", template: "%s · Sentinel" },
  description: "Seven agents investigate card fraud on a TigerGraph graph, argue with each other, ask for evidence when unsure, and recommend policy-bound actions an analyst approves.",
  applicationName: "Sentinel",
  keywords: ["fraud investigation", "TigerGraph", "GraphRAG", "MCP", "AI agents", "next best action"],
  openGraph: { title: "Sentinel — Agentic Fraud Investigation", description: "Fraud investigations that argue with themselves.", type: "website" },
  twitter: { card: "summary_large_image", title: "Sentinel", description: "Fraud investigations that argue with themselves." },
};

export const viewport: Viewport = { themeColor: "#f7f3ec", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${serif.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
