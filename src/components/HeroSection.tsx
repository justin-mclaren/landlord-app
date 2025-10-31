"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useUser, SignUpButton } from "@clerk/nextjs";
import { GooglePlacesAutocomplete } from "./GooglePlacesAutocomplete";

export function HeroSection() {
  const { isSignedIn, isLoaded: userLoaded } = useUser();
  const signUpButtonRef = useRef<HTMLButtonElement>(null);
  const [address, setAddress] = useState("");
  const [workAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDecode, setPendingDecode] = useState<{
    address: string;
    workAddress: string;
  } | null>(null);

  const performDecode = useCallback(async (addr: string, workAddr: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/decode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: addr || undefined,
          prefs: {
            workAddress: workAddr || undefined,
          },
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to decode listing";
        let errorCode: string | undefined;

        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          errorCode = errorData.code;

          // Provide more specific error messages based on error code
          if (errorCode === "VALIDATION_ERROR") {
            errorMessage =
              errorData.error || "Please check your input and try again.";
          } else if (errorCode === "NOT_FOUND") {
            errorMessage =
              errorData.error ||
              "We couldn't find that property. Please check the address.";
          } else if (errorCode === "DATA_QUALITY_ERROR") {
            errorMessage =
              errorData.error ||
              "The property data is incomplete. We couldn't generate a full report.";
          } else if (errorCode === "RATE_LIMIT_ERROR") {
            errorMessage =
              errorData.error ||
              "Too many requests. Please wait a moment and try again.";
          } else if (errorCode === "API_ERROR") {
            errorMessage =
              errorData.error ||
              "We're having trouble fetching data. Please try again.";
          } else if (errorCode === "NETWORK_ERROR") {
            errorMessage =
              errorData.error ||
              "Network connection failed. Please check your connection.";
          } else if (errorCode === "TIMEOUT_ERROR") {
            errorMessage =
              errorData.error || "The request took too long. Please try again.";
          } else if (errorCode === "subscription_required") {
            errorMessage =
              errorData.error ||
              "Please subscribe to continue decoding listings.";
          }
        } catch {
          // If JSON parsing fails, use status-based messages
          if (response.status === 400) {
            errorMessage =
              "Invalid input. Please check your address and try again.";
          } else if (response.status === 404) {
            errorMessage = "Property not found. Please check the address.";
          } else if (response.status === 429) {
            errorMessage =
              "Too many requests. Please wait a moment and try again.";
          } else if (response.status >= 500) {
            errorMessage = "Server error. Please try again later.";
          }
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Redirect to report page
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No report URL returned from server");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again."
      );
      setLoading(false);
    }
  }, []);

  // Retry decode after successful sign-up
  useEffect(() => {
    if (isSignedIn && pendingDecode && userLoaded) {
      // User just signed up, retry the decode
      performDecode(pendingDecode.address, pendingDecode.workAddress);
      setPendingDecode(null);
    }
  }, [isSignedIn, pendingDecode, userLoaded, performDecode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate address is entered
    if (!address.trim()) {
      setError("Please enter a property address");
      return;
    }

    // Wait for user to load
    if (!userLoaded) {
      setError("Loading...");
      return;
    }

    // If not signed in, show sign-up modal and store the decode request
    if (!isSignedIn) {
      setPendingDecode({ address, workAddress });
      // Trigger Clerk's sign-up modal
      signUpButtonRef.current?.click();
      return;
    }

    // User is signed in, proceed with decode
    await performDecode(address, workAddress);
  };

  return (
    <section
      id="decode"
      className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16 lg:px-8 lg:py-20"
    >
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Left Column: Text Content */}
        <div className="flex flex-col justify-center">
          <div className="mb-4">
            <p className="text-4xl font-black leading-tight text-[#1E1E1E] md:text-5xl lg:text-6xl">
              They said <span className="italic">&apos;Cozy.&apos;</span>
            </p>
            <p className="text-4xl font-black leading-tight text-[#DC2626] md:text-5xl lg:text-6xl">
              We heard <span className="italic">&apos;Cramped.&apos;</span>
            </p>
          </div>
          <p className="mb-8 text-lg leading-relaxed text-[#1E1E1E] md:text-xl">
            Enter any property address – our AI exposes the truth behind
            landlord lingo.
          </p>

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="mb-6 space-y-4">
            <GooglePlacesAutocomplete
              value={address}
              onChange={setAddress}
              placeholder="Enter property address"
              disabled={loading}
              className="w-full rounded-2xl border-2 border-[#1E1E1E]/20 bg-white px-6 py-4 pl-12 pr-12 text-base text-[#1E1E1E] placeholder-[#1E1E1E]/50 focus:border-[#DC2626] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20"
            />

            {error && (
              <div className="rounded-xl border-2 border-[#DC2626]/30 bg-[#DC2626]/10 p-4 text-sm text-[#DC2626]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !address}
              className="w-full rounded-2xl bg-[#DC2626] px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-[#DC2626]/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Decoding..." : "Decode this listing"}
            </button>
          </form>

          <Link
            href="#sample-decodes"
            className="text-sm font-medium text-[#1E1E1E] underline-offset-4 hover:text-[#DC2626] hover:underline"
          >
            See sample decodes
          </Link>
        </div>

        {/* Hidden SignUpButton to trigger modal programmatically */}
        <div className="hidden">
          <SignUpButton
            mode="modal"
            fallbackRedirectUrl="/"
            forceRedirectUrl="/"
          >
            <button ref={signUpButtonRef} type="button" />
          </SignUpButton>
        </div>

        {/* Right Column: Mascot Illustration */}
        <div className="relative flex items-center justify-center lg:justify-end">
          <div className="relative">
            <img
              src="/landlord-full.svg"
              alt="Landlord Lies mascot"
              className="h-80 w-auto md:h-96 lg:h-[32rem] scale-x-[-1]"
            />
            {/* Speech bubble */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-2xl bg-white px-4 py-2 shadow-lg md:-top-12">
              <p className="text-sm font-semibold text-[#1E1E1E] md:text-base">
                Urban Oasis
              </p>
              <p className="text-xs text-[#1E1E1E]/70 md:text-sm">
                Basement Apartment.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
