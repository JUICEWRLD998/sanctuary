import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

// Warm Vault type system (design-system/MASTER.md):
// Space Grotesk = display, Inter = body/UI, JetBrains Mono = on-chain data.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const SITE_TITLE = "Sanctuary — Bitcoin-secured savings circles";
const SITE_DESCRIPTION =
  "The oldest way to save, reimagined as programmable, Bitcoin-secured money. A rotating savings circle (susu / tanda) running live on Stacks with auditable on-chain proof.";

// Absolute base for OG/Twitter image URLs. Vercel exposes the deployment host as
// VERCEL_URL (no protocol); fall back to localhost for local dev. Override with
// NEXT_PUBLIC_SITE_URL to pin a custom production domain.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    type: "website",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: "Sanctuary",
    images: [
      {
        url: "/sanctuary-og.png",
        width: 1424,
        height: 752,
        alt: "Sanctuary — Bitcoin-secured savings circles",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/sanctuary-og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Sanctuary",
    "description": SITE_DESCRIPTION,
    "url": siteUrl,
    "applicationCategory": "FinanceApplication",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  };

  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetBrainsMono.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className="min-h-dvh bg-bg text-fg antialiased">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
