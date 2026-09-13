import { useEffect, useRef } from "react";
import { gsap } from "gsap";

interface InfiniteMarqueeProps {
  items: string[];
  speed?: number;
  reverse?: boolean;
}

export const InfiniteMarquee = ({ items, speed = 30, reverse = false }: InfiniteMarqueeProps) => {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const half = track.scrollWidth / 2;
    const tween = gsap.to(track, {
      x: reverse ? half : -half,
      duration: speed,
      ease: "none",
      repeat: -1,
      modifiers: { x: gsap.utils.unitize((x) => parseFloat(x) % half) },
    });
    return () => {
      tween.kill();
    };
  }, [speed, reverse, items.length]);

  const loop = [...items, ...items];

  return (
    <div 
      className="relative w-full overflow-hidden py-3 select-none"
      style={{
        maskImage:
          "linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.02) 4%, rgba(0, 0, 0, 0.08) 10%, rgba(0, 0, 0, 0.22) 18%, rgba(0, 0, 0, 0.5) 26%, rgba(0, 0, 0, 0.85) 34%, black 40%, black 60%, rgba(0, 0, 0, 0.85) 66%, rgba(0, 0, 0, 0.5) 74%, rgba(0, 0, 0, 0.22) 82%, rgba(0, 0, 0, 0.08) 90%, rgba(0, 0, 0, 0.02) 96%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.02) 4%, rgba(0, 0, 0, 0.08) 10%, rgba(0, 0, 0, 0.22) 18%, rgba(0, 0, 0, 0.5) 26%, rgba(0, 0, 0, 0.85) 34%, black 40%, black 60%, rgba(0, 0, 0, 0.85) 66%, rgba(0, 0, 0, 0.5) 74%, rgba(0, 0, 0, 0.22) 82%, rgba(0, 0, 0, 0.08) 90%, rgba(0, 0, 0, 0.02) 96%, transparent 100%)"
      }}
    >
      <div ref={trackRef} className="flex gap-12 whitespace-nowrap will-change-transform">
        {loop.map((item, i) => (
          <div key={i} className="flex items-center gap-12 text-xl md:text-2xl font-display font-semibold tracking-tight">
            <span className="text-gradient bg-aurora bg-clip-text">{item}</span>
            <span className="text-muted-foreground/40">✦</span>
          </div>
        ))}
      </div>
    </div>
  );
};
