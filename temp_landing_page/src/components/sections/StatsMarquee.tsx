import { InfiniteMarquee } from "@/components/reactbits/InfiniteMarquee";
import { siteConfig } from "@/config/site";
import { useState, useEffect } from "react";

export const StatsMarquee = () => {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.stats) {
          setStats(data.stats);
        }
      })
      .catch(() => {});
  }, []);

  const items = [
    `${stats?.servers ?? siteConfig.bot.servers} sunucu`,
    `${stats?.users ?? siteConfig.bot.users} kullanıcı`,
    `${stats?.commandCount ?? siteConfig.bot.commands}+ komut`,
    `${siteConfig.bot.uptime} uptime`,
    "Kayıpsız ses",
    "Gelişmiş moderasyon",
    "7/24 kesintisiz",
    stats?.ping ? `${stats.ping}ms gecikme` : "<50ms gecikme",
  ];
  return (
    <section className="w-full py-5 overflow-hidden border-y border-border/40 bg-card/30 backdrop-blur-sm">
      <InfiniteMarquee items={items} speed={35} />
    </section>
  );
};
