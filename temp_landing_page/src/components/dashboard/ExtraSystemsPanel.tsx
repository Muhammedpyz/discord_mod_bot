import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Star, Cake, PenTool, Coins, UserCheck, ShieldCheck, Hash, Tag, Plus, Trash2, Save, Loader2,
  Type, Radio, Image as ImageIcon, Award, Megaphone, AlertTriangle, Vote,
  ScrollText, Link2, ClipboardList, Users, Calendar, Timer, Crown
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  RoleSelect,
  ChannelSelect,
  MultiChannelSelect,
  MultiRoleSelect,
  CustomSelect,
  type Role,
  type Channel
} from "@/components/dashboard/DiscordSelectors";

type Props = {
  guildId: string;
  configs: any;
  setConfigs: (next: any) => void;
  textChannels: Channel[];
  voiceChannels: Channel[];
  roles: Role[];
  saveConfigModule: (moduleName: string, data: any) => Promise<void> | void;
  savingModule: string | null;
  onRefresh?: () => void;
};

export function ExtraSystemsPanel({
  guildId,
  configs,
  setConfigs,
  textChannels,
  voiceChannels,
  roles,
  saveConfigModule,
  savingModule,
  onRefresh
}: Props) {
  const { toast } = useToast();
  const starboard = configs?.starboard || { enabled: 0, channel_id: null, emoji: "⭐", threshold: 3, self_star_allowed: 0 };
  const birthday = configs?.birthday || { enabled: 0, channel_id: null, message_template: "İyi ki doğdun {user}! 🎉", temp_role_id: null };
  const kayit = configs?.kayit || {};
  const dogrulama = configs?.dogrulama || { enabled: 0, channel_id: null, role_id: null };
  const sayac = configs?.sayac || { enabled: 0, channel_id: null, hedef: 1000, sablon: "Uye: {sayi}/{hedef}" };
  const stickyMessages = configs?.stickyMessages || [];
  const economyShop = configs?.economyShop || [];
  const reactionPanels = configs?.reactionPanels || [];
  const autobump = configs?.autobump || { is_enabled: 0, channel_id: null, ping_role_id: null };
  const mediaChannels = configs?.mediaChannels || [];
  const prefixes = configs?.prefixes || ["!"];
  const levelRewards = configs?.levelRewards || [];
  const socialSubscriptions = configs?.socialSubscriptions || [];
  const warnActions = configs?.warnActions || [];
  const polls = configs?.polls || [];
  const kurallar = configs?.kurallar || { channel_id: null, metin: "", rol_id: null };
  const tanitim = configs?.tanitim || { channel_id: null, cooldown_hours: 6 };
  const oy = configs?.oy || { vote_url: "", odul: 200 };
  const staffApp = configs?.staffApp || {};
  const creatorApp = configs?.creatorApp || {};
  const staffPanel = configs?.staffPanel || {};
  const etkinlikler = configs?.etkinlikler || [];
  const countdowns = configs?.countdowns || [];

  const [prefixInput, setPrefixInput] = useState(prefixes[0] || "!");
  useEffect(() => {
    setPrefixInput(prefixes[0] || "!");
  }, [prefixes[0]]);

  const [stickyChannel, setStickyChannel] = useState("");
  const [stickyContent, setStickyContent] = useState("");
  const [stickyBusy, setStickyBusy] = useState(false);

  const [shopName, setShopName] = useState("");
  const [shopPrice, setShopPrice] = useState("500");
  const [shopRole, setShopRole] = useState("");
  const [shopBusy, setShopBusy] = useState(false);

  const [rrTitle, setRrTitle] = useState("");
  const [rrDesc, setRrDesc] = useState("");
  const [rrChannel, setRrChannel] = useState("");
  const [rrMode, setRrMode] = useState<"multiple" | "single">("multiple");
  const [rrLabel, setRrLabel] = useState("");
  const [rrRole, setRrRole] = useState("");
  const [rrBusy, setRrBusy] = useState(false);

  const [rewardLevel, setRewardLevel] = useState("10");
  const [rewardRole, setRewardRole] = useState("");
  const [rewardBusy, setRewardBusy] = useState(false);

  const [socialPlatform, setSocialPlatform] = useState("youtube");
  const [socialIdent, setSocialIdent] = useState("");
  const [socialChannel, setSocialChannel] = useState("");
  const [socialTemplate, setSocialTemplate] = useState("");
  const [socialBusy, setSocialBusy] = useState(false);

  const [warnCount, setWarnCount] = useState("3");
  const [warnAction, setWarnAction] = useState("mute");
  const [warnDuration, setWarnDuration] = useState("60");
  const [warnBusy, setWarnBusy] = useState(false);

  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState("");
  const [pollChannel, setPollChannel] = useState("");
  const [pollHours, setPollHours] = useState("24");
  const [pollMultiple, setPollMultiple] = useState(false);
  const [pollAnon, setPollAnon] = useState(false);
  const [pollBusy, setPollBusy] = useState(false);

  const [etkBaslik, setEtkBaslik] = useState("");
  const [etkAciklama, setEtkAciklama] = useState("");
  const [etkZaman, setEtkZaman] = useState("");
  const [etkChannel, setEtkChannel] = useState("");
  const [etkBusy, setEtkBusy] = useState(false);

  const [cdBaslik, setCdBaslik] = useState("");
  const [cdMinutes, setCdMinutes] = useState("60");
  const [cdChannel, setCdChannel] = useState("");
  const [cdBusy, setCdBusy] = useState(false);

  const patch = (key: string, value: any) => setConfigs({ ...configs, [key]: value });

  const handleStickySave = async () => {
    if (!stickyChannel || !stickyContent.trim()) {
      return toast({ title: "Eksik bilgi", description: "Kanal ve içerik zorunlu.", variant: "destructive" });
    }
    setStickyBusy(true);
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/sticky`, {
        method: "POST",
        body: JSON.stringify({ channel_id: stickyChannel, content: stickyContent.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kayıt başarısız");
      toast({ title: "Yapışkan mesaj kaydedildi" });
      setStickyContent("");
      onRefresh?.();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setStickyBusy(false);
    }
  };

  const handleStickyDelete = async (channelId: string) => {
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/sticky/${channelId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Silinemedi");
      }
      toast({ title: "Yapışkan mesaj silindi" });
      onRefresh?.();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    }
  };

  const handleShopAdd = async () => {
    if (!shopName || !shopPrice || !shopRole) {
      return toast({ title: "Eksik bilgi", description: "İsim, fiyat ve rol gerekli.", variant: "destructive" });
    }
    setShopBusy(true);
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/economy-shop`, {
        method: "POST",
        body: JSON.stringify({
          name: shopName,
          price: Number(shopPrice),
          role_id: shopRole,
          item_type: "role"
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eklenemedi");
      toast({ title: "Market ürünü eklendi" });
      setShopName("");
      setShopPrice("500");
      setShopRole("");
      onRefresh?.();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setShopBusy(false);
    }
  };

  const handleShopDelete = async (itemId: number) => {
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/economy-shop/${itemId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Silinemedi");
      toast({ title: "Ürün silindi" });
      onRefresh?.();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    }
  };

  const handleRrCreate = async () => {
    if (!rrTitle || !rrChannel || !rrLabel || !rrRole) {
      return toast({ title: "Eksik bilgi", description: "Başlık, kanal, buton yazısı ve rol zorunlu.", variant: "destructive" });
    }
    setRrBusy(true);
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/reaction-panels`, {
        method: "POST",
        body: JSON.stringify({
          title: rrTitle,
          description: rrDesc,
          channel_id: rrChannel,
          mode: rrMode,
          options: [{ label: rrLabel, role_id: rrRole, style: "Primary" }]
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Panel oluşturulamadı");
      toast({ title: "Buton-rol paneli yayınlandı", description: `Panel ID: ${data.id}` });
      setRrTitle("");
      setRrDesc("");
      setRrLabel("");
      setRrRole("");
      onRefresh?.();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setRrBusy(false);
    }
  };

  const handleRrDelete = async (panelId: number) => {
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/reaction-panels/${panelId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Silinemedi");
      toast({ title: "Panel silindi" });
      onRefresh?.();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    }
  };

  const handleRewardAdd = async () => {
    if (!rewardLevel || !rewardRole) {
      return toast({ title: "Eksik bilgi", description: "Seviye ve rol gerekli.", variant: "destructive" });
    }
    setRewardBusy(true);
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/level-rewards`, {
        method: "POST",
        body: JSON.stringify({ level: Number(rewardLevel), role_id: rewardRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eklenemedi");
      toast({ title: "Seviye ödülü eklendi" });
      setRewardRole("");
      onRefresh?.();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setRewardBusy(false);
    }
  };

  const handleRewardDelete = async (id: number) => {
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/level-rewards/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Silinemedi");
      toast({ title: "Ödül silindi" });
      onRefresh?.();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    }
  };

  const handleSocialAdd = async () => {
    if (!socialIdent || !socialChannel) {
      return toast({ title: "Eksik bilgi", description: "Kimlik ve kanal zorunlu.", variant: "destructive" });
    }
    setSocialBusy(true);
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/social`, {
        method: "POST",
        body: JSON.stringify({
          platform: socialPlatform,
          channel_identifier: socialIdent,
          discord_channel_id: socialChannel,
          message_template: socialTemplate || null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eklenemedi");
      toast({ title: "Sosyal abonelik eklendi" });
      setSocialIdent("");
      setSocialTemplate("");
      onRefresh?.();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setSocialBusy(false);
    }
  };

  const handleSocialDelete = async (id: number) => {
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/social/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Silinemedi");
      toast({ title: "Abonelik silindi" });
      onRefresh?.();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    }
  };

  const handleWarnAdd = async () => {
    setWarnBusy(true);
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/warn-actions`, {
        method: "POST",
        body: JSON.stringify({
          warn_count: Number(warnCount),
          action: warnAction,
          duration: Number(warnDuration) || 0
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eklenemedi");
      toast({ title: "Otomatik ceza kuralı eklendi" });
      onRefresh?.();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setWarnBusy(false);
    }
  };

  const handleWarnDelete = async (id: number) => {
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/warn-actions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Silinemedi");
      toast({ title: "Kural silindi" });
      onRefresh?.();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    }
  };

  const handlePollCreate = async () => {
    const opts = pollOptions.split("\n").map((o) => o.trim()).filter(Boolean);
    if (!pollQuestion || !pollChannel || opts.length < 2) {
      return toast({ title: "Eksik bilgi", description: "Soru, kanal ve en az 2 seçenek gerekli.", variant: "destructive" });
    }
    setPollBusy(true);
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/polls`, {
        method: "POST",
        body: JSON.stringify({
          question: pollQuestion,
          channel_id: pollChannel,
          options: opts,
          multiple_choice: pollMultiple,
          anonymous: pollAnon,
          duration_hours: pollHours ? Number(pollHours) : null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Anket oluşturulamadı");
      toast({ title: "Anket yayınlandı", description: `ID: ${data.id}` });
      setPollQuestion("");
      setPollOptions("");
      onRefresh?.();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setPollBusy(false);
    }
  };

  const handlePollClose = async (id: number) => {
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/polls/${id}/close`, { method: "POST" });
      if (!res.ok) throw new Error("Kapatılamadı");
      toast({ title: "Anket kapatıldı" });
      onRefresh?.();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    }
  };

  const handleEtkCreate = async () => {
    if (!etkBaslik || !etkChannel) {
      return toast({ title: "Eksik bilgi", description: "Başlık ve kanal zorunlu.", variant: "destructive" });
    }
    setEtkBusy(true);
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/etkinlikler`, {
        method: "POST",
        body: JSON.stringify({ baslik: etkBaslik, aciklama: etkAciklama, zaman: etkZaman, channel_id: etkChannel })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Oluşturulamadı");
      toast({ title: "Etkinlik yayınlandı", description: `ID: ${data.id}` });
      setEtkBaslik("");
      setEtkAciklama("");
      setEtkZaman("");
      onRefresh?.();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setEtkBusy(false);
    }
  };

  const handleEtkCancel = async (id: number) => {
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/etkinlikler/${id}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error("İptal edilemedi");
      toast({ title: "Etkinlik iptal edildi" });
      onRefresh?.();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    }
  };

  const handleCdCreate = async () => {
    if (!cdBaslik || !cdChannel || !cdMinutes) {
      return toast({ title: "Eksik bilgi", description: "Başlık, kanal ve süre zorunlu.", variant: "destructive" });
    }
    setCdBusy(true);
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/countdowns`, {
        method: "POST",
        body: JSON.stringify({ baslik: cdBaslik, channel_id: cdChannel, minutes: Number(cdMinutes) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Başlatılamadı");
      toast({ title: "Geri sayım başladı" });
      setCdBaslik("");
      onRefresh?.();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setCdBusy(false);
    }
  };

  const handleCdCancel = async (id: number) => {
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/countdowns/${id}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error("İptal edilemedi");
      toast({ title: "Geri sayım iptal edildi" });
      onRefresh?.();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    }
  };

  const SaveBtn = ({ module, data, label = "Kaydet" }: { module: string; data: any; label?: string }) => (
    <Button
      size="sm"
      className="w-full"
      disabled={savingModule === module}
      onClick={() => saveConfigModule(module, data)}
    >
      {savingModule === module ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
      {savingModule === module ? "Kaydediliyor..." : label}
    </Button>
  );

  return (
    <Tabs defaultValue="starboard" className="w-full">
      <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/40 p-1 mb-4">
        <TabsTrigger value="starboard" className="text-xs">Starboard</TabsTrigger>
        <TabsTrigger value="birthday" className="text-xs">Doğum Günü</TabsTrigger>
        <TabsTrigger value="kayit" className="text-xs">Kayıt</TabsTrigger>
        <TabsTrigger value="dogrulama" className="text-xs">Doğrulama</TabsTrigger>
        <TabsTrigger value="sayac" className="text-xs">Sayaç</TabsTrigger>
        <TabsTrigger value="sticky" className="text-xs">Yapışkan</TabsTrigger>
        <TabsTrigger value="economy" className="text-xs">Market</TabsTrigger>
        <TabsTrigger value="roles" className="text-xs">Buton Rol</TabsTrigger>
        <TabsTrigger value="prefix" className="text-xs">Prefix</TabsTrigger>
        <TabsTrigger value="autobump" className="text-xs">Autobump</TabsTrigger>
        <TabsTrigger value="media" className="text-xs">Medya</TabsTrigger>
        <TabsTrigger value="levels" className="text-xs">Seviye Ödül</TabsTrigger>
        <TabsTrigger value="social" className="text-xs">Sosyal</TabsTrigger>
        <TabsTrigger value="warns" className="text-xs">Warn Oto</TabsTrigger>
        <TabsTrigger value="polls" className="text-xs">Anket</TabsTrigger>
        <TabsTrigger value="kurallar" className="text-xs">Kurallar</TabsTrigger>
        <TabsTrigger value="tanitim" className="text-xs">Tanıtım</TabsTrigger>
        <TabsTrigger value="oy" className="text-xs">Oy Ödül</TabsTrigger>
        <TabsTrigger value="staff_app" className="text-xs">Yetkili Başvuru</TabsTrigger>
        <TabsTrigger value="creator_app" className="text-xs">Creator</TabsTrigger>
        <TabsTrigger value="staff_panel" className="text-xs">Yetkili Pano</TabsTrigger>
        <TabsTrigger value="etkinlik" className="text-xs">Etkinlik</TabsTrigger>
        <TabsTrigger value="countdown" className="text-xs">Geri Sayım</TabsTrigger>
      </TabsList>

      <TabsContent value="starboard">
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" />
                Starboard
              </CardTitle>
              <Switch
                checked={!!starboard.enabled}
                onCheckedChange={(v) => patch("starboard", { ...starboard, enabled: v ? 1 : 0 })}
              />
            </div>
            <CardDescription className="text-xs">Yeterli yıldız alan mesajlar seçilen kanala taşınır.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Pano Kanalı</Label>
              <ChannelSelect
                value={starboard.channel_id || ""}
                onChange={(val) => patch("starboard", { ...starboard, channel_id: val || null })}
                channels={textChannels}
                disabled={!starboard.enabled}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Eşik</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={starboard.threshold ?? 3}
                  disabled={!starboard.enabled}
                  onChange={(e) => patch("starboard", { ...starboard, threshold: Number(e.target.value) || 3 })}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Emoji</Label>
                <Input
                  value={starboard.emoji || "⭐"}
                  disabled={!starboard.enabled}
                  onChange={(e) => patch("starboard", { ...starboard, emoji: e.target.value })}
                  className="h-8"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
              <Label className="text-xs">Kendi mesajına yıldız</Label>
              <Switch
                checked={!!starboard.self_star_allowed}
                disabled={!starboard.enabled}
                onCheckedChange={(v) => patch("starboard", { ...starboard, self_star_allowed: v ? 1 : 0 })}
              />
            </div>
            <SaveBtn module="starboard" data={starboard} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="birthday">
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Cake className="w-4 h-4 text-pink-400" />
                Doğum Günü
              </CardTitle>
              <Switch
                checked={!!birthday.enabled}
                onCheckedChange={(v) => patch("birthday", { ...birthday, enabled: v ? 1 : 0 })}
              />
            </div>
            <CardDescription className="text-xs">Üye doğum günlerinde otomatik kutlama mesajı gönderir.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Kutlama Kanalı</Label>
              <ChannelSelect
                value={birthday.channel_id || ""}
                onChange={(val) => patch("birthday", { ...birthday, channel_id: val || null })}
                channels={textChannels}
                disabled={!birthday.enabled}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Geçici Rol (opsiyonel)</Label>
              <RoleSelect
                value={birthday.temp_role_id || ""}
                onChange={(val) => patch("birthday", { ...birthday, temp_role_id: val || null })}
                roles={roles}
                disabled={!birthday.enabled}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mesaj Şablonu</Label>
              <Input
                value={birthday.message_template || ""}
                disabled={!birthday.enabled}
                onChange={(e) => patch("birthday", { ...birthday, message_template: e.target.value })}
                className="h-8"
                placeholder="İyi ki doğdun {user}!"
              />
            </div>
            <SaveBtn module="birthday" data={birthday} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="kayit">
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-sky-400" />
              Kayıt Sistemi
            </CardTitle>
            <CardDescription className="text-xs">Kayıtsız / cinsiyet rolleri ve kayıt log kanalı.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Kayıtsız Rol</Label>
                <RoleSelect value={kayit.kayitsiz_role_id || ""} onChange={(v) => patch("kayit", { ...kayit, kayitsiz_role_id: v || null })} roles={roles} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Yetkili Rol</Label>
                <RoleSelect value={kayit.yetkili_role_id || ""} onChange={(v) => patch("kayit", { ...kayit, yetkili_role_id: v || null })} roles={roles} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Erkek Rol</Label>
                <RoleSelect value={kayit.erkek_role_id || ""} onChange={(v) => patch("kayit", { ...kayit, erkek_role_id: v || null })} roles={roles} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Kız Rol</Label>
                <RoleSelect value={kayit.kiz_role_id || ""} onChange={(v) => patch("kayit", { ...kayit, kiz_role_id: v || null })} roles={roles} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Log Kanalı</Label>
              <ChannelSelect value={kayit.log_channel_id || ""} onChange={(v) => patch("kayit", { ...kayit, log_channel_id: v || null })} channels={textChannels} />
            </div>
            <SaveBtn module="kayit" data={kayit} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="dogrulama">
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Doğrulama Paneli
              </CardTitle>
              <Switch
                checked={!!dogrulama.enabled}
                onCheckedChange={(v) => patch("dogrulama", { ...dogrulama, enabled: v ? 1 : 0 })}
              />
            </div>
            <CardDescription className="text-xs">Kaydettiğinizde Discord kanalına doğrulama butonu yayınlanır.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Panel Kanalı</Label>
              <ChannelSelect
                value={dogrulama.channel_id || ""}
                onChange={(v) => patch("dogrulama", { ...dogrulama, channel_id: v || null })}
                channels={textChannels}
                disabled={!dogrulama.enabled}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Doğrulanan Rol</Label>
              <RoleSelect
                value={dogrulama.role_id || ""}
                onChange={(v) => patch("dogrulama", { ...dogrulama, role_id: v || null })}
                roles={roles}
                disabled={!dogrulama.enabled}
              />
            </div>
            <SaveBtn module="dogrulama" data={{ ...dogrulama, publish: true }} label="Kaydet & Yayınla" />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="sayac">
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Hash className="w-4 h-4 text-violet-400" />
                Üye Sayaç
              </CardTitle>
              <Switch
                checked={!!sayac.enabled}
                onCheckedChange={(v) => patch("sayac", { ...sayac, enabled: v ? 1 : 0 })}
              />
            </div>
            <CardDescription className="text-xs">Ses kanalı ismini üye sayısına göre otomatik günceller.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Sayaç Kanalı (ses)</Label>
              <ChannelSelect
                value={sayac.channel_id || ""}
                onChange={(v) => patch("sayac", { ...sayac, channel_id: v || null })}
                channels={voiceChannels.length ? voiceChannels : textChannels}
                disabled={!sayac.enabled}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Hedef</Label>
                <Input
                  type="number"
                  min={10}
                  value={sayac.hedef ?? 1000}
                  disabled={!sayac.enabled}
                  onChange={(e) => patch("sayac", { ...sayac, hedef: Number(e.target.value) || 1000 })}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Şablon</Label>
                <Input
                  value={sayac.sablon || ""}
                  disabled={!sayac.enabled}
                  onChange={(e) => patch("sayac", { ...sayac, sablon: e.target.value })}
                  className="h-8"
                  placeholder="Uye: {sayi}/{hedef}"
                />
              </div>
            </div>
            <SaveBtn module="sayac" data={sayac} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="sticky" className="space-y-4">
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PenTool className="w-4 h-4 text-emerald-400" />
              Yapışkan Mesaj
            </CardTitle>
            <CardDescription className="text-xs">Kanalda her zaman en altta kalan duyuru mesajı.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Kanal</Label>
              <ChannelSelect value={stickyChannel} onChange={setStickyChannel} channels={textChannels} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">İçerik</Label>
              <Textarea value={stickyContent} onChange={(e) => setStickyContent(e.target.value)} rows={3} placeholder="Lütfen kurallara uyun..." />
            </div>
            <Button size="sm" className="w-full" disabled={stickyBusy} onClick={handleStickySave}>
              {stickyBusy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
              Kaydet
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {stickyMessages.length === 0 && (
            <p className="text-xs text-muted-foreground">Henüz yapışkan mesaj yok.</p>
          )}
          {stickyMessages.map((s: any) => (
            <div key={s.channel_id} className="flex items-start justify-between gap-3 rounded-xl border border-border/50 p-3 text-xs">
              <div>
                <div className="font-medium">#{textChannels.find((c) => c.id === s.channel_id)?.name || s.channel_id}</div>
                <div className="text-muted-foreground mt-1 line-clamp-2">{s.content}</div>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleStickyDelete(s.channel_id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="economy" className="space-y-4">
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-500" />
              Ekonomi Marketi
            </CardTitle>
            <CardDescription className="text-xs">
              Günlük ödül globaldir (30–60 + streak). Buradan sunucu marketine rol ürünü ekleyebilirsiniz.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Ürün Adı</Label>
                <Input value={shopName} onChange={(e) => setShopName(e.target.value)} className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fiyat</Label>
                <Input type="number" min={1} value={shopPrice} onChange={(e) => setShopPrice(e.target.value)} className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rol</Label>
                <RoleSelect value={shopRole} onChange={setShopRole} roles={roles} />
              </div>
            </div>
            <Button size="sm" className="w-full" disabled={shopBusy} onClick={handleShopAdd}>
              {shopBusy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
              Ürün Ekle
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {economyShop.length === 0 && <p className="text-xs text-muted-foreground">Market boş.</p>}
          {economyShop.map((item: any) => (
            <div key={item.id} className="flex items-center justify-between rounded-xl border border-border/50 p-3 text-xs">
              <div>
                <div className="font-medium">{item.name} — {Number(item.price).toLocaleString("tr-TR")} Jeton</div>
                <div className="text-muted-foreground">
                  Rol: @{roles.find((r) => r.id === item.role_id)?.name || item.role_id || "—"}
                </div>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleShopDelete(item.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="roles" className="space-y-4">
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-4 h-4 text-indigo-400" />
              Buton Rol Paneli
            </CardTitle>
            <CardDescription className="text-xs">Yeni panel oluşturup Discord kanalına buton olarak yayınlar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Başlık</Label>
                <Input value={rrTitle} onChange={(e) => setRrTitle(e.target.value)} className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Kanal</Label>
                <ChannelSelect value={rrChannel} onChange={setRrChannel} channels={textChannels} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Açıklama</Label>
              <Input value={rrDesc} onChange={(e) => setRrDesc(e.target.value)} className="h-8" />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Buton Yazısı</Label>
                <Input value={rrLabel} onChange={(e) => setRrLabel(e.target.value)} className="h-8" placeholder="VIP Al" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Verilecek Rol</Label>
                <RoleSelect value={rrRole} onChange={setRrRole} roles={roles} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
              <Label className="text-xs">Çoklu rol seçimi</Label>
              <Switch checked={rrMode === "multiple"} onCheckedChange={(v) => setRrMode(v ? "multiple" : "single")} />
            </div>
            <Button size="sm" className="w-full" disabled={rrBusy} onClick={handleRrCreate}>
              {rrBusy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
              Panel Oluştur & Yayınla
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {reactionPanels.length === 0 && <p className="text-xs text-muted-foreground">Aktif panel yok.</p>}
          {reactionPanels.map((p: any) => (
            <div key={p.id} className="rounded-xl border border-border/50 p-3 text-xs space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">#{p.id} — {p.title}</div>
                  <div className="text-muted-foreground">
                    #{textChannels.find((c) => c.id === p.channel_id)?.name || p.channel_id} · {p.mode} · {(p.options || []).length} seçenek
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleRrDelete(p.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {(p.options || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {p.options.map((o: any) => (
                    <span key={o.id} className="rounded-md bg-muted px-2 py-0.5">
                      {o.label} → @{roles.find((r) => r.id === o.role_id)?.name || o.role_id}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="prefix">
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Type className="w-4 h-4 text-cyan-400" />
              Prefix
            </CardTitle>
            <CardDescription className="text-xs">Mesaj komutları için sunucu prefix’i (örn. !, ?, .).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={prefixInput} onChange={(e) => setPrefixInput(e.target.value.slice(0, 5))} className="h-8 max-w-xs" />
            <SaveBtn module="prefix" data={{ prefix: prefixInput }} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="autobump">
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Radio className="w-4 h-4 text-orange-400" />
                Autobump
              </CardTitle>
              <Switch
                checked={!!autobump.is_enabled}
                onCheckedChange={(v) => patch("autobump", { ...autobump, is_enabled: v ? 1 : 0 })}
              />
            </div>
            <CardDescription className="text-xs">Bump hatırlatma kanalı ve ping rolü.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Kanal</Label>
              <ChannelSelect
                value={autobump.channel_id || ""}
                onChange={(v) => patch("autobump", { ...autobump, channel_id: v || null })}
                channels={textChannels}
                disabled={!autobump.is_enabled}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ping Rolü</Label>
              <RoleSelect
                value={autobump.ping_role_id || ""}
                onChange={(v) => patch("autobump", { ...autobump, ping_role_id: v || null })}
                roles={roles}
                disabled={!autobump.is_enabled}
              />
            </div>
            <SaveBtn module="autobump" data={autobump} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="media">
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-fuchsia-400" />
              Medya Kanalları
            </CardTitle>
            <CardDescription className="text-xs">Sadece medya paylaşımına izin verilen kanallar (metin engellenir).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <MultiChannelSelect
              values={Array.isArray(mediaChannels) ? mediaChannels : []}
              onChange={(vals) => patch("mediaChannels", vals)}
              channels={textChannels}
              placeholder="+ Medya kanalı ekle..."
            />
            <SaveBtn module="media_channels" data={{ channel_ids: mediaChannels }} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="levels" className="space-y-4">
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              Seviye Ödülleri
            </CardTitle>
            <CardDescription className="text-xs">Belirli seviyeye ulaşınca otomatik verilen roller.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Seviye</Label>
                <Input type="number" min={1} value={rewardLevel} onChange={(e) => setRewardLevel(e.target.value)} className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rol</Label>
                <RoleSelect value={rewardRole} onChange={setRewardRole} roles={roles} />
              </div>
            </div>
            <Button size="sm" className="w-full" disabled={rewardBusy} onClick={handleRewardAdd}>
              {rewardBusy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
              Ödül Ekle
            </Button>
          </CardContent>
        </Card>
        <div className="space-y-2">
          {levelRewards.length === 0 && <p className="text-xs text-muted-foreground">Henüz seviye ödülü yok.</p>}
          {levelRewards.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl border border-border/50 p-3 text-xs">
              <span>Seviye <strong>{r.level}</strong> → @{roles.find((x) => x.id === r.role_id)?.name || r.role_id}</span>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleRewardDelete(r.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="social" className="space-y-4">
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-rose-400" />
              Sosyal Medya Bildirimleri
            </CardTitle>
            <CardDescription className="text-xs">YouTube / Twitch / Kick için yeni içerik & canlı bildirimleri.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Platform</Label>
                <CustomSelect
                  value={socialPlatform}
                  onChange={setSocialPlatform}
                  options={[
                    { value: "youtube", label: "YouTube" },
                    { value: "twitch", label: "Twitch" },
                    { value: "kick", label: "Kick" }
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Kanal kimliği / kullanıcı adı</Label>
                <Input value={socialIdent} onChange={(e) => setSocialIdent(e.target.value)} className="h-8" placeholder="UC... veya nick" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Discord bildirim kanalı</Label>
              <ChannelSelect value={socialChannel} onChange={setSocialChannel} channels={textChannels} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mesaj şablonu (opsiyonel)</Label>
              <Input value={socialTemplate} onChange={(e) => setSocialTemplate(e.target.value)} className="h-8" placeholder="{title} {url} {name}" />
            </div>
            <Button size="sm" className="w-full" disabled={socialBusy} onClick={handleSocialAdd}>
              {socialBusy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
              Abonelik Ekle
            </Button>
          </CardContent>
        </Card>
        <div className="space-y-2">
          {socialSubscriptions.length === 0 && <p className="text-xs text-muted-foreground">Abonelik yok.</p>}
          {socialSubscriptions.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl border border-border/50 p-3 text-xs">
              <div>
                <div className="font-medium">#{s.id} {String(s.platform).toUpperCase()} — {s.channel_identifier}</div>
                <div className="text-muted-foreground">
                  #{textChannels.find((c) => c.id === s.discord_channel_id)?.name || s.discord_channel_id}
                  {s.is_currently_live ? " · CANLI" : ""}
                </div>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleSocialDelete(s.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="warns" className="space-y-4">
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              Uyarı Otomatik Cezaları
            </CardTitle>
            <CardDescription className="text-xs">X. uyarıda otomatik mute / kick / ban / timeout.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Uyarı sayısı</Label>
                <Input type="number" min={1} value={warnCount} onChange={(e) => setWarnCount(e.target.value)} className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Aksiyon</Label>
                <CustomSelect
                  value={warnAction}
                  onChange={setWarnAction}
                  options={[
                    { value: "mute", label: "Mute" },
                    { value: "timeout", label: "Timeout" },
                    { value: "kick", label: "Kick" },
                    { value: "ban", label: "Ban" }
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Süre (dk)</Label>
                <Input type="number" min={0} value={warnDuration} onChange={(e) => setWarnDuration(e.target.value)} className="h-8" />
              </div>
            </div>
            <Button size="sm" className="w-full" disabled={warnBusy} onClick={handleWarnAdd}>
              {warnBusy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
              Kural Ekle
            </Button>
          </CardContent>
        </Card>
        <div className="space-y-2">
          {warnActions.length === 0 && <p className="text-xs text-muted-foreground">Otomatik ceza kuralı yok.</p>}
          {warnActions.map((w: any) => (
            <div key={w.id} className="flex items-center justify-between rounded-xl border border-border/50 p-3 text-xs">
              <span>
                <strong>{w.warn_count}</strong> uyarı → {w.action}
                {w.duration ? ` (${w.duration} dk)` : ""}
              </span>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleWarnDelete(w.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="polls" className="space-y-4">
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Vote className="w-4 h-4 text-blue-400" />
              Anket Oluştur
            </CardTitle>
            <CardDescription className="text-xs">Seçenekleri satır satır yazın; Discord kanalına canlı anket yayınlanır.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Soru</Label>
              <Input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} className="h-8" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Seçenekler (her satıra bir)</Label>
              <Textarea value={pollOptions} onChange={(e) => setPollOptions(e.target.value)} rows={4} placeholder={"Evet\nHayır\nBelki"} />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Kanal</Label>
                <ChannelSelect value={pollChannel} onChange={setPollChannel} channels={textChannels} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Süre (saat, boş = sınırsız)</Label>
                <Input type="number" min={0} value={pollHours} onChange={(e) => setPollHours(e.target.value)} className="h-8" />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={pollMultiple} onCheckedChange={setPollMultiple} />
                <Label className="text-xs">Çoklu seçim</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={pollAnon} onCheckedChange={setPollAnon} />
                <Label className="text-xs">Anonim</Label>
              </div>
            </div>
            <Button size="sm" className="w-full" disabled={pollBusy} onClick={handlePollCreate}>
              {pollBusy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
              Yayınla
            </Button>
          </CardContent>
        </Card>
        <div className="space-y-2">
          {polls.length === 0 && <p className="text-xs text-muted-foreground">Anket yok.</p>}
          {polls.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-border/50 p-3 text-xs gap-3">
              <div>
                <div className="font-medium">#{p.id} — {p.question}</div>
                <div className="text-muted-foreground">
                  {p.status} · {p.option_count || 0} seçenek · {p.vote_count || 0} oy · #{textChannels.find((c) => c.id === p.channel_id)?.name || p.channel_id}
                </div>
              </div>
              {p.status === "active" && (
                <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={() => handlePollClose(p.id)}>
                  Kapat
                </Button>
              )}
            </div>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
