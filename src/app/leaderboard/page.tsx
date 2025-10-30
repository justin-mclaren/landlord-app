import { Header } from "@/components/Header";

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-[#FFF8F0]">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-16 md:px-6 lg:px-8">
        <h1 className="mb-8 text-4xl font-black text-[#1E1E1E] md:text-5xl">
          Leaderboard
        </h1>
        <p className="text-lg text-[#1E1E1E]/70">
          Coming soon. Check back later to see the most decoded properties and
          honest landlords.
        </p>
      </main>
    </div>
  );
}

