import { motion } from "framer-motion";
import { 
  ShieldCheck, 
  Lock, 
  Database, 
  Zap, 
  Music, 
  Radio, 
  Ticket, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Volume2, 
  Sparkles 
} from "lucide-react";
import { SplitTextReveal } from "@/components/reactbits/SplitTextReveal";
import { useState, useEffect } from "react";

export const Features = () => {
  const [livePing, setLivePing] = useState<number>(38);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data?.stats?.ping) {
          setLivePing(data.stats.ping);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <section className="container max-w-6xl py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center max-w-2xl mx-auto"
      >
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">Modüler Altyapı</span>
        <SplitTextReveal
          as="h2"
          text="Sunucunuz için gereken her şey"
          className="mt-3 font-display font-bold text-4xl md:text-5xl tracking-tight"
        />
        <p className="mt-4 text-muted-foreground text-base">
          Birbiriyle entegre çalışan yüksek performanslı modüller. Her özellik en düşük gecikme ve sıfır veri kaybı için optimize edildi.
        </p>
      </motion.div>

      {/* Bento Grid Layout */}
      <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* BENTO 1: Moderasyon & Rol Hafızası (2 Columns Wide) */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="md:col-span-2 liquid-glass rounded-3xl p-7 sm:p-8 flex flex-col justify-between relative overflow-hidden border border-border/60 group hover:border-primary/40 transition-all duration-300"
        >
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10 group-hover:bg-primary/15 transition-colors" />

          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="h-12 w-12 rounded-2xl bg-aurora grid place-items-center shadow-lg shadow-primary/20">
                <ShieldCheck className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/25 font-semibold">
                Otomatik Ceza Döngüsü
              </span>
            </div>

            <h3 className="font-display font-bold text-2xl mb-2 text-foreground">
              Gelişmiş Moderasyon & Rol Hafızası (Role Memory)
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
              Cezalandırılan (Mute/Ban) üyelerin sahip olduğu VIP, Yetkili veya Özel roller veritabanına anlık kaydedilir. Ceza süresi bittiğinde roller sıfır kayıpla otomatik olarak üyeye geri yüklenir.
            </p>
          </div>

          {/* Mini Simulated Role Memory Visual */}
          <div className="mt-6 pt-5 border-t border-border/40 grid sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-card/50 border border-border/50 text-xs">
              <div className="flex items-center justify-between text-muted-foreground mb-1.5 font-medium">
                <span className="flex items-center gap-1.5 text-rose-400">
                  <Lock className="h-3.5 w-3.5" /> Ceza Uygulandı
                </span>
                <span className="font-mono text-[11px]">Roller Güvende</span>
              </div>
              <div className="font-mono text-[11px] text-muted-foreground truncate">
                Mute Cezası: VIP & Yetkili rolleri hafızaya alındı.
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-card/50 border border-border/50 text-xs">
              <div className="flex items-center justify-between text-muted-foreground mb-1.5 font-medium">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Süre Bitti
                </span>
                <span className="font-mono text-[11px] text-emerald-400">Otomatik İade</span>
              </div>
              <div className="font-mono text-[11px] text-muted-foreground truncate">
                Roller eksiksiz üyenin profiline geri yüklendi.
              </div>
            </div>
          </div>
        </motion.div>

        {/* BENTO 2: MariaDB & Redis Performans (1 Column) */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="liquid-glass rounded-3xl p-7 flex flex-col justify-between relative overflow-hidden border border-border/60 group hover:border-primary/40 transition-all duration-300"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/20 border border-primary/30 grid place-items-center">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <span className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> {livePing}ms
              </span>
            </div>

            <h3 className="font-display font-bold text-xl mb-2 text-foreground">
              MariaDB & Redis Altyapısı
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              In-memory Redis cache ve optimize MariaDB bağlantı havuzu ile binlerce sunucuda anlık tepki hızı.
            </p>
          </div>

          <div className="mt-6 p-4 rounded-2xl bg-card/40 border border-border/50 text-center">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Bellek Önbelleği</span>
              <span className="font-mono text-primary font-semibold">Aktif</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div className="bg-gradient-to-r from-primary to-emerald-400 h-2 rounded-full w-[94%]" />
            </div>
          </div>
        </motion.div>

        {/* BENTO 3: 8D Ses & Müzik (1 Column) */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="liquid-glass rounded-3xl p-7 flex flex-col justify-between relative overflow-hidden border border-border/60 group hover:border-primary/40 transition-all duration-300"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/20 border border-primary/30 grid place-items-center">
                <Music className="h-6 w-6 text-primary" />
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/25">
                Lossless Audio
              </span>
            </div>

            <h3 className="font-display font-bold text-xl mb-2 text-foreground">
              8D Filtreli Kesintisiz Müzik
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              BassBoost, 8D, Nightcore ses filtreleri ve 7/24 ses kanalında kalma moduyla stüdyo kalitesinde müzik.
            </p>
          </div>

          {/* Equalizer Visualizer — Organic Framer Motion */}
          <div className="mt-6 flex items-end gap-[3px] h-14 px-3 py-2 rounded-2xl bg-card/40 border border-border/50">
            {Array.from({ length: 22 }).map((_, idx) => {
              const seed = idx * 37;
              const heights = [
                `${15 + (seed % 30)}%`,
                `${55 + (seed % 40)}%`,
                `${20 + ((seed + 17) % 40)}%`,
                `${65 + ((seed + 7) % 30)}%`,
                `${25 + ((seed + 29) % 35)}%`,
              ];
              const dur = 1.2 + ((seed % 10) / 10);
              return (
                <motion.span
                  key={idx}
                  className="flex-1 rounded-full bg-gradient-to-t from-primary/40 to-primary shadow-[0_0_6px_rgba(var(--primary-rgb,139,92,246),0.35)]"
                  animate={{ height: heights }}
                  transition={{
                    duration: dur,
                    repeat: Infinity,
                    repeatType: "mirror",
                    ease: "easeInOut",
                    delay: (idx % 7) * 0.12,
                  }}
                  style={{ minHeight: "8%" }}
                />
              );
            })}
          </div>
        </motion.div>

        {/* BENTO 4: Özel Geçici Ses Odaları (1 Column) */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="liquid-glass rounded-3xl p-7 flex flex-col justify-between relative overflow-hidden border border-border/60 group hover:border-primary/40 transition-all duration-300"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/20 border border-primary/30 grid place-items-center">
                <Radio className="h-6 w-6 text-primary" />
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/25">
                Join to Create
              </span>
            </div>

            <h3 className="font-display font-bold text-xl mb-2 text-foreground">
              Özel Geçici Odalar
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Odaya girildiğinde otomatik oluşturulan ve son üye çıktığında sunucuyu kirletmeden silinen ses kanalları.
            </p>
          </div>

          <div className="mt-6 p-3 rounded-2xl bg-card/40 border border-border/50 flex items-center justify-between text-xs">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <Volume2 className="h-3.5 w-3.5 text-primary" /> Oda Kilidi & Limit
            </span>
            <span className="font-mono text-muted-foreground">Panel Kontrollü</span>
          </div>
        </motion.div>

        {/* BENTO 5: Components V2 Bilet & 14 Log Kanalı (1 Column) */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="liquid-glass rounded-3xl p-7 flex flex-col justify-between relative overflow-hidden border border-border/60 group hover:border-primary/40 transition-all duration-300"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/20 border border-primary/30 grid place-items-center">
                <Ticket className="h-6 w-6 text-primary" />
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/25">
                Containers V2
              </span>
            </div>

            <h3 className="font-display font-bold text-xl mb-2 text-foreground">
              Bilet Paneli & 14 Log Kategorisi
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Modal pencereli bilet talepleri ve sunucudaki tüm olayları (rol, kanal, ceza, ses) ayrı kanallara kaydeden 14 log kategorisi.
            </p>
          </div>

          <div className="mt-6 p-3 rounded-2xl bg-card/40 border border-border/50 flex items-center justify-between text-xs">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-primary" /> 14 Ayrık Kanal
            </span>
            <span className="font-mono text-emerald-400 font-semibold">Anlık Denetim</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
