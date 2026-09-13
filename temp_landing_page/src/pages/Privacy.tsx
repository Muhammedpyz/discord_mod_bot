import { motion } from "framer-motion";
import { useEffect } from "react";
import { Shield, FileText } from "lucide-react";
import { siteConfig } from "@/config/site";
import { SplitTextReveal } from "@/components/reactbits/SplitTextReveal";

const Privacy = () => {
  useEffect(() => {
    document.title = `Privacy & Terms — ${siteConfig.bot.name}`;
  }, []);

  return (
    <section className="container max-w-4xl pt-6 pb-20">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">Legal</span>
        <SplitTextReveal
          as="h1"
          text="Privacy & Terms"
          className="mt-3 font-display font-bold text-5xl md:text-6xl tracking-tight text-gradient bg-aurora bg-clip-text"
        />
        <p className="mt-4 text-muted-foreground">Last updated {siteConfig.privacy.lastUpdated}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mt-12 liquid-glass rounded-3xl p-8 md:p-10"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-xl bg-aurora grid place-items-center shadow-[var(--shadow-glow)]">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <h2 className="font-display font-bold text-2xl">Privacy Policy</h2>
        </div>
        <div className="space-y-7">
          {siteConfig.privacy.sections.map((s, i) => (
            <div key={i}>
              <h3 className="font-display font-semibold text-lg text-foreground">{s.title}</h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mt-8 liquid-glass rounded-3xl p-8 md:p-10"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-xl bg-aurora grid place-items-center shadow-[var(--shadow-glow)]">
            <FileText className="h-5 w-5 text-primary-foreground" />
          </div>
          <h2 className="font-display font-bold text-2xl">Terms of Service</h2>
        </div>
        <div className="space-y-7">
          {siteConfig.terms.sections.map((s, i) => (
            <div key={i}>
              <h3 className="font-display font-semibold text-lg text-foreground">{s.title}</h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
};

export default Privacy;
