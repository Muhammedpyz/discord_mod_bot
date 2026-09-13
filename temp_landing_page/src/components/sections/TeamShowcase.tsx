import { motion } from "framer-motion";
import { Github, MessageSquare, ExternalLink, Gamepad2, Radio, Music, Tv } from "lucide-react";
import { siteConfig } from "@/config/site";
import { SplitTextReveal } from "@/components/reactbits/SplitTextReveal";
import { useState, useEffect } from "react";
import { apiFetch, API_BASE_URL } from "@/lib/api";

export const TeamShowcase = () => {
  const [devData, setDevData] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    const loadData = () => {
      apiFetch("/api/stats")
        .then((res) => res.json())
        .then((data) => {
          if (isMounted && data && data.devProfile) {
            setDevData(data.devProfile);
          }
        })
        .catch(() => {});
    };

    loadData();

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`${API_BASE_URL}/api/events/live`);
      eventSource.addEventListener("dev_presence", loadData);
    } catch (e) {}

    return () => {
      isMounted = false;
      if (eventSource) eventSource.close();
    };
  }, []);

  const devId = devData?.id || "651790387198820425";
  const devName = devData?.globalName || "Muhammedpyz";
  const devUsername = devData?.username || "muhammedpyz_";
  const devAvatar = devData?.avatar || "/favicon.png";
  const devBanner = devData?.banner;
  const devBio = devData?.bio;

  const devPresence = devData?.presence || { status: "offline", activities: [] };
  const status = devPresence.status || "offline";
  const isOnline = status !== "offline";
  const primaryActivity = isOnline ? devPresence.activities?.[0] : null;

  const statusColor =
    status === "online"
      ? "bg-emerald-500"
      : status === "idle"
      ? "bg-amber-500"
      : status === "dnd"
      ? "bg-rose-500"
      : "bg-zinc-500";

  const statusLabel =
    status === "online"
      ? "Çevrimiçi"
      : status === "idle"
      ? "Boşta"
      : status === "dnd"
      ? "Rahatsız Etmeyin"
      : "Çevrimdışı";

  // Real Discord Activity Formatter
  const formatActivity = (act: any) => {
    if (!act) return null;
    let label = "Oynuyor";
    let Icon = Gamepad2;
    if (act.type === 1) {
      label = "Yayında";
      Icon = Radio;
    } else if (act.type === 2) {
      label = "Dinliyor";
      Icon = Music;
    } else if (act.type === 3) {
      label = "İzliyor";
      Icon = Tv;
    } else if (act.type === 4) {
      label = "Özel Durum";
      Icon = MessageSquare;
    }

    const title = act.name;
    const sub = act.details ? `${act.details}${act.state ? ` (${act.state})` : ""}` : (act.state || null);

    return { label, Icon, title, sub };
  };

  const activityInfo = formatActivity(primaryActivity);

  return (
    <section className="container max-w-6xl py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center max-w-2xl mx-auto"
      >
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">Geliştirici</span>
        <SplitTextReveal
          as="h2"
          text="Bot Geliştiricisi"
          className="mt-3 font-display font-bold text-4xl md:text-5xl tracking-tight"
        />
        <p className="mt-4 text-muted-foreground">
          Sistem mimarisini ve bot altyapısını yöneten geliştirici profili.
        </p>
      </motion.div>

      <div className="mt-14 max-w-xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="liquid-glass rounded-3xl p-6 relative overflow-hidden border border-primary/30 shadow-2xl group"
        >
          {/* Banner */}
          <div className="h-28 rounded-2xl -mx-2 -mt-2 opacity-90 relative overflow-hidden bg-aurora">
            {devBanner ? (
              <img src={devBanner} alt="Developer Banner" className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-purple-600/30 backdrop-blur-sm" />
            )}
          </div>

          {/* Avatar */}
          <div className="relative px-2 -mt-12 flex justify-between items-end">
            <div className="relative">
              <img
                src={devAvatar}
                alt={devName}
                className="w-24 h-24 rounded-full object-cover ring-4 ring-background shadow-2xl group-hover:scale-105 transition-transform duration-500 bg-card"
              />
              <span
                className={`absolute bottom-1 right-1 h-4 w-4 ${statusColor} ring-4 ring-background rounded-full shadow-md`}
                title={statusLabel}
              />
            </div>
          </div>

          {/* Developer Identity */}
          <div className="mt-4 text-left">
            <div>
              <h3 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
                {devName}
              </h3>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">@{devUsername}</p>
            </div>

            {/* Live Discord Activity (only when playing/active) */}
            {isOnline && activityInfo && (
              <div className="mt-3.5 inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-card/70 border border-primary/25 text-xs shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                <activityInfo.Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="font-semibold text-foreground/90">{activityInfo.label}:</span>
                <span className="font-medium text-foreground truncate max-w-[200px] sm:max-w-[280px]">
                  {activityInfo.title}
                </span>
                {activityInfo.sub && (
                  <span className="text-muted-foreground truncate max-w-[220px] text-[11px]">
                    • {activityInfo.sub}
                  </span>
                )}
              </div>
            )}

            {/* Custom Bio (only if set, otherwise omitted) */}
            {devBio && (
              <p className="mt-3.5 text-sm text-muted-foreground leading-relaxed p-3 rounded-xl bg-card/40 border border-border/40">
                {devBio}
              </p>
            )}
          </div>

          {/* Social Links & Action Buttons */}
          <div className="mt-5 pt-4 border-t border-border/40 flex justify-between items-center">
            <a
              href={`https://discord.com/users/${devId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              Discord Profilini Aç <ExternalLink className="h-3 w-3" />
            </a>

            <div className="flex gap-2">
              <a
                href="https://github.com/muhammedpyz"
                target="_blank"
                rel="noreferrer"
                className="liquid-glass h-9 w-9 rounded-full grid place-items-center hover:scale-110 transition-transform"
                title="GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href={siteConfig.bot.supportUrl}
                target="_blank"
                rel="noreferrer"
                className="liquid-glass h-9 w-9 rounded-full grid place-items-center hover:scale-110 transition-transform"
                title="Destek Sunucusu"
              >
                <MessageSquare className="h-4 w-4" />
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
