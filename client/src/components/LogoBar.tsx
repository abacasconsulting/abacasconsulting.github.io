import { useEffect, useRef } from "react";

const LogoBar = () => {
    const logos = [
        { name: "Department of Defence", src: "/logos/defence.svg" },
        { name: "Department of Home Affairs", src: "/logos/home-affairs.png" },
        { name: "Services Australia", src: "/logos/services-australia.svg" },
        { name: "Department of Agriculture", src: "/logos/agriculture.svg" },
        { name: "Department of Foreign Affairs and Trade", src: "/logos/dfat.svg" },
        { name: "Department of Health", src: "/logos/health.svg" },
        { name: "Department of Education", src: "/logos/education.svg" },
        { name: "Department of Finance", src: "/logos/generic.svg" },
        { name: "Treasury", src: "/logos/treasury.svg" },
        { name: "Attorney-General's Department", src: "/logos/ag.svg" },
        { name: "Department of Infrastructure", src: "/logos/infrastructure.svg" },
        { name: "Department of Industry", src: "/logos/generic.svg" },
        { name: "Department of Social Services", src: "/logos/social-services.svg" },
        { name: "Department of Veterans' Affairs", src: "/logos/generic.svg" },
        { name: "Department of Climate Change", src: "/logos/generic.svg" },
        { name: "Australian Taxation Office", src: "/logos/ato.svg" },
        { name: "Australian Bureau of Statistics", src: "/logos/generic.svg" },
        { name: "CSIRO", src: "/logos/csiro.svg" },
        { name: "Australian Federal Police", src: "/logos/generic.svg" },
        { name: "Australian Border Force", src: "/logos/generic.svg" },
    ];

    return (
        <div className="w-full bg-white/50 backdrop-blur-sm py-8 overflow-hidden">
            <div className="container mx-auto px-6 mb-6">
                <p className="text-center text-sm font-medium text-muted-foreground uppercase tracking-widest">
                    Trusted by Government Agencies
                </p>
            </div>

            <div className="relative flex overflow-x-hidden group">
                <div className="animate-marquee flex whitespace-nowrap gap-12 px-6">
                    {logos.map((logo, index) => (
                        <div key={index} className="flex items-center justify-center min-w-[200px] h-20 grayscale hover:grayscale-0 transition-all duration-300 opacity-70 hover:opacity-100">
                            <img
                                src={logo.src}
                                alt={logo.name}
                                className="max-h-16 w-auto object-contain"
                                onError={(e) => {
                                    // Fallback if image fails
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                        </div>
                    ))}
                </div>

                <div className="absolute top-0 animate-marquee2 flex whitespace-nowrap gap-12 px-6">
                    {logos.map((logo, index) => (
                        <div key={`clone-${index}`} className="flex items-center justify-center min-w-[200px] h-20 grayscale hover:grayscale-0 transition-all duration-300 opacity-70 hover:opacity-100">
                            <img
                                src={logo.src}
                                alt={logo.name}
                                className="max-h-16 w-auto object-contain"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LogoBar;
