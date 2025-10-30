import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Satoshi Black for headlines
// TODO: Add Satoshi-Black.woff2 to src/fonts/ directory
// For now, using Inter Bold as fallback until Satoshi font is added
const satoshiBlack = {
  variable: "--font-satoshi-black",
};

export const metadata: Metadata = {
  title: "Landlord Lies - Decode Rental Listings",
  description:
    "Paste any rental listing – our AI exposes the truth behind landlord lingo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${satoshiBlack.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
