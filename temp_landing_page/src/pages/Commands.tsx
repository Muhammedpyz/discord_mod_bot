import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Copy, Check, Shield, Music, Gift, Radio, Zap, Link2, Layers, X, Coins, Users, Gamepad2, Trophy, Bell, Heart, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { siteConfig } from "@/config/site";
import { SplitTextReveal } from "@/components/reactbits/SplitTextReveal";

const iconMap: Record<string, any> = {
  "Moderasyon": Shield,
  "Müzik": Music,
  "Çekiliş & Güvenlik": Gift,
  "Özel Odalar & Bilet": Radio,
  "Araçlar & Eğlence": Zap,
  "Ekonomi & Market": Coins,
  "Topluluk Araçları": Users,
  "Oyun Entegrasyonları": Gamepad2,
  "Seviye & Sıralama": Trophy,
  "Hatırlatıcı & Görevler": Bell,
  "Sosyal & Profil": Heart,
  "Eğlence & Oyunlar": Sparkles
};

const Commands = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [activeCat, setActiveCat] = useState("Tümü");
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [liveCategories, setLiveCategories] = useState<Record<string, any[]>>({});
  const [totalCommands, setTotalCommands] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setQuery(q);
  }, [searchParams]);

  useEffect(() => {
    document.title = `Komutlar — ${siteConfig.bot.name}`;
    
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.commandCategories && Object.keys(data.commandCategories).length > 0) {
          setLiveCategories(data.commandCategories);
          if (data.stats && data.stats.commandCount) {
            setTotalCommands(data.stats.commandCount);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = (usage: string) => {
    navigator.clipboard.writeText(usage);
    setCopiedCmd(usage);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const handleCopyLink = (cmdName: string) => {
    const clean = cmdName.replace("/", "");
    const url = `${window.location.origin}/commands?q=${encodeURIComponent(clean)}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(clean);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  // Tamamen API'den dinamik çekiliyor
  const categoriesList = Object.keys(liveCategories).length > 0
    ? Object.keys(liveCategories).map(catName => ({
        name: catName,
        icon: iconMap[catName] || Zap,
        commands: liveCategories[catName].map((cmd: any) => ({ ...cmd, _category: catName }))
      }))
    : [];

  const allCommandsList = categoriesList.flatMap(c => c.commands);
  const displayTabs = [
    { name: "Tümü", icon: Layers, count: allCommandsList.length },
    ...categoriesList.map(c => ({ name: c.name, icon: c.icon, count: c.commands.length }))
  ];

  const currentCategory = categoriesList.find((c) => c.name === activeCat) || categoriesList[0];
  const filtered = query.trim()
    ? allCommandsList.filter(
        (c) => c.name.toLowerCase().includes(query.toLowerCase()) || (c.description && c.description.toLowerCase().includes(query.toLowerCase()))
      )
    : activeCat === "Tümü"
    ? allCommandsList
    : currentCategory?.commands || [];

  return (
    <section className="container max-w-6xl pt-6 pb-20">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-2xl mx-auto">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">Komutlar</span>
        <SplitTextReveal
          as="h1"
          text={`${totalCommands}+ Canlı Komut`}
          className="mt-3 font-display font-bold text-5xl md:text-6xl tracking-tight text-gradient bg-aurora bg-clip-text"
        />
        <p className="mt-4 text-muted-foreground">
          Bot klasörünüzdeki komutlar anlık taranarak {categoriesList.length > 0 ? `${categoriesList.length} kategoriye` : "kategorilere"} ayrılmıştır.
        </p>
      </motion.div>

      <div className="mt-10 max-w-xl mx-auto relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Komutlarda ara… (örn. /ban, /mute)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="liquid-glass border-0 h-12 pl-12 pr-10 rounded-full text-base"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 transition-colors"
            title="Temizle"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {displayTabs.map((t) => {
          const Icon = t.icon;
          const isActive = (query.trim() === "" && activeCat === t.name) || (query.trim() !== "" && t.name === "Tümü");
          return (
            <button
              key={t.name}
              onClick={() => {
                setActiveCat(t.name);
                if (query) setQuery("");
              }}
              className={`relative flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? "bg-aurora text-primary-foreground shadow-[var(--shadow-glow)] scale-105"
                  : "liquid-glass text-foreground hover:scale-105"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{t.name}</span>
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${isActive ? "bg-black/20 text-white" : "bg-muted text-muted-foreground"}`}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Parameter Format Legend */}
      <div className="mt-6 flex flex-wrap justify-center items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-primary/15 text-primary border border-primary/30 font-semibold">&lt;parametre&gt;</span>
          <span>Zorunlu Alan</span>
        </span>
        <span>•</span>
        <span className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-muted text-muted-foreground border border-border/50 font-semibold">[parametre]</span>
          <span>İsteğe Bağlı (Opsiyonel)</span>
        </span>
      </div>

      <motion.div
        key={activeCat}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 grid sm:grid-cols-2 gap-4"
      >
        {filtered.map((cmd, i) => (
          <motion.div
            key={cmd.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="liquid-glass rounded-2xl p-5 hover:scale-[1.02] transition-transform flex flex-col justify-between"
          >
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <code className="font-mono text-base font-bold text-gradient bg-aurora bg-clip-text">
                  {cmd.name}
                </code>
                <div className="flex items-center gap-1.5">
                  {cmd.permission && (
                    <span className={`text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full font-medium ${
                      cmd.permission === "Yönetici"
                        ? "bg-red-500/15 text-red-400 border border-red-500/30"
                        : cmd.permission === "Moderatör" || cmd.permission.includes("Yasakla")
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    }`}>
                      {cmd.permission}
                    </span>
                  )}
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium border border-primary/30">
                    {cmd._category || currentCategory?.name}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{cmd.description}</p>

              {/* Option parameters breakdown */}
              {cmd.options && cmd.options.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-border/30">
                  {cmd.options.map((opt: any, oIdx: number) => (
                    <span
                      key={oIdx}
                      className={`text-[11px] font-mono px-2 py-0.5 rounded flex items-center gap-1 ${
                        opt.required
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "bg-muted text-muted-foreground border border-border/40"
                      }`}
                      title={opt.description}
                    >
                      <span>{opt.required ? `<${opt.name}>` : `[${opt.name}]`}</span>
                      {opt.description && (
                        <span className="opacity-60 text-[10px] hidden sm:inline">— {opt.description}</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between gap-2 text-xs font-mono text-muted-foreground bg-muted/40 rounded-xl px-3 py-2.5 border border-border/40">
              <span className="truncate flex items-center gap-1">
                {cmd.usage.split(" ").map((token: string, tIdx: number) => {
                  if (token.startsWith("<") && token.endsWith(">")) {
                    return (
                      <span key={tIdx} className="text-primary font-semibold">
                        {token}
                      </span>
                    );
                  }
                  if (token.startsWith("[") && token.endsWith("]")) {
                    return (
                      <span key={tIdx} className="text-muted-foreground/80">
                        {token}
                      </span>
                    );
                  }
                  return (
                    <span key={tIdx} className="text-foreground font-medium">
                      {token}
                    </span>
                  );
                })}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleCopyLink(cmd.name)}
                  className="hover:text-foreground p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
                  title="Komutun doğrudan arama bağlantısını kopyala"
                >
                  {copiedLink === cmd.name.replace("/", "") ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Link2 className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => handleCopy(cmd.usage)}
                  className="hover:text-foreground p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
                  title="Kullanım kodunu kopyala"
                >
                  {copiedCmd === cmd.usage ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && loading && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
            <span className="text-muted-foreground text-sm">Komutlar yükleniyor...</span>
          </div>
        )}
        {filtered.length === 0 && !loading && (
          <div className="col-span-full text-center text-muted-foreground py-16">Aramanızla eşleşen komut bulunamadı.</div>
        )}
      </motion.div>
    </section>
  );
};

export default Commands;
