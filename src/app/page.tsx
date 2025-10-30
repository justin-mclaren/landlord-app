import { DecodeForm } from "@/components/DecodeForm";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-4 py-16 sm:px-8">
        <DecodeForm />
      </main>
    </div>
  );
}
