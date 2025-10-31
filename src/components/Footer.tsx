"use client";

export function Footer() {
  return (
    <footer className="border-t border-[#1E1E1E]/10 bg-[#FFF8F0] py-8">
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 text-sm text-[#1E1E1E]/60 md:flex-row">
          <div>
            <p>Landlord Lies—exposing the truth behind every &apos;charming studio.&apos;</p>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span>Powered by</span>
            <a
              href="https://maps.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#1E1E1E] hover:text-[#DC2626] transition-colors"
            >
              Google Maps
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

