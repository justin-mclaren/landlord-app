"use client";

import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#1A1B2E]/10 bg-[#FFF8F0]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            {/* Placeholder for mascot icon - replace with actual asset */}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1B2E]/20">
              <span className="text-xs">🎩</span>
            </div>
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
          <Link
            href="/sign-in"
            className="text-sm font-medium text-[#1E1E1E] transition-colors hover:text-[#DC2626]"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}

