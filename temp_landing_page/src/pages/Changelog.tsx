import { motion } from "framer-motion";
import { useEffect } from "react";
import { Sparkles, Calendar, Tag, CheckCircle2 } from "lucide-react";
import { siteConfig } from "@/config/site";
import { SplitTextReveal } from "@/components/reactbits/SplitTextReveal";

const Changelog = () => {
  useEffect(() => {
    document.title = `Sürüm Notları — ${siteConfig.bot.name}`;
  }, []);

  return (
    <section className="container max-w-4xl pt-6 pb-20">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">Güncellemeler</span>
        <SplitTextReveal
          as="h1"
          text="Sürüm Notları & Yenilikler"
          className="mt-3 font-display font-bold text-5xl md:text-6xl tracking-tight text-gradient bg-aurora bg-clip-text"
        />
        <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
          {siteConfig.bot.name} için yayınlanan en son güncelleme notları ve sistem geliştirmeleri.
        </p>
      </motion.div>

      <div className="mt-14 relative">
        {/* Timeline Bar */}
        <div className="absolute left-3.5 md:left-6 top-6 bottom-6 w-0.5 bg-gradient-to-b from-primary via-purple-500/40 to-transparent" />

        <div className="space-y-10">
          {(siteConfig as any).changelog.map((item: any, idx: number) => (
            <motion.div
              key={item.version}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.15 }}
              className="relative pl-10 md:pl-16"
            >
              {/* Timeline Node */}
              <div className="absolute left-[15px] md:left-[25px] top-1/2 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center">
                <span className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-primary border-2 border-background shadow-[var(--shadow-glow)]"></span>
                </span>
              </div>

              {/* Version Card */}
              <div className="liquid-glass rounded-3xl p-6 sm:p-8 border border-primary/20 relative overflow-hidden group hover:border-primary/40 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-border/40">
                  <div className="flex items-center gap-3">
                    <span className="font-display font-bold text-2xl sm:text-3xl text-gradient bg-aurora bg-clip-text">
                      {item.version}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-semibold flex items-center gap-1">
                      <Tag className="h-3 w-3" /> {item.tag}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-mono">
                    <Calendar className="h-3.5 w-3.5" /> {item.date}
                  </div>
                </div>

                <ul className="mt-6 space-y-3">
                  {item.highlights.map((h: string, hIdx: number) => (
                    <li key={hIdx} className="flex items-start gap-3 text-sm text-muted-foreground leading-relaxed">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Changelog;
