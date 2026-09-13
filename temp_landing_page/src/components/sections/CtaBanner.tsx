import { motion } from "framer-motion";
import { ArrowRight, Users, Sparkles, ShieldCheck, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { MagneticButton } from "@/components/reactbits/MagneticButton";
import { SplitTextReveal } from "@/components/reactbits/SplitTextReveal";
import { useState, useEffect } from "react";

export const CtaBanner = () => {
  const [serverCard, setServerCard] = useState<any>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.serverCard) {
          setServerCard(data.serverCard);
        }
      })
      .catch(() => {});
  }, []);

  const serverName = serverCard?.name || "FarLands Topluluk Sunucusu";
  const serverDesc = serverCard?.description || "Nyx resmi destek ve topluluk sunucusuna katılarak tüm yenilikleri anında takip edin.";
  const serverIcon = serverCard?.icon;
  const serverBanner = serverCard?.banner;
  const memberCount = serverCard?.memberCount || 70;
  const onlineCount = serverCard?.onlineCount || 6;
  const inviteUrl = serverCard?.inviteUrl || siteConfig.bot.supportUrl;

  return (
    <section className="container max-w-5xl py-20">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="relative liquid-glass rounded-3xl p-8 md:p-14 overflow-hidden border border-primary/20"
      >
        <div className="absolute inset-0 bg-aurora opacity-15 animate-aurora" />

        <div className="relative grid md:grid-cols-3 gap-8 items-center">
          {/* Left / Main Text */}
          <div className="md:col-span-2 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-4 border border-indigo-500/20">
              <MessageSquare className="h-3.5 w-3.5" /> Canlı Topluluk & Destek Sunucusu
            </div>
            <SplitTextReveal
              as="h2"
              text={serverName}
              className="font-display font-bold text-3xl md:text-4xl tracking-tight text-gradient bg-aurora bg-clip-text"
            />
            <p className="mt-4 text-muted-foreground leading-relaxed text-sm md:text-base">
              {serverDesc}
            </p>

            <div className="mt-6 flex flex-wrap gap-4 items-center">
              <MagneticButton>
                <Button asChild variant="hero" size="lg">
                  <a href={inviteUrl} target="_blank" rel="noreferrer">
                    Destek Sunucusuna Katıl <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </MagneticButton>
              <MagneticButton>
                <Button asChild variant="glass" size="lg">
                  <a href={siteConfig.bot.inviteUrl} target="_blank" rel="noreferrer">
                    Botu Ekle
                  </a>
                </Button>
              </MagneticButton>
            </div>
          </div>

          {/* Right Live Server Card */}
          <div className="md:col-span-1">
            <div className="liquid-glass rounded-2xl p-5 border border-primary/30 relative overflow-hidden text-center shadow-xl">
              {serverBanner && (
                <div className="h-20 -mx-5 -mt-5 mb-3 opacity-80 overflow-hidden">
                  <img src={serverBanner} alt="Server Banner" className="w-full h-full object-cover" />
                </div>
              )}
              {serverIcon ? (
                <img
                  src={serverIcon}
                  alt={serverName}
                  className="w-20 h-20 rounded-2xl mx-auto ring-4 ring-background shadow-lg object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-aurora grid place-items-center mx-auto text-3xl font-bold ring-4 ring-background">
                  TL
                </div>
              )}

              <h4 className="mt-3 font-display font-bold text-lg leading-snug line-clamp-1">{serverName}</h4>

              <div className="mt-4 pt-3 border-t border-border/40 grid grid-cols-2 gap-2 text-center text-xs">
                <div className="liquid-glass rounded-xl p-2">
                  <span className="text-muted-foreground flex items-center justify-center gap-1">
                    <span className="h-2 w-2 bg-emerald-500 rounded-full inline-block animate-pulse" /> Çevrimiçi
                  </span>
                  <span className="font-bold text-sm mt-0.5 block">{onlineCount}</span>
                </div>
                <div className="liquid-glass rounded-xl p-2">
                  <span className="text-muted-foreground flex items-center justify-center gap-1">
                    <Users className="h-3 w-3 text-primary" /> Üye
                  </span>
                  <span className="font-bold text-sm mt-0.5 block">{memberCount}</span>
                </div>
              </div>

              <a
                href={inviteUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 block w-full text-center py-2.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 text-xs font-semibold border border-indigo-500/30 transition-colors"
              >
                Sunucuya Katıl
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};
