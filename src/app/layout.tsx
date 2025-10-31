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
    <ClerkProvider
      appearance={{
        elements: {
          rootBox: "mx-auto",
          card: "shadow-lg",
          headerTitle: "text-2xl font-bold text-[#1E1E1E]",
          headerSubtitle: "text-sm text-[#1E1E1E]/70 mt-2",
          socialButtonsBlockButton:
            "border border-[#1E1E1E]/20 hover:bg-gray-50",
          formButtonPrimary: "bg-[#DC2626] hover:bg-[#DC2626]/90 text-white",
          formFieldLabel: "text-[#1E1E1E] font-medium",
          formFieldInput: "border-[#1E1E1E]/20 focus:border-[#DC2626]",
          footerActionLink: "text-[#DC2626] hover:text-[#DC2626]/80",
          identityPreviewEditButton: "text-[#DC2626]",
          identityPreviewText: "text-[#1E1E1E]",
          formResendCodeLink: "text-[#DC2626]",
        },
        layout: {
          socialButtonsPlacement: "top",
          socialButtonsVariant: "blockButton",
        },
      }}
      localization={{
        locale: "en-US",
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Sign up to decode your first rental listing for free",
          },
        },
      }}
    >
      <html lang="en">
        <body
          className={`${inter.variable} ${satoshiBlack.variable} antialiased`}
        >
          {googleMapsApiKey && (
            <Script
              src={`https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places`}
              strategy="afterInteractive"
            />
          )}
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
