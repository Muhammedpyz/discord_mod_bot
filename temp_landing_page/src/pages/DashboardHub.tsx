import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Shield, 
  Server, 
  ExternalLink, 
  Search, 
  LogIn, 
  LogOut, 
  Settings, 
  Plus, 
  Crown,
  CheckCircle2,
  Sparkles,
  Bot
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizeGuildList } from "@/lib/guildState";

export default function DashboardHub() {
  const { user, loading, login, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "bot" | "no_bot">("all");
  const navigate = useNavigate();

  // If loading session
  if (loading) {
    return (
      <div className="container max-w-6xl pt-6 pb-20 px-4 min-h-screen">
        <div className="space-y-6">
          <Skeleton className="h-12 w-64 rounded-xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // If NOT logged in
  if (!user) {
    return (
      <div className="container max-w-4xl pt-10 pb-20 px-4 min-h-screen text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="liquid-glass rounded-3xl p-8 sm:p-14 border border-border/60 max-w-2xl mx-auto relative overflow-hidden"
        >
          <div className="absolute -top-24 -left-24 w-60 h-60 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/30 grid place-items-center mx-auto mb-6">
            <Shield className="h-8 w-8 text-primary" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight mb-3">
            Bot Yönetim Paneli
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto mb-8">
            Sunucularınızı web üzerinden canlı yönetmek, AutoMod, Anti-Nuke, rol koruması ve loglama sistemlerini yapılandırmak için Discord hesabınızla giriş yapın.
          </p>

          <div className="flex items-center justify-center">
            <Button
              onClick={login}
              size="lg"
              className="w-full sm:w-auto bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium px-10 h-12 shadow-lg shadow-[#5865F2]/25"
            >
              <LogIn className="h-4 w-4 mr-2" />
              Discord ile Giriş Yap
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Recalculate the per-server state from each guild's own permissions/bot membership so
  // stale cache entries do not make multiple servers appear identical.
  const manageableGuilds = normalizeGuildList(user.guilds || [])
    .filter((g) => g.owner || g.canManage)
    .sort((a, b) => {
      if (a.botJoined && !b.botJoined) return -1;
      if (!a.botJoined && b.botJoined) return 1;
      if (a.owner && !b.owner) return -1;
      if (!a.owner && b.owner) return 1;
      return a.name.localeCompare(b.name, "tr");
    });

  const botJoinedCount = manageableGuilds.filter((g) => g.botJoined).length;
  const missingBotCount = manageableGuilds.filter((g) => !g.botJoined).length;

  // Tab & search filtering
  const filteredGuilds = manageableGuilds.filter((g) => {
    const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterTab === "bot") return g.botJoined;
    if (filterTab === "no_bot") return !g.botJoined;
    return true;
  });

  return (
    <div className="container max-w-6xl pt-6 pb-20 px-4 min-h-screen">
      {/* User Header Profile Banner */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="liquid-glass rounded-2xl p-6 sm:p-8 border border-border/60 mb-6 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden"
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.globalName || user.username}
                className="h-16 w-16 rounded-2xl object-cover border-2 border-primary/40 shadow-lg shadow-primary/20"
              />
            ) : (
              <div className="h-16 w-16 rounded-2xl bg-primary/20 border border-primary/40 grid place-items-center font-bold text-xl text-primary">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
            )}
            {user.isDev && (
              <span className="absolute -bottom-1 -right-1 bg-amber-500 text-black p-0.5 rounded-full ring-2 ring-background" title="Geliştirici">
                <Crown className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight">
                {user.globalName || user.username}
              </h2>
              {user.isDev && (
                <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10 text-[10px]">
                  Geliştirici
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Yönetebileceğiniz toplam {manageableGuilds.length} sunucu bulundu
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Button
            onClick={() => logout()}
            variant="outline"
            size="sm"
            className="w-full sm:w-auto text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            Çıkış Yap
          </Button>
        </div>
      </motion.div>

      {/* Quick Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="liquid-glass rounded-xl p-4 border border-border/60 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">Yönetilebilir Sunucular</p>
            <p className="text-xl font-bold mt-0.5">{manageableGuilds.length}</p>
          </div>
          <Server className="h-5 w-5 text-primary opacity-80" />
        </div>

        <div className="liquid-glass rounded-xl p-4 border border-emerald-500/30 bg-emerald-500/[0.03] flex items-center justify-between">
          <div>
            <p className="text-[11px] text-emerald-400 font-medium">Bot Sunucuda Aktif</p>
            <p className="text-xl font-bold text-emerald-400 mt-0.5">{botJoinedCount}</p>
          </div>
          <Bot className="h-5 w-5 text-emerald-400 opacity-80" />
        </div>

        <div className="liquid-glass rounded-xl p-4 border border-border/60 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">Bot Ekli Değil</p>
            <p className="text-xl font-bold text-muted-foreground mt-0.5">{missingBotCount}</p>
          </div>
          <Plus className="h-5 w-5 text-muted-foreground opacity-80" />
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-1.5 p-1 liquid-glass rounded-xl border border-border/60 w-fit">
          <button
            onClick={() => setFilterTab("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterTab === "all"
                ? "bg-primary/20 text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Tüm Sunucular ({manageableGuilds.length})
          </button>
          <button
            onClick={() => setFilterTab("bot")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterTab === "bot"
                ? "bg-emerald-500/20 text-emerald-400 font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Bot Ekli Olanlar ({botJoinedCount})
          </button>
          <button
            onClick={() => setFilterTab("no_bot")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterTab === "no_bot"
                ? "bg-primary/20 text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Bot Ekli Olmayanlar ({missingBotCount})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Sunucu adı ara..."
            className="pl-9 h-10 text-xs liquid-glass border-border/60"
          />
        </div>
      </div>

      {/* Servers Grid */}
      {filteredGuilds.length === 0 ? (
        <div className="liquid-glass rounded-2xl p-12 text-center border border-border/60">
          <Server className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h4 className="font-semibold text-base mb-1">Sunucu Bulunamadı</h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Filtreleme kriterlerinize uygun sunucu bulunamadı.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredGuilds.map((guild) => {
            const isBotInGuild = guild.botJoined;

            return (
              <motion.div
                key={guild.id}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <Card
                  className={`liquid-glass rounded-2xl transition-all duration-300 overflow-hidden h-full flex flex-col justify-between group ${
                    isBotInGuild
                      ? "border-emerald-500/40 bg-emerald-500/[0.02] hover:border-emerald-500/60 shadow-lg shadow-emerald-500/5"
                      : "border-border/60 hover:border-primary/40"
                  }`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      {guild.icon ? (
                        <img
                          src={guild.icon}
                          alt={guild.name}
                          className="h-14 w-14 rounded-2xl object-cover border border-border/80 group-hover:scale-105 transition-transform shrink-0"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-2xl bg-primary/15 border border-primary/30 grid place-items-center text-primary font-bold text-lg shrink-0">
                          {guild.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <h4 className="font-display font-semibold text-sm truncate" title={guild.name}>
                            {guild.name}
                          </h4>
                          {guild.owner && (
                            <span title="Sunucu Sahibi">
                              <Crown className="h-3 w-3 text-amber-400 shrink-0" />
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isBotInGuild ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-emerald-500/40 text-[11px] font-semibold py-0.5 px-2.5 flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                              Bot Sunucuda Aktif
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-border text-muted-foreground bg-muted/30 text-[11px] py-0.5 px-2.5">
                              Bot Ekli Değil
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>

                  <div className="px-5 pb-5 pt-0">
                    {isBotInGuild ? (
                      <Button
                        onClick={() => navigate(`/dashboard/${guild.id}`)}
                        className="w-full text-xs font-semibold h-9 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20"
                      >
                        <Settings className="h-3.5 w-3.5 mr-1.5" />
                        Sunucuyu Yönet
                      </Button>
                    ) : (
                      <a
                        href={guild.inviteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full inline-flex"
                      >
                        <Button
                          variant="outline"
                          className="w-full text-xs font-medium h-9 border-primary/40 text-foreground hover:bg-primary/10"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1.5 text-primary" />
                          Botu Sunucuya Ekle
                          <ExternalLink className="h-3 w-3 ml-1 opacity-60" />
                        </Button>
                      </a>
                    )}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
