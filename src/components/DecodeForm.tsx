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
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to decode listing");
      }

      const data = await response.json();
      
      // Redirect to report page
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
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

