import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Shield, Radio, Music, Cpu, 
  Lock, Unlock, Users, Edit3, Eye, EyeOff, 
  Play, Pause, SkipForward, Volume2, RotateCcw,
  Sparkles, Hash, CornerDownRight, Check, X, AlertTriangle,
  Server, RefreshCw, Terminal, Crown, Disc, Tv, UserMinus, Plus, Minus,
  ChevronDown, ExternalLink, Heart
} from "lucide-react";
import { siteConfig } from "@/config/site";
import { SplitTextReveal } from "@/components/reactbits/SplitTextReveal";

export const DiscordSimulator = () => {
  const [activeTab, setActiveTab] = useState<"odapanel" | "sorgu" | "sunucu-bilgi" | "bot-bilgi" | "nowplaying">("odapanel");
  const [liveData, setLiveData] = useState<any>(null);
  const [ephemeralNotice, setEphemeralNotice] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // odapanel dynamic states
  const [roomLocked, setRoomLocked] = useState(false);
  const [roomHidden, setRoomHidden] = useState(false);
  const [roomLimit, setRoomLimit] = useState(0); // 0 = Sınırsız
  const [streamAllowed, setStreamAllowed] = useState(true);
  const [roomClaimed, setRoomClaimed] = useState(false);

  // sorgu dynamic state
  const [sorguCategory, setSorguCategory] = useState("overview");

  // nowplaying dynamic states
  const [musicPlaying, setMusicPlaying] = useState(true);
  const [musicLoop, setMusicLoop] = useState<"none" | "track" | "queue">("track");
  const [musicLiked, setMusicLiked] = useState(false);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data) setLiveData(data);
      })
      .catch(() => {});
  }, []);

  const botAvatar = liveData?.bot?.avatar || "/favicon.png";
  const botName = liveData?.bot?.username || siteConfig.bot.name;
  const serverName = liveData?.serverCard?.name || "Topluluk Sunucusu";
  const memberCount = liveData?.serverCard?.memberCount || 34;
  const onlineCount = liveData?.serverCard?.onlineCount || 7;
  const boostCount = liveData?.serverCard?.boostCount || 16;
  const boostTier = liveData?.serverCard?.boostTier || 2;
  const serverCount = liveData?.stats?.servers || 2;
  const userCount = liveData?.stats?.users || 104;
  const commandCount = liveData?.stats?.commandCount || 76;
  const ping = liveData?.stats?.ping || 14;

  const triggerEphemeral = (msg: string) => {
    setEphemeralNotice(msg);
  };

  const copyToClipboard = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <section className="container max-w-6xl py-20 relative">
      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center max-w-3xl mx-auto"
      >
        <span className="text-xs font-semibold uppercase tracking-widest text-primary flex items-center justify-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-primary" />
          Birebir Gerçek Discord Arayüzü
        </span>
        <SplitTextReveal
          as="h2"
          text="Gerçek Discord Components V2 Canlı Çıktıları"
          className="mt-3 font-display font-bold text-4xl md:text-5xl tracking-tight"
        />
        <p className="mt-4 text-muted-foreground text-base">
          Botun Discord sunucunuzda gönderdiği **birebir gerçek Containers V2** yanıtlarını, buton dizilimlerini ve menülerini test edin.
        </p>
      </motion.div>

      {/* Real Command Navigation Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mt-10 flex flex-wrap items-center justify-center gap-2 max-w-4xl mx-auto"
      >
        {[
          { id: "odapanel", name: "/odapanel", label: "Özel Ses Odası Paneli", icon: Radio },
          { id: "sorgu", name: "/sorgu", label: "Kullanıcı Güvenlik & Sicil", icon: Shield },
          { id: "sunucu-bilgi", name: "/sunucu-bilgi", label: "Sunucu Kimlik & İstatistik", icon: Server },
          { id: "bot-bilgi", name: "/bot-bilgi", label: "Sistem & Altyapı Durumu", icon: Cpu },
          { id: "nowplaying", name: "/nowplaying", label: "Kayıpsız Müzik Çalar", icon: Music },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setEphemeralNotice(null);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs md:text-sm font-semibold transition-all duration-300 ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow)] scale-105"
                  : "liquid-glass text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.name}</span>
            </button>
          );
        })}
      </motion.div>

      {/* Discord Native Window Shell */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mt-8 max-w-4xl mx-auto rounded-2xl overflow-hidden border border-[#383a40] bg-[#313338] shadow-2xl font-sans text-left"
      >
        {/* Discord Window Header */}
        <div className="bg-[#2b2d31] px-4 py-3 border-b border-[#1f2023] flex items-center justify-between text-xs text-[#949ba4]">
          <div className="flex items-center gap-2.5">
            <Hash className="h-4.5 w-4.5 text-[#80848e]" />
            <span className="font-semibold text-white text-sm">sohbet-komut</span>
          </div>
        </div>

        {/* Discord Chat Area */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* User Slash Command Invocation */}
          <div className="flex items-center gap-2 text-xs text-[#949ba4] pl-3">
            <CornerDownRight className="h-3.5 w-3.5 text-[#5865f2]" />
            <div className="h-4 w-4 rounded-full overflow-hidden bg-[#5865f2] flex items-center justify-center text-[9px] font-bold text-white">
              M
            </div>
            <span className="font-semibold text-white">Muhammedpyz</span>
            <span>kullandı:</span>
            <button
              onClick={() => copyToClipboard(`/${activeTab}`)}
              className="inline-flex items-center gap-1 text-[#5865f2] bg-[#5865f2]/10 hover:bg-[#5865f2]/20 px-2 py-0.5 rounded font-mono font-medium transition-colors"
              title="Komutu kopyala"
            >
              <span>/{activeTab}</span>
              {copiedCmd === `/${activeTab}` ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : null}
            </button>
          </div>

          {/* Bot Response Message */}
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Bot Avatar */}
            <div className="relative shrink-0">
              <img
                src={botAvatar}
                alt={botName}
                className="h-10 w-10 rounded-full object-cover bg-background"
              />
              <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-[#23a55a] border-2 border-[#313338]" />
            </div>

            {/* Container and Controls Area */}
            <div className="flex-1 min-w-0 space-y-3">
              {/* Bot Tag & Header */}
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-white hover:underline cursor-pointer">
                  {botName}
                </span>
                <span className="bg-[#5865f2] text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 leading-none">
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                  APP
                </span>
                <span className="text-[11px] text-[#949ba4]">Bugün 15:45</span>
              </div>

              {/* ---------------------------------------------------- */}
              {/* TAB 1: REAL /odapanel (from utils/roomPanel.js) */}
              {/* ---------------------------------------------------- */}
              {activeTab === "odapanel" && (
                <div className="space-y-2">
                  <div className="rounded-[8px] bg-[#2b2d31] border border-[#383a40] p-4 sm:p-5 relative border-l-4 border-l-black shadow-lg">
                    {/* Header */}
                    <div className="flex items-center gap-2 text-white font-bold text-lg">
                      <Radio className="h-5 w-5 text-primary" />
                      <span>Özel Ses Odası Arayüzü</span>
                    </div>
                    <p className="text-xs text-[#dbdee1] mt-1">
                      Odanızı yönetmek ve erişim izinlerini düzenlemek için aşağıdaki kontrolleri kullanın.
                    </p>

                    {/* Separator */}
                    <div className="border-t border-[#3f4147] my-3.5" />

                    {/* Status Block */}
                    <div className="space-y-1.5 text-xs text-[#dbdee1]">
                      <div className="flex items-center gap-2">
                        <Crown className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                        <span className="font-semibold">Oda Sahibi ›</span>
                        <span className="bg-[#5865F2]/20 text-[#c9cdfb] px-1.5 py-0.5 rounded text-[11px] font-medium">
                          {roomClaimed ? "@Sen (Sahiplendin)" : "@Muhammedpyz"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="flex items-center gap-1.5">
                          {roomLocked ? (
                            <Lock className="h-3.5 w-3.5 text-red-400" />
                          ) : (
                            <Unlock className="h-3.5 w-3.5 text-emerald-400" />
                          )}
                          <span className="font-semibold">Kilit ›</span>
                          <code className="bg-[#1e1f22] px-1.5 py-0.5 rounded text-[11px] font-mono border border-[#383a40]">
                            {roomLocked ? "Kilitli" : "Herkese Açık"}
                          </code>
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1.5">
                          {roomHidden ? (
                            <EyeOff className="h-3.5 w-3.5 text-amber-400" />
                          ) : (
                            <Eye className="h-3.5 w-3.5 text-blue-400" />
                          )}
                          <span className="font-semibold">Görünürlük ›</span>
                          <code className="bg-[#1e1f22] px-1.5 py-0.5 rounded text-[11px] font-mono border border-[#383a40]">
                            {roomHidden ? "Gizli" : "Görünür"}
                          </code>
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-indigo-400" />
                          <span className="font-semibold">Kişi Limiti ›</span>
                          <code className="bg-[#1e1f22] px-1.5 py-0.5 rounded text-[11px] font-mono border border-[#383a40]">
                            {roomLimit === 0 ? "Sınırsız" : `${roomLimit} Kişi`}
                          </code>
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1.5">
                          <Tv className="h-3.5 w-3.5 text-purple-400" />
                          <span className="font-semibold">Yayın İzni ›</span>
                          <code className="bg-[#1e1f22] px-1.5 py-0.5 rounded text-[11px] font-mono border border-[#383a40]">
                            {streamAllowed ? "Serbest" : "Sadece Sahip"}
                          </code>
                        </span>
                      </div>
                    </div>

                    {/* Separator */}
                    <div className="border-t border-[#3f4147] my-3.5" />

                    {/* Subtext Tip */}
                    <div className="text-[11px] text-[#949ba4] italic flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>
                        Sahip ayrıldığında oda açık kalır; odadaki herhangi bir üye <strong>Sahiplen</strong> butonuyla odayı devralabilir.
                      </span>
                    </div>
                  </div>

                  {/* Real 3 ActionRows of Buttons (From roomPanel.js) */}
                  <div className="space-y-2 pt-1">
                    {/* Row 1: Access & Privacy */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => {
                          setRoomLocked(!roomLocked);
                          triggerEphemeral(!roomLocked ? "Oda başarıyla kilitlendi. Artık sadece izinli üyeler bağlanabilir." : "Oda kilidi açıldı. Herkes serbestçe katılabilir.");
                        }}
                        className="bg-[#4e5058] hover:bg-[#6d6f78] text-white text-xs font-semibold px-3.5 py-2 rounded-[4px] flex items-center gap-1.5 transition active:scale-95"
                      >
                        {roomLocked ? <Unlock className="h-3.5 w-3.5 text-emerald-300" /> : <Lock className="h-3.5 w-3.5" />}
                        <span>{roomLocked ? "Kilidi Aç" : "Kilitle"}</span>
                      </button>

                      <button
                        onClick={() => {
                          setRoomHidden(!roomHidden);
                          triggerEphemeral(!roomHidden ? "Oda sunucu kanal listesinde gizlendi." : "Oda sunucu kanal listesinde görünür hale getirildi.");
                        }}
                        className="bg-[#4e5058] hover:bg-[#6d6f78] text-white text-xs font-semibold px-3.5 py-2 rounded-[4px] flex items-center gap-1.5 transition active:scale-95"
                      >
                        {roomHidden ? <Eye className="h-3.5 w-3.5 text-blue-300" /> : <EyeOff className="h-3.5 w-3.5" />}
                        <span>{roomHidden ? "Göster" : "Gizle"}</span>
                      </button>

                      <button
                        onClick={() => {
                          setRoomClaimed(true);
                          triggerEphemeral("Odanın sahipliğini başarıyla devraldınız.");
                        }}
                        className="bg-[#4e5058] hover:bg-[#6d6f78] text-white text-xs font-semibold px-3.5 py-2 rounded-[4px] flex items-center gap-1.5 transition active:scale-95"
                      >
                        <Crown className="h-3.5 w-3.5 text-yellow-400" />
                        <span>Sahiplen</span>
                      </button>

                      <button
                        onClick={() => triggerEphemeral("Discord modalı açılır: Yeni oda ismini giriniz.")}
                        className="bg-[#4e5058] hover:bg-[#6d6f78] text-white text-xs font-semibold px-3.5 py-2 rounded-[4px] flex items-center gap-1.5 transition active:scale-95"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>İsim</span>
                      </button>
                    </div>

                    {/* Row 2: Member Management & Quick Limit */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => triggerEphemeral("Odadaki üyeleri atabileceğiniz seçim menüsü açılır.")}
                        className="bg-[#4e5058] hover:bg-[#6d6f78] text-white text-xs font-semibold px-3.5 py-2 rounded-[4px] flex items-center gap-1.5 transition active:scale-95"
                      >
                        <UserMinus className="h-3.5 w-3.5 text-red-300" />
                        <span>Üye At</span>
                      </button>

                      <button
                        onClick={() => {
                          setRoomLimit((prev) => prev + 1);
                          triggerEphemeral(`Oda limiti ${roomLimit + 1} olarak artırıldı.`);
                        }}
                        className="bg-[#4e5058] hover:bg-[#6d6f78] text-white text-xs font-semibold px-3.5 py-2 rounded-[4px] flex items-center gap-1.5 transition active:scale-95"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>+1 Limit</span>
                      </button>

                      <button
                        onClick={() => {
                          setRoomLimit((prev) => (prev > 0 ? prev - 1 : 0));
                          triggerEphemeral(roomLimit > 1 ? `Oda limiti ${roomLimit - 1} olarak azaltıldı.` : "Limit kaldırıldı.");
                        }}
                        className="bg-[#4e5058] hover:bg-[#6d6f78] text-white text-xs font-semibold px-3.5 py-2 rounded-[4px] flex items-center gap-1.5 transition active:scale-95"
                      >
                        <Minus className="h-3.5 w-3.5" />
                        <span>-1 Limit</span>
                      </button>

                      <button
                        onClick={() => triggerEphemeral("Discord modalı açılır: 0 ile 99 arasında bir kişi limiti yazınız.")}
                        className="bg-[#4e5058] hover:bg-[#6d6f78] text-white text-xs font-semibold px-3.5 py-2 rounded-[4px] flex items-center gap-1.5 transition active:scale-95"
                      >
                        <Users className="h-3.5 w-3.5" />
                        <span>Özel Limit</span>
                      </button>
                    </div>

                    {/* Row 3: Whitelist, Stream & Delete */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => triggerEphemeral("Beyaz liste menüsü açılır: Odaya serbestçe girebilecek VIP arkadaşlarınızı seçin.")}
                        className="bg-[#4e5058] hover:bg-[#6d6f78] text-white text-xs font-semibold px-3.5 py-2 rounded-[4px] flex items-center gap-1.5 transition active:scale-95"
                      >
                        <Shield className="h-3.5 w-3.5 text-indigo-300" />
                        <span>Beyaz Liste</span>
                      </button>

                      <button
                        onClick={() => {
                          setStreamAllowed(!streamAllowed);
                          triggerEphemeral(!streamAllowed ? "Yayın açma izni tüm üyelere verildi." : "Yayın izni kısıtlandı (Sadece sahip yayın açabilir).");
                        }}
                        className="bg-[#4e5058] hover:bg-[#6d6f78] text-white text-xs font-semibold px-3.5 py-2 rounded-[4px] flex items-center gap-1.5 transition active:scale-95"
                      >
                        <Tv className="h-3.5 w-3.5" />
                        <span>{streamAllowed ? "Yayını Kapat" : "Yayını Aç"}</span>
                      </button>

                      <button
                        onClick={() => triggerEphemeral("Özel oda ayarları ve ses izinleri kontrol paneli.")}
                        className="bg-[#4e5058] hover:bg-[#6d6f78] text-white text-xs font-semibold px-3.5 py-2 rounded-[4px] flex items-center gap-1.5 transition active:scale-95"
                      >
                        <span>Üye İzinleri</span>
                      </button>

                      <button
                        onClick={() => triggerEphemeral("Oda başarıyla kapatıldı ve silindi.")}
                        className="bg-[#da373c] hover:bg-[#a1282c] text-white text-xs font-semibold px-3.5 py-2 rounded-[4px] flex items-center gap-1.5 transition active:scale-95"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Odayı Kapat</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ---------------------------------------------------- */}
              {/* TAB 2: REAL /sorgu (from commands/moderation/sorgu.js) */}
              {/* ---------------------------------------------------- */}
              {activeTab === "sorgu" && (
                <div className="space-y-2">
                  <div className="rounded-[8px] bg-[#2b2d31] border border-[#383a40] p-4 sm:p-5 relative border-l-4 border-l-[#2B2D31] shadow-lg">
                    {/* Header */}
                    <div className="flex items-center gap-2 text-white font-bold text-lg">
                      <Shield className="h-5 w-5 text-indigo-400" />
                      <span>Kullanıcı Profil ve İstatistik Sorgusu</span>
                    </div>
                    <p className="text-xs text-[#dbdee1] mt-1">
                      <span className="bg-[#5865F2]/20 text-[#c9cdfb] px-1 py-0.5 rounded text-[11px]">@Muhammedpyz</span> kullanıcısının sunucu kayıtları, istatistikleri ve ceza dökümü aşağıda listelenmiştir.
                    </p>

                    {/* Discord Select Menu Mockup */}
                    <div className="mt-3 relative">
                      <div className="bg-[#1e1f22] border border-[#383a40] rounded-[4px] px-3 py-2 text-xs text-[#dbdee1] flex items-center justify-between">
                        <span>{sorguCategory === "overview" ? "Genel Bilgi & Özeti" : sorguCategory === "penalties" ? "Ceza Geçmişi" : "Ticket Geçmişi"}</span>
                        <ChevronDown className="h-3.5 w-3.5 text-[#80848e]" />
                      </div>
                    </div>

                    <div className="border-t border-[#3f4147] my-3.5" />

                    {/* Real Markdown Fields */}
                    <div className="space-y-3 text-xs text-[#dbdee1]">
                      {/* Section 1 */}
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5 mb-1">
                          <Users className="h-3.5 w-3.5 text-primary" />
                          <span>Hesap & Sunucu Bilgileri</span>
                        </div>
                        <div className="pl-5 space-y-0.5 text-[#b5bac1]">
                          <div>» <strong>Hesap Açılış:</strong> 5 yıl önce (21 Kasım 2019)</div>
                          <div>» <strong>Sunucuya Katılış:</strong> 1 yıl önce (15 Kasım 2024)</div>
                          <div>» <strong>İtibar Puanı:</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-white">15 rep</code></div>
                        </div>
                      </div>

                      {/* Section 2 */}
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5 mb-1">
                          <Crown className="h-3.5 w-3.5 text-yellow-400" />
                          <span>Davet İstatistikleri</span>
                        </div>
                        <div className="pl-5 space-y-0.5 text-[#b5bac1]">
                          <div>» <strong>Toplam Davet:</strong> <strong className="text-white">12</strong></div>
                          <div>» <strong>Detay:</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-emerald-400">10 giren</code> · <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-red-400">2 ayrılan</code> · <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono">0 sahte</code> · <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono">0 bonus</code></div>
                          <div>» <strong>Onu Davet Eden:</strong> <span className="bg-[#5865F2]/20 text-[#c9cdfb] px-1 py-0.5 rounded text-[11px]">Doğrudan Davet</span></div>
                        </div>
                      </div>

                      {/* Section 3 */}
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5 mb-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                          <span>Moderasyon & Ceza Geçmişi</span>
                        </div>
                        <div className="pl-5 space-y-0.5 text-[#b5bac1]">
                          <div>» <strong>Aktif Uyarı:</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-white">0 adet</code></div>
                          <div>» <strong>Toplam Uyarı:</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-white">0 adet</code></div>
                          <div>» <strong>Susturma (Mute):</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-white">0 adet</code></div>
                          <div>» <strong>Açtığı Destek Biletleri:</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-white">1 adet</code></div>
                        </div>
                      </div>

                      {/* Section 4 */}
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5 mb-1">
                          <Shield className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Sahip Olduğu Roller</span>
                        </div>
                        <div className="pl-5 flex flex-wrap gap-1 mt-1">
                          <span className="bg-[#5865F2]/15 text-[#5865f2] px-2 py-0.5 rounded font-medium inline-flex items-center gap-1 text-[11px]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#5865F2]" /> Developer
                          </span>
                          <span className="bg-red-500/15 text-red-400 px-2 py-0.5 rounded font-medium inline-flex items-center gap-1 text-[11px]">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> LİON
                          </span>
                          <span className="bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded font-medium inline-flex items-center gap-1 text-[11px]">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Yönetici
                          </span>
                          <span className="bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded font-medium inline-flex items-center gap-1 text-[11px]">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> VIP
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ---------------------------------------------------- */}
              {/* TAB 3: REAL /sunucu-bilgi (from commands/moderation/sunucu-bilgi.js) */}
              {/* ---------------------------------------------------- */}
              {activeTab === "sunucu-bilgi" && (
                <div className="space-y-2">
                  <div className="rounded-[8px] bg-[#2b2d31] border border-[#383a40] p-4 sm:p-5 relative border-l-4 border-l-[#2B2D31] shadow-lg">
                    {/* Header */}
                    <div className="flex items-center gap-2 text-white font-bold text-lg">
                      <Server className="h-5 w-5 text-indigo-400" />
                      <span>{serverName} | Sunucu Bilgileri</span>
                    </div>
                    <div className="border-l-4 border-[#4e5058] pl-2.5 my-2 text-xs text-[#949ba4] italic">
                      Sunucunun genel kimliği, güvenlik seviyesi, üye ve kanal dağılımı.
                    </div>

                    <div className="border-t border-[#3f4147] my-3.5" />

                    {/* Real Sections */}
                    <div className="space-y-3 text-xs text-[#dbdee1]">
                      {/* Identity */}
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5 mb-1">
                          <Crown className="h-3.5 w-3.5 text-yellow-400" />
                          <span>Genel Kimlik & Kuruluş</span>
                        </div>
                        <div className="pl-5 space-y-0.5 text-[#b5bac1]">
                          <div>» <strong>Sunucu Sahibi:</strong> <span className="bg-[#5865F2]/20 text-[#c9cdfb] px-1 py-0.5 rounded text-[11px]">@Muhammedpyz</span> (<code>muhammedpyz_</code>)</div>
                          <div>» <strong>Sunucu ID:</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-white">1441769969133293621</code></div>
                          <div>» <strong>Kuruluş Tarihi:</strong> 15 Kasım 2024 (1 yıl önce)</div>
                          <div>» <strong>Özel URL (Vanity):</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-primary">discord.gg/ymrEJTjqJ3</code></div>
                        </div>
                      </div>

                      {/* Population */}
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5 mb-1">
                          <Users className="h-3.5 w-3.5 text-indigo-400" />
                          <span>Nüfus & Üye Dağılımı</span>
                        </div>
                        <div className="pl-5 space-y-0.5 text-[#b5bac1]">
                          <div>» <strong>Toplam Nüfus:</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-white font-bold">{memberCount} üye</code></div>
                          <div>» <strong>Gerçek Kullanıcılar:</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-white">28 kişi (%82)</code></div>
                          <div>» <strong>Bot Sayısı:</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-white">6 bot (%18)</code></div>
                          <div>» <strong>Çevrimiçi Üye:</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-emerald-400 font-bold">{onlineCount} aktif</code></div>
                        </div>
                      </div>

                      {/* Channels & Boost */}
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5 mb-1">
                          <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                          <span>Güvenlik & Takviye (Boost)</span>
                        </div>
                        <div className="pl-5 space-y-0.5 text-[#b5bac1]">
                          <div>» <strong>Doğrulama Düzeyi:</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-white">Orta</code></div>
                          <div>» <strong>2FA Yönetici Güvenliği:</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-emerald-400">Aktif (Zorunlu)</code></div>
                          <div>» <strong>Takviye Durumu:</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-purple-400 font-bold">Seviye {boostTier}</code> ({boostCount} Takviye)</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Refresh Button */}
                  <button
                    onClick={() => triggerEphemeral("Sunucu istatistikleri ve üye sayıları MariaDB üzerinden yenilendi.")}
                    className="bg-[#4e5058] hover:bg-[#6d6f78] text-white text-xs font-semibold px-4 py-2 rounded-[4px] flex items-center gap-1.5 transition active:scale-95"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Yenile</span>
                  </button>
                </div>
              )}

              {/* ---------------------------------------------------- */}
              {/* TAB 4: REAL /bot-bilgi (from commands/moderation/bot-bilgi.js) */}
              {/* ---------------------------------------------------- */}
              {activeTab === "bot-bilgi" && (
                <div className="space-y-2">
                  <div className="rounded-[8px] bg-[#2b2d31] border border-[#383a40] p-4 sm:p-5 relative border-l-4 border-l-[#5865F2] shadow-lg">
                    {/* Header */}
                    <div className="flex items-center gap-2 text-white font-bold text-lg">
                      <Cpu className="h-5 w-5 text-indigo-400" />
                      <span>{botName} | Sistem Bilgisi & Durum</span>
                    </div>
                    <div className="border-l-4 border-[#4e5058] pl-2.5 my-2 text-xs text-[#949ba4] italic">
                      Yeni nesil all-in-one Discord güvenlik, moderasyon ve müzik botu.
                    </div>

                    <div className="border-t border-[#3f4147] my-3.5" />

                    {/* Real Sections */}
                    <div className="space-y-3 text-xs text-[#dbdee1]">
                      {/* Network & Scope */}
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5 mb-1">
                          <Server className="h-3.5 w-3.5 text-primary" />
                          <span>Ağ & Hizmet Kapsamı</span>
                        </div>
                        <div className="pl-5 space-y-0.5 text-[#b5bac1]">
                          <div>» <strong>Sunucu Sayısı:</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-white font-bold">{serverCount} sunucu</code></div>
                          <div>» <strong>Hizmet Edilen Kullanıcı:</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-white font-bold">{userCount} kişi</code></div>
                          <div>» <strong>Toplam Slash Komut:</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-primary font-bold">{commandCount} aktif komut</code></div>
                        </div>
                      </div>

                      {/* Performance */}
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5 mb-1">
                          <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
                          <span>Canlı Donanım & Performans</span>
                        </div>
                        <div className="pl-5 space-y-0.5 text-[#b5bac1]">
                          <div>» <strong>Uptime (Çalışma Süresi):</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-emerald-400">7 Gün 18 Saat</code></div>
                          <div>» <strong>Canlı Gateway Pingi:</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-emerald-400 font-bold">{ping} ms</code></div>
                          <div>» <strong>Bellek (RAM):</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-white">84 MB / 8 GB (%1.1)</code></div>
                        </div>
                      </div>

                      {/* Tech details */}
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5 mb-1">
                          <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Yazılım & Mimari Detayları</span>
                        </div>
                        <div className="pl-5 space-y-0.5 text-[#b5bac1]">
                          <div>» <strong>Bot Sahibi:</strong> <span className="bg-[#5865F2]/20 text-[#c9cdfb] px-1 py-0.5 rounded text-[11px]">@Muhammedpyz (651790387198820425)</span></div>
                          <div>» <strong>Node.js Sürümü:</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-white">v20.19.4</code></div>
                          <div>» <strong>Discord.js Sürümü:</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-primary">v14.27.0 (Components V2 Destekli)</code></div>
                          <div>» <strong>Veritabanı:</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-amber-400">MariaDB Relational (Havuzlu Önbellek)</code></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Refresh Button */}
                  <button
                    onClick={() => triggerEphemeral(`Canlı gecikme ölçüldü: ${ping}ms. MariaDB havuzları sağlıklı.`)}
                    className="bg-[#4e5058] hover:bg-[#6d6f78] text-white text-xs font-semibold px-4 py-2 rounded-[4px] flex items-center gap-1.5 transition active:scale-95"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Yenile</span>
                  </button>
                </div>
              )}

              {/* ---------------------------------------------------- */}
              {/* TAB 5: REAL /nowplaying (from utils/musicManager.js) */}
              {/* ---------------------------------------------------- */}
              {activeTab === "nowplaying" && (
                <div className="space-y-2">
                  <div className="rounded-[8px] bg-[#2b2d31] border border-[#383a40] p-4 sm:p-5 relative border-l-4 border-l-[#5865F2] shadow-lg">
                    {/* Header */}
                    <div className="flex items-center gap-2 text-white font-bold text-lg">
                      <Music className="h-5 w-5 text-indigo-400" />
                      <span>Şimdi Çalıyor</span>
                    </div>

                    <div className="border-t border-[#3f4147] my-3" />

                    {/* Track Info */}
                    <div className="space-y-1 text-xs text-[#dbdee1]">
                      <div>
                        <strong className="text-white">Şarkı: </strong>
                        <span className="text-[#5865f2] font-semibold hover:underline cursor-pointer">
                          Nyx Anthem (VIP Basswave Remix)
                        </span>
                      </div>
                      <div>
                        <strong>Sanatçı: </strong>
                        <span>Nyx Music Lab</span>
                      </div>
                      <div>
                        <strong>İsteyen: </strong>
                        <span className="bg-[#5865F2]/20 text-[#c9cdfb] px-1 py-0.5 rounded text-[11px]">@Muhammedpyz</span>
                      </div>
                      <div>
                        <strong>Süre: </strong>
                        <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-white">02:14 / 03:45</code>
                      </div>

                      {/* Progress Bar */}
                      <div className="py-2 flex items-center gap-3">
                        <div className="relative h-1.5 w-full bg-[#4e5058] rounded-full overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-[60%] bg-[#5865f2] rounded-full" />
                        </div>
                      </div>

                      {/* Flags */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>» <strong>Ses Seviyesi:</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-white">%100</code></div>
                        <div>» <strong>Ses Filtresi:</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-emerald-400">8D + BassBoost</code></div>
                        <div>» <strong>Döngü Modu:</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-white">{musicLoop === "track" ? "Şarkı" : musicLoop === "queue" ? "Sıra" : "Kapalı"}</code></div>
                        <div>» <strong>7/24 Kesintisiz:</strong> <code className="bg-[#1e1f22] px-1 py-0.5 rounded font-mono text-emerald-400">Aktif</code></div>
                      </div>
                    </div>
                  </div>

                  {/* Real Music Action Row (5 Buttons from musicManager.js) */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <button
                      onClick={() => {
                        setMusicPlaying(!musicPlaying);
                        triggerEphemeral(!musicPlaying ? "Müzik devam ettiriliyor." : "Müzik duraklatıldı.");
                      }}
                      className={`${
                        musicPlaying ? "bg-[#4e5058] hover:bg-[#6d6f78]" : "bg-[#248046] hover:bg-[#1a6334]"
                      } text-white text-xs font-semibold px-3.5 py-2 rounded-[4px] flex items-center gap-1.5 transition active:scale-95`}
                    >
                      {musicPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      <span>{musicPlaying ? "Duraklat" : "Devam Et"}</span>
                    </button>

                    <button
                      onClick={() => triggerEphemeral("Sıradaki parçaya geçildi: Nyx Lo-Fi Beats.")}
                      className="bg-[#4e5058] hover:bg-[#6d6f78] text-white text-xs font-semibold px-3.5 py-2 rounded-[4px] flex items-center gap-1.5 transition active:scale-95"
                    >
                      <SkipForward className="h-3.5 w-3.5" />
                      <span>Geç</span>
                    </button>

                    <button
                      onClick={() => {
                        const next = musicLoop === "none" ? "track" : musicLoop === "track" ? "queue" : "none";
                        setMusicLoop(next);
                        triggerEphemeral(`Döngü modu: ${next === "track" ? "Şarkı Döngüsü" : next === "queue" ? "Sıra Döngüsü" : "Kapatıldı"}`);
                      }}
                      className={`${
                        musicLoop !== "none" ? "bg-[#5865F2] hover:bg-[#4752C4]" : "bg-[#4e5058] hover:bg-[#6d6f78]"
                      } text-white text-xs font-semibold px-3.5 py-2 rounded-[4px] flex items-center gap-1.5 transition active:scale-95`}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>{musicLoop === "track" ? "Şarkı Döngüsü" : musicLoop === "queue" ? "Sıra Döngüsü" : "Döngü"}</span>
                    </button>

                    <button
                      onClick={() => {
                        setMusicLiked(!musicLiked);
                        triggerEphemeral(!musicLiked ? "Şarkı favori çalma listenize eklendi." : "Şarkı favorilerinizden çıkarıldı.");
                      }}
                      className={`${
                        musicLiked ? "bg-[#da373c] hover:bg-[#a1282c]" : "bg-[#4e5058] hover:bg-[#6d6f78]"
                      } text-white text-xs font-semibold px-3.5 py-2 rounded-[4px] flex items-center gap-1.5 transition active:scale-95`}
                    >
                      <Heart className="h-3.5 w-3.5" />
                      <span>Beğen</span>
                    </button>

                    <button
                      onClick={() => triggerEphemeral("Müzik durduruldu ve bot ses kanalından ayrıldı.")}
                      className="bg-[#da373c] hover:bg-[#a1282c] text-white text-xs font-semibold px-3.5 py-2 rounded-[4px] flex items-center gap-1.5 transition active:scale-95"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Durdur & Çık</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Ephemeral Discord Notification Simulation */}
              <AnimatePresence>
                {ephemeralNotice && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex items-center justify-between gap-3 text-xs bg-[#2b2d31]/95 border border-[#383a40] text-[#dbdee1] p-3 rounded-lg shadow-lg mt-2"
                  >
                    <div className="flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-[#f0b232] shrink-0" />
                      <div>
                        <span className="font-semibold text-white block text-[11px]">
                          Yalnızca sen görebilirsin
                        </span>
                        <span className="text-[#dbdee1] text-xs">{ephemeralNotice}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setEphemeralNotice(null)}
                      className="text-[#949ba4] hover:text-white text-[11px] hover:underline shrink-0"
                    >
                      Kapat
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Discord Chat Input Bar */}
        <div className="bg-[#383a40]/60 p-4 border-t border-[#1f2023] flex items-center text-xs text-[#80848e]">
          <div className="flex items-center gap-2 w-full bg-[#383a40] px-3.5 py-2.5 rounded-lg text-[#949ba4]">
            <span className="text-white font-mono font-medium">#sohbet-komut</span>
            <span className="text-[#80848e]">kanalına mesaj gönder</span>
          </div>
        </div>
      </motion.div>
    </section>
  );
};
