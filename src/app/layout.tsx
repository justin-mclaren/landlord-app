import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Satoshi Black for headlines
const satoshiBlack = localFont({
  src: [
    {
      path: "../fonts/Satoshi-Black.woff2",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-satoshi-black",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
});

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
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${inter.variable} ${satoshiBlack.variable} antialiased`}
        >
          {googleMapsApiKey && (
            <Script
              src={`https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&loading=async&libraries=places`}
              strategy="lazyOnload"
            />
          )}
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
