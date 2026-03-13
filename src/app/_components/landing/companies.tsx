import Image from "next/image";

type Logo = {
  src: string;
  alt: string;
  height: number;
  width?: number;
};

type LogoSectionProps = {
  title: string;
  logos: Logo[];
  logoWidth?: number;
  gap?: string;
};

const LogoSection = ({
  title,
  logos,
  logoWidth,
  gap = "gap-6",
}: LogoSectionProps) => {
  return (
    <div>
      <h3 className="mb-6 text-center text-sm font-semibold uppercase tracking-wider text-gray-600 md:text-left">
        {title}
      </h3>
      <div
        className={`flex flex-wrap items-center justify-center md:justify-start ${gap}`}
      >
        {logos.map((logo, index) => (
          <div
            key={index}
            className="flex items-center justify-center grayscale transition-all duration-300 hover:grayscale-0"
            style={{
              height: `${logo.height}px`,
              ...(logoWidth && { width: `${logoWidth}px` }),
            }}
          >
            <Image
              src={logo.src}
              alt={logo.alt}
              height={logo.height}
              width={logo.width ?? logoWidth ?? 200}
              className="h-full w-auto object-contain"
              unoptimized
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const Companies = () => {
  const featuredOnLogos: Logo[] = [
    { src: "/media/featured/swa.png", alt: "SWA", height: 50 },
    { src: "/media/featured/techinasia.png", alt: "Tech in Asia", height: 50 },
    { src: "/media/featured/dailysocial.png", alt: "Daily Social", height: 50 },
  ];

  const backedByLogos: Logo[] = [
    { src: "/media/backed/500-startups.png", alt: "500 Startups", height: 50 },
    { src: "/media/backed/investidea.png", alt: "Investidea", height: 50 },
    { src: "/media/backed/mdv.png", alt: "MDV", height: 50 },
    { src: "/media/backed/cento.png", alt: "Cento", height: 50 },
    { src: "/media/backed/ovo.png", alt: "OVO", height: 50 },
    { src: "/media/backed/pintu.png", alt: "Pintu", height: 50 },
    { src: "/media/backed/flip.png", alt: "Flip", height: 50 },
    { src: "/media/backed/goto.png", alt: "GoTo", height: 50 },
  ];

  return (
    <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[2fr_1fr] md:gap-16">
          <LogoSection
            title="Featured on"
            logos={featuredOnLogos}
            gap="gap-8"
          />
          <LogoSection
            title="Backed by investors and founders of"
            logos={backedByLogos}
            logoWidth={100}
            gap="gap-4"
          />
        </div>
      </div>
    </section>
  );
};

export default Companies;
