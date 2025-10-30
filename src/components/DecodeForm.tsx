"use client";

import { useState } from "react";

export function DecodeForm() {
  const [address, setAddress] = useState("");
  const [workAddress, setWorkAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/decode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: address || undefined,
          prefs: {
            workAddress: workAddress || undefined,
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
            errorMessage = errorData.error || "Please check your input and try again.";
          } else if (errorCode === "NOT_FOUND") {
            errorMessage = errorData.error || "We couldn't find that property. Please check the address.";
          } else if (errorCode === "DATA_QUALITY_ERROR") {
            errorMessage = errorData.error || "The property data is incomplete. We couldn't generate a full report.";
          } else if (errorCode === "RATE_LIMIT_ERROR") {
            errorMessage = errorData.error || "Too many requests. Please wait a moment and try again.";
          } else if (errorCode === "API_ERROR") {
            errorMessage = errorData.error || "We're having trouble fetching data. Please try again.";
          } else if (errorCode === "NETWORK_ERROR") {
            errorMessage = errorData.error || "Network connection failed. Please check your connection.";
          } else if (errorCode === "TIMEOUT_ERROR") {
            errorMessage = errorData.error || "The request took too long. Please try again.";
          }
        } catch {
          // If JSON parsing fails, use status-based messages
          if (response.status === 400) {
            errorMessage = "Invalid input. Please check your address and try again.";
          } else if (response.status === 404) {
            errorMessage = "Property not found. Please check the address.";
          } else if (response.status === 429) {
            errorMessage = "Too many requests. Please wait a moment and try again.";
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
      setError(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-8 text-center">
        <h1 className="mb-4 text-4xl font-bold text-black dark:text-white">
          Landlord Decoder
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Decode rental listings. Get the real story.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Address Input */}
        <div>
          <label
            htmlFor="address"
            className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Address
          </label>
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main St, City, ST 12345"
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-black placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-600"
            disabled={loading}
            required
          />
        </div>

        {/* Work Address (Optional) */}
        <div>
          <label
            htmlFor="workAddress"
            className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Work Address (Optional - for commute analysis)
          </label>
          <input
            id="workAddress"
            type="text"
            value={workAddress}
            onChange={(e) => setWorkAddress(e.target.value)}
            placeholder="123 Work St, City, ST"
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-black placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-600"
            disabled={loading}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !address}
          className="w-full rounded-lg bg-black px-6 py-3 font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {loading ? "Decoding..." : "Decode Listing"}
        </button>
      </form>
    </div>
  );
}

