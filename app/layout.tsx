import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Sanctuary — Bitcoin-secured savings circles",
  description:
    "The oldest way to save, reimagined as programmable, Bitcoin-secured money. A rotating savings circle (susu / tanda) running live on Stacks with auditable on-chain proof.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetBrainsMono.variable}`}
    >
      <body className="min-h-dvh bg-bg text-fg antialiased">{children}</body>
    </html>
  );
}
