"use client";

interface HowItWorksStepProps {
  stepNumber: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}

function HowItWorksStep({
  stepNumber,
  title,
  description,
  icon,
}: HowItWorksStepProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#1A1B2E] text-3xl font-black text-white">
        {stepNumber}
      </div>
      <div className="mb-4 flex h-24 w-24 items-center justify-center">
        {icon}
      </div>
      <h3 className="mb-2 text-xl font-bold text-[#1E1E1E]">{title}</h3>
      <p className="text-base text-[#1E1E1E]/70">{description}</p>
    </div>
  );
}

export function HowItWorksSection() {
  const steps = [
    {
      stepNumber: 1,
      title: "Enter property address",
      description: "Input the address you want to decode",
      icon: (
        <svg
          className="h-16 w-16 text-[#1A1B2E]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      stepNumber: 2,
      title: "Our AI analyzes",
      description: "We decode the listing and check the facts",
      icon: (
        <div className="relative">
          <div className="h-16 w-16 rounded-full bg-[#1A1B2E]/10 flex items-center justify-center">
            <span className="text-4xl">🎩</span>
          </div>
        </div>
      ),
    },
    {
      stepNumber: 3,
      title: "Get the truth",
      description: "Receive a brutally honest report",
      icon: (
        <div className="relative">
          <div className="h-16 w-16 rounded-full bg-[#FF3366]/10 flex items-center justify-center">
            <span className="text-3xl font-black text-[#FF3366]">✓</span>
          </div>
        </div>
      ),
    },
  ];

  return (
    <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20 lg:px-8">
      <h2 className="mb-12 text-center text-4xl font-black text-[#1E1E1E] md:text-5xl">
        HOW IT WORKS
      </h2>
      <div className="grid gap-12 md:grid-cols-3">
        {steps.map((step) => (
          <HowItWorksStep key={step.stepNumber} {...step} />
        ))}
      </div>
    </section>
  );
}

