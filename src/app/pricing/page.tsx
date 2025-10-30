"use client";

import { Header } from "@/components/Header";
import { PricingTable } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";

export default function PricingPage() {
  const { user } = useUser();

  return (
    <div className="min-h-screen bg-[#FFF8F0]">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-16 md:px-6 lg:px-8">
        <h1 className="mb-8 text-center text-4xl font-black text-[#1E1E1E] md:text-5xl">
          Pricing
        </h1>
        <p className="mb-12 text-center text-lg text-[#1E1E1E]/70">
          Choose the plan that works for you
        </p>
        <div className="flex justify-center">
          <PricingTable />
        </div>
      </main>
    </div>
  );
}

