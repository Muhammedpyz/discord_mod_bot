import { useState, useEffect } from "react";
import { Shield, Music, Check, Copy, ExternalLink, Sparkles, Sliders } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface InviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const InviteModal = ({ open, onOpenChange }: InviteModalProps) => {
  const [clientId, setClientId] = useState("1251278900055511070");
  const [selectedPreset, setSelectedPreset] = useState<"admin" | "mod" | "music">("admin");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data?.bot?.id) setClientId(data.bot.id);
      })
      .catch(() => {});
  }, []);

  const getPermissions = () => {
    switch (selectedPreset) {
      case "mod":
        return "1099511627798";
      case "music":
        return "36700160";
      case "admin":
      default:
        return "8";
    }
  };

  const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${getPermissions()}&scope=bot%20applications.commands`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md liquid-glass border border-primary/30 p-6 rounded-3xl shadow-2xl">
        <DialogHeader className="text-left">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Akıllı Davet Sihirbazı
          </span>
          <DialogTitle className="font-display font-bold text-2xl text-foreground mt-1">
            Yetkileri Seçin & Sunucuya Ekleyin
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Sunucunuzun güvenlik politikasına göre bota tanımak istediğiniz yetki kapsamını belirleyin.
          </DialogDescription>
        </DialogHeader>

        {/* Preset Cards */}
        <div className="mt-2 space-y-2.5">
          {[
            {
              id: "admin",
              title: "Tam Yetki / Önerilen (Yönetici)",
              desc: "Tüm sistemler (Rol hafızası, geçici odalar, loglama, bilet ve müzik) sorunsuz çalışır.",
              icon: Sparkles,
              badge: "En Yüksek Uyumluluk",
            },
            {
              id: "mod",
              title: "Yalnızca Moderasyon & Güvenlik",
              desc: "Ban, Kick, Mute, Rol ve Kanal yönetimi yetkileri tanımlanır. Ses ve müzik kısıtlanır.",
              icon: Shield,
              badge: "Güvenlik Odaklı",
            },
            {
              id: "music",
              title: "Yalnızca Müzik & Ses Odaları",
              desc: "Ses kanallarına bağlanma, konuşma ve geçici oda açma yetkisi verilir.",
              icon: Music,
              badge: "Eğlence",
            },
          ].map((preset) => {
            const Icon = preset.icon;
            const isSelected = selectedPreset === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => setSelectedPreset(preset.id as any)}
                className={`p-3.5 rounded-2xl cursor-pointer transition-all border text-left ${
                  isSelected
                    ? "bg-primary/15 border-primary shadow-[var(--shadow-glow)]"
                    : "bg-muted/30 border-border/50 hover:bg-muted/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-display font-semibold text-sm text-foreground">
                    <Icon className="h-4 w-4 text-primary" />
                    <span>{preset.title}</span>
                  </div>
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                    {preset.badge}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed pl-6">
                  {preset.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between gap-2">
          <Button
            variant="glass"
            size="sm"
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? "Kopyalandı!" : "Linki Kopyala"}</span>
          </Button>

          <Button asChild variant="hero" size="sm" className="text-xs px-5">
            <a href={inviteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5">
              <span>Discord'a Ekle</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
