import { Hero } from "@/components/sections/Hero";
import { Features } from "@/components/sections/Features";
import { Faqs } from "@/components/sections/Faqs";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { StatsMarquee } from "@/components/sections/StatsMarquee";
import { DiscordSimulator } from "@/components/sections/DiscordSimulator";
import { siteConfig } from "@/config/site";
import { useEffect } from "react";

const Index = () => {
  useEffect(() => {
    document.title = `${siteConfig.bot.name} — ${siteConfig.bot.tagline}`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", siteConfig.bot.description);
  }, []);

  return (
    <>
      <Hero />
      <StatsMarquee />
      <DiscordSimulator />
      <Features />
      <Faqs />
      <CtaBanner />
    </>
  );
};

export default Index;
