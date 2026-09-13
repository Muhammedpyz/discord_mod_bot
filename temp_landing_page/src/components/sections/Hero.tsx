import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Sparkles, ShieldCheck, Users, Server } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { API_BASE_URL } from "@/lib/api";

export const Hero = () => {
  const stageRef = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 80, damping: 15, mass: 0.5 });
  const sy = useSpring(my, { stiffness: 80, damping: 15, mass: 0.5 });
  const logoX = useTransform(sx, (v) => v * 24);
  const logoY = useTransform(sy, (v) => v * 24);
  const logoRotY = useTransform(sx, (v) => v * 12);
  const logoRotX = useTransform(sy, (v) => v * -12);
  const glowX = useTransform(sx, (v) => v * 14);
  const glowY = useTransform(sy, (v) => v * 14);
  const cardAX = useTransform(sx, (v) => v * -16);
  const cardAY = useTransform(sy, (v) => v * -16);
  const cardBX = useTransform(sx, (v) => v * 18);
  const cardBY = useTransform(sy, (v) => v * 18);

  const [liveBot, setLiveBot] = useState<any>(null);

  useEffect(() => {
    const fetchStats = () => {
      fetch("/api/stats")
        .then((res) => res.json())
        .then((data) => {
          if (data && data.bot) {
            setLiveBot(data);
          }
        })
        .catch(() => {});
    };
    fetchStats();

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`${API_BASE_URL}/api/events/live`);
      eventSource.addEventListener("stats_update", fetchStats);
    } catch (e) {}

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const handleLeave = () => {
    mx.set(0);
    my.set(0);
  };

  const botAvatar = liveBot?.bot?.avatar || "/favicon.png";
  const botBanner = liveBot?.bot?.banner;
  const botBio = liveBot?.bot?.bio || siteConfig.bot.description;
  const botName = liveBot?.bot?.username || siteConfig.bot.name;
  const botTag = liveBot?.bot?.tag || siteConfig.bot.name;
  const inviteLink = liveBot?.bot?.inviteUrl || siteConfig.bot.inviteUrl;
  const serverCount = liveBot?.stats?.servers ?? siteConfig.bot.servers;
  const userCount = liveBot?.stats?.users ?? siteConfig.bot.users;

  return (
    <section className="container max-w-6xl pt-10 pb-24 relative">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
        >
          <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight">
            <span className="text-gradient animate-aurora bg-aurora bg-clip-text text-transparent">{botName}</span> ile Tanışın
            <br />
            {siteConfig.bot.tagline}
          </h1>

          <p className="mt-6 text-lg text-muted-foreground max-w-lg leading-relaxed">
            {botBio}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="hero" size="lg">
              <a href={inviteLink} target="_blank" rel="noreferrer">
                {botName}'u Sunucuna Ekle <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="glass" size="lg">
              <a href={siteConfig.bot.supportUrl} target="_blank" rel="noreferrer">Destek Sunucusu</a>
            </Button>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
            {[
              { label: "Sunucular", value: serverCount },
              { label: "Kullanıcılar", value: userCount },
              { label: "Uptime", value: siteConfig.bot.uptime },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="liquid-glass rounded-2xl p-4 text-center"
              >
                <div className="text-2xl font-display font-bold text-gradient bg-aurora bg-clip-text">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative flex items-center justify-center w-full"
        >
          <div
            ref={stageRef}
            onMouseMove={handleMove}
            onMouseLeave={handleLeave}
            className="relative w-full max-w-lg lg:max-w-xl"
            style={{ perspective: 1000 }}
          >
            {/* Live Discord Bot Profile Card (Enlarged) */}
            <motion.div
              className="liquid-glass rounded-3xl p-7 relative overflow-hidden border border-primary/25 shadow-2xl backdrop-blur-2xl"
              style={{ x: logoX, y: logoY, rotateX: logoRotX, rotateY: logoRotY, transformStyle: "preserve-3d" }}
            >
              {/* Bot Banner Image or Default Aurora */}
              <div className="h-36 sm:h-40 rounded-2xl -mx-2 -mt-2 opacity-95 relative overflow-hidden bg-aurora">
                {botBanner ? (
                  <img src={botBanner} alt="Banner" className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-purple-600/30 backdrop-blur-sm" />
                )}
              </div>

              <div className="relative px-2 -mt-16 flex justify-between items-end">
                <div className="relative">
                  <img
                    src={botAvatar}
                    alt={botName}
                    className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover ring-4 ring-background shadow-2xl bg-card"
                  />
                  <span className="absolute bottom-1.5 right-1.5 h-6 w-6 bg-emerald-500 ring-4 ring-background rounded-full" title="Çevrimiçi" />
                </div>
                <span className="px-3.5 py-1.5 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-bold uppercase tracking-wider shadow-sm">
                  BOT
                </span>
              </div>

              <div className="mt-5">
                <h3 className="font-display font-extrabold text-2xl sm:text-3xl flex items-center gap-2 text-foreground">
                  {botName}
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </h3>
                <p className="text-xs sm:text-sm font-mono text-muted-foreground mt-0.5">{botTag}</p>
                <p className="mt-3.5 text-sm sm:text-base text-muted-foreground leading-relaxed">
                  {botBio}
                </p>
              </div>

              <div className="mt-6 pt-5 border-t border-border/50 grid grid-cols-2 gap-3.5 text-center">
                <div className="liquid-glass rounded-2xl p-3 border border-border/60">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Server className="h-4 w-4 text-primary" /> Sunucular
                  </div>
                  <div className="font-display font-bold text-xl sm:text-2xl mt-1 text-foreground">{serverCount}</div>
                </div>
                <div className="liquid-glass rounded-2xl p-3 border border-border/60">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Users className="h-4 w-4 text-primary" /> Üyeler
                  </div>
                  <div className="font-display font-bold text-xl sm:text-2xl mt-1 text-foreground">{userCount}</div>
                </div>
              </div>

              <div className="mt-6">
                <Button asChild variant="hero" className="w-full rounded-2xl py-6 text-base font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
                  <a href={inviteLink} target="_blank" rel="noreferrer">
                    {botName}'u Sunucuna Ekle
                  </a>
                </Button>
              </div>
            </motion.div>

            <motion.div
              className="hidden sm:block absolute top-6 -right-6 liquid-glass rounded-2xl px-4 py-3 text-sm will-change-transform z-20 shadow-xl border border-primary/30"
              style={{ x: cardAX, y: cardAY }}
            >
              <div className="text-[11px] text-muted-foreground">Gecikme Süresi</div>
              <div className="font-display font-bold text-base text-gradient bg-aurora bg-clip-text">
                {liveBot?.stats?.ping ? `${liveBot.stats.ping}ms` : "<50ms"}
              </div>
            </motion.div>

            <motion.div
              className="hidden sm:block absolute -bottom-5 -left-6 liquid-glass rounded-2xl px-4 py-3 text-sm will-change-transform z-20 shadow-xl border border-primary/30"
              style={{ x: cardBX, y: cardBY }}
            >
              <div className="text-[11px] text-muted-foreground">Komut Sayısı</div>
              <div className="font-display font-bold text-base text-gradient bg-aurora bg-clip-text">{liveBot?.stats?.commandCount || siteConfig.bot.commands}+</div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
