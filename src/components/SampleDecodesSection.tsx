"use client";

interface SampleDecodeCardProps {
  imageSrc: string;
  lieMeterScore: number;
  theySaid: string;
  weFound: string;
}

function SampleDecodeCard({
  imageSrc,
  lieMeterScore,
  theySaid,
  weFound,
}: SampleDecodeCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border-2 border-[#1E1E1E]/10 bg-white transition-all hover:border-[#FF3366]/30 hover:shadow-lg">
      {/* Image Container */}
      <div className="relative aspect-[4/3] overflow-hidden bg-[#1E1E1E]/5">
        <img
          src={imageSrc}
          alt=""
          className="h-full w-full object-cover"
        />
        {/* Lie Meter Badge */}
        <div className="absolute left-4 top-4 rounded-lg bg-[#FF3366] px-3 py-1.5">
          <span className="text-xs font-bold text-white">
            LIE METER {lieMeterScore}/100
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="mb-3">
          <p className="text-sm font-medium text-[#1E1E1E]/60">They said</p>
          <p className="text-lg font-semibold text-[#1E1E1E]">{theySaid}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-[#1E1E1E]/60">We found</p>
          <p className="text-lg font-semibold text-[#FF3366]">{weFound}</p>
        </div>
      </div>
    </div>
  );
}

export function SampleDecodesSection() {
  // Hardcoded sample data
  const samples: SampleDecodeCardProps[] = [
    {
      imageSrc: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80",
      lieMeterScore: 38,
      theySaid: "Charming studio",
      weFound: "Windowless basement.",
    },
    {
      imageSrc: "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80",
      lieMeterScore: 42,
      theySaid: "Steps to beach",
      weFound: "View to brick wall.",
    },
    {
      imageSrc: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80",
      lieMeterScore: 35,
      theySaid: "Modern amenities",
      weFound: "Next to highway.",
    },
  ];

  return (
    <section id="sample-decodes" className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20 lg:px-8">
      <h2 className="mb-12 text-center text-4xl font-black text-[#1E1E1E] md:text-5xl">
        Example Decodes
      </h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {samples.map((sample, index) => (
          <SampleDecodeCard key={index} {...sample} />
        ))}
      </div>
    </section>
  );
}

