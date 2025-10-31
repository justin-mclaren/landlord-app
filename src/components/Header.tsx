"use client";

import Link from "next/link";
import { useUser, SignUpButton, UserButton } from "@clerk/nextjs";

export function Header() {
  const { isSignedIn, isLoaded } = useUser();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#1A1B2E]/10 bg-[#FFF8F0]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <img
              src="/landlord-bust.svg"
              alt="Landlord Lies mascot"
              className="h-8 w-8 flex-shrink-0 scale-x-[-1]"
            />
            <span className="font-title text-xl font-black tracking-tight">
              <span className="text-[#1A1B2E]">LANDLORD</span>{" "}
              <span className="text-[#DC2626]">LIES</span>
            </span>
          </div>
        </Link>

        {/* Mobile: Single CTA Button */}
        <Link
          href="/#decode"
          className="rounded-full bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#DC2626]/90 md:hidden"
        >
          Decode & Listing
        </Link>

        {/* Tablet/Desktop: Navigation Links */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link
            href="/#how-it-works"
            className="text-sm font-medium text-[#1E1E1E] transition-colors hover:text-[#DC2626]"
          >
            How It Works
          </Link>
          <Link
            href="/leaderboard"
            className="text-sm font-medium text-[#1E1E1E] transition-colors hover:text-[#DC2626]"
          >
            Leaderboard
          </Link>
          <Link
            href="/pricing"
            className="text-sm font-medium text-[#1E1E1E] transition-colors hover:text-[#DC2626]"
          >
            Pricing
          </Link>
          {!isLoaded ? (
            // Loading state - show nothing or a placeholder
            <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />
          ) : !isSignedIn ? (
            <SignUpButton
              mode="modal"
              fallbackRedirectUrl="/"
              forceRedirectUrl="/"
              appearance={{
                elements: {
                  headerTitle: "text-2xl font-bold text-[#1E1E1E]",
                  headerSubtitle: "text-sm text-[#1E1E1E]/70 mt-2",
                },
              }}
            >
              <button className="rounded-full bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#DC2626]/90">
                Sign up
              </button>
            </SignUpButton>
          ) : (
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8",
                },
              }}
            />
          )}
        </nav>
      </div>
    </header>
  );
}

