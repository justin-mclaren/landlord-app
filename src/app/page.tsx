import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { SampleDecodesSection } from "@/components/SampleDecodesSection";
import { HowItWorksSection } from "@/components/HowItWorksSection";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#FFF8F0]">
      <Header />
      <main>
        <HeroSection />
        <SampleDecodesSection />
        <HowItWorksSection />
      </main>
    </div>
  );
}
