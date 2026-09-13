import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Github, MessageSquare, ShieldCheck, Server, Cpu, Database, Zap } from "lucide-react";
import { siteConfig } from "@/config/site";
import { SplitTextReveal } from "@/components/reactbits/SplitTextReveal";

const About = () => {
  const [botData, setBotData] = useState<any>(null);
  const [devData, setDevData] = useState<any>(null);

  useEffect(() => {
    document.title = `Hakkında — ${siteConfig.bot.name}`;

    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          if (data.bot) setBotData(data.bot);
          if (data.devProfile) setDevData(data.devProfile);
        }
      })
      .catch(() => {});
  }, []);

  const botName = botData?.username || siteConfig.bot.name;
  const botTag = botData?.tag || siteConfig.bot.name;
  const botAvatar = botData?.avatar || "/favicon.png";
  const botBanner = botData?.banner;
  const botBio = botData?.bio || siteConfig.bot.description;

  const devName = devData?.globalName || "Muhammedpyz";
  const devUsername = devData?.username || "muhammedpyz_";
  const devAvatar = devData?.avatar || "/favicon.png";
  const devClanTag = devData?.clanTag || "LİON";

  return (
    <section className="container max-w-5xl pt-6 pb-20">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-2xl mx-auto">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">Proje & Sistem Hakkında</span>
        <SplitTextReveal
          as="h1"
          text={`${botName} Hakkında`}
          className="mt-3 font-display font-bold text-5xl md:text-6xl tracking-tight text-gradient bg-aurora bg-clip-text"
        />
        <p className="mt-4 text-muted-foreground leading-relaxed">
          {botName}, modern Discord toplulukları için yüksek performanslı moderasyon, müzik, bilet ve rol koruma çözümleri sunan gelişmiş bir altyapı botudur.
        </p>
      </motion.div>

      {/* Main Bot Showcase Section */}
      <div className="mt-14 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="liquid-glass rounded-3xl p-8 relative overflow-hidden border border-primary/30 shadow-2xl"
        >
          {/* Bot Banner */}
          <div className="h-36 rounded-2xl -mx-4 -mt-4 opacity-90 relative overflow-hidden bg-aurora">
            {botBanner ? (
              <img src={botBanner} alt="Bot Banner" className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-purple-600/30 backdrop-blur-sm" />
            )}
          </div>

          {/* Bot Avatar and Details */}
          <div className="relative px-2 -mt-14 flex flex-wrap justify-between items-end gap-4">
            <div className="relative">
              <img
                src={botAvatar}
                alt={botName}
                className="w-28 h-28 rounded-full object-cover ring-4 ring-background shadow-2xl"
              />
              <span className="absolute bottom-1 right-1 h-5 w-5 bg-emerald-500 ring-4 ring-background rounded-full" title="Çevrimiçi" />
            </div>

            <span className="px-4 py-1.5 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-mono font-semibold tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" /> RESMİ DISCORD BOTU
            </span>
          </div>

          <div className="mt-6 text-left">
            <h3 className="font-display font-bold text-3xl flex items-center gap-2">
              {botName}
            </h3>
            <p className="text-xs font-mono text-muted-foreground">{botTag}</p>

            <p className="mt-4 text-sm text-muted-foreground leading-relaxed text-base">
              {botBio}
            </p>
          </div>

          {/* Core Tech Stack Modules */}
          <div className="mt-8 pt-6 border-t border-border/40 grid sm:grid-cols-3 gap-4 text-left">
            <div className="liquid-glass rounded-2xl p-4">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
                <Cpu className="h-4 w-4" /> Discord.js v14
              </div>
              <p className="text-xs text-muted-foreground">Components V2 ve modern API mimarisi.</p>
            </div>
            <div className="liquid-glass rounded-2xl p-4">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
                <Database className="h-4 w-4" /> MariaDB & Redis
              </div>
              <p className="text-xs text-muted-foreground">Rol hafızası ve anlık milisaniyelik önbellek.</p>
            </div>
            <div className="liquid-glass rounded-2xl p-4">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
                <Zap className="h-4 w-4" /> %99.9 Uptime
              </div>
              <p className="text-xs text-muted-foreground">Yedekli sunucu ile 7/24 kesintisiz hizmet.</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Developer Credit Footer Card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mt-12 max-w-3xl mx-auto liquid-glass rounded-3xl p-6 border border-border/40 flex items-center justify-between flex-wrap gap-4"
      >
        <div className="flex items-center gap-4">
          <img src={devAvatar} alt={devName} className="w-14 h-14 rounded-full object-cover ring-2 ring-primary/40" />
          <div className="text-left">
            <div className="text-xs text-muted-foreground font-mono font-semibold uppercase tracking-wider">Geliştirici</div>
            <div className="font-display font-bold text-lg flex items-center gap-1.5">
              {devName} <span className="text-xs text-primary font-mono font-normal">[{devClanTag}]</span>
            </div>
            <div className="text-xs text-muted-foreground font-mono">@{devUsername}</div>
          </div>
        </div>

        <div className="flex gap-2">
          <a
            href="https://github.com/muhammedpyz"
            target="_blank"
            rel="noreferrer"
            className="liquid-glass h-10 w-10 rounded-full grid place-items-center hover:scale-110 transition-transform"
            title="GitHub"
          >
            <Github className="h-4.5 w-4.5" />
          </a>
          <a
            href={siteConfig.contact.discord}
            target="_blank"
            rel="noreferrer"
            className="liquid-glass h-10 w-10 rounded-full grid place-items-center hover:scale-110 transition-transform"
            title="Discord Sunucusu"
          >
            <MessageSquare className="h-4.5 w-4.5" />
          </a>
        </div>
      </motion.div>
    </section>
  );
};

export default About;
