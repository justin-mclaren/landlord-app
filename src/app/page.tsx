import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { HeroSection } from "@/components/HeroSection";
import { SampleDecodesSection } from "@/components/SampleDecodesSection";
import { HowItWorksSection } from "@/components/HowItWorksSection";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#FFF8F0] flex flex-col">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <SampleDecodesSection />
        <HowItWorksSection />
      </main>
      <Footer />
    </div>
  );
}
