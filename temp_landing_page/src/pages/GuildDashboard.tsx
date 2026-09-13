import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield,
  Radio,
  Music,
  UserCheck,
  Award,
  Settings,
  Save,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Hash,
  Volume2,
  Users,
  Eye,
  FileText,
  Lock,
  Zap,
  Sparkles,
  Server,
  Plus,
  Trash2,
  Bell,
  Ban,
  Ticket,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Gift,
  Tag,
  Clock,
  Flame,
  UserPlus,
  Compass,
  Check,
  Repeat,
  Minus,
  Pin,
  ChevronDown,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Search,
  RefreshCw,
  Filter,
  CheckCircle,
  XCircle,
  History,
  Image as ImageIcon,
  User,
  Calendar,
  Send,
  X
} from "lucide-react";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  RoleSelect,
  ChannelSelect,
  MemberSelect,
  CustomSelect,
  MultiRoleSelect,
  MultiChannelSelect,
  type Role,
  type Channel,
  type Member
} from "@/components/dashboard/DiscordSelectors";
import { CustomCommandsPanel } from "@/components/dashboard/CustomCommandsPanel";
import { ExtraSystemsPanel } from "@/components/dashboard/ExtraSystemsPanel";
import { siteConfig } from "@/config/site";

interface GuildDetails {
  id: string;
  name: string;
  icon: string | null;
  banner?: string | null;
  description?: string | null;
  premiumTier?: number;
  premiumSubscriptionCount?: number;
  approximatePresenceCount?: number;
  memberCount: number;
  channels: {
    text: Channel[];
    voice: Channel[];
    categories?: Channel[];
  };
  roles: Role[];
  members: Member[];
}

interface SelectOption {
  id: string;
  name: string;
}

function FormSelect({
  value,
  onChange,
  options,
  placeholder = "-- Seçiniz --",
  disabled = false,
  className = ""
}: {
  value: string;
  onChange: (val: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <CustomSelect
      value={value || ""}
      onChange={onChange}
      options={options.map((o) => ({ value: o.id, label: o.name }))}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  );
}


export default function GuildDashboard() {
  const { guildId } = useParams<{ guildId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [guildDetails, setGuildDetails] = useState<GuildDetails | null>(null);
  const [configs, setConfigs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingModule, setSavingModule] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const botName = siteConfig.bot.name;
  const botInitials = botName.slice(0, 2).toUpperCase();

  // New word form state
  const [newWord, setNewWord] = useState("");
  const [newWordAction, setNewWordAction] = useState("warn");

  // Whitelist & Live Discord Sync states
  const [whitelistType, setWhitelistType] = useState<"user" | "role">("user");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [whitelistLoading, setWhitelistLoading] = useState(false);
  const [publishingPanel, setPublishingPanel] = useState<string | null>(null);

  // Interactive realistic preview states
  const [previewTicketOpened, setPreviewTicketOpened] = useState(false);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketSubjectInput, setTicketSubjectInput] = useState("");
  const [ticketDescInput, setTicketDescInput] = useState("");

  const [suggestionModalOpen, setSuggestionModalOpen] = useState(false);
  const [suggestionPreviewMode, setSuggestionPreviewMode] = useState<"panel" | "card">("panel");
  const [suggestionTextInput, setSuggestionTextInput] = useState("");
  const [suggestionAnonInput, setSuggestionAnonInput] = useState("Hayır");
  const [previewUpvotes, setPreviewUpvotes] = useState(14);
  const [previewDownvotes, setPreviewDownvotes] = useState(2);
  const [previewUserVote, setPreviewUserVote] = useState<"up" | "down" | null>(null);
  const [activeSuggestionText, setActiveSuggestionText] = useState("Sunucuda ses kanallarında aktif olan üyelere özel XP ve seviye bonusu tanımlansın!");
  const [activeSuggestionAuthor, setActiveSuggestionAuthor] = useState("Muhammedpyz");

  // Moderation Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditStats, setAuditStats] = useState<{ total: number; activeBans: number; activeMutes: number; totalWarns: number }>({
    total: 0,
    activeBans: 0,
    activeMutes: 0,
    totalWarns: 0
  });
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditTypeFilter, setAuditTypeFilter] = useState("all");
  const [auditStatusFilter, setAuditStatusFilter] = useState("all");
  const [revokingId, setRevokingId] = useState<number | null>(null);

  // Ticket Transcripts Archive State
  const [transcripts, setTranscripts] = useState<any[]>([]);
  const [transcriptsLoading, setTranscriptsLoading] = useState(false);
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState<"all" | "open" | "closed">("all");

  // User Lookup & Criminal Record (/sorgu) State
  const [sorguUserId, setSorguUserId] = useState("");
  const [sorguLoading, setSorguLoading] = useState(false);
  const [sorguData, setSorguData] = useState<any>(null);
  const [sorguSubTab, setSorguSubTab] = useState<"penalties" | "notes" | "tickets" | "deleted" | "staff">("penalties");
  const [newModNote, setNewModNote] = useState("");
  const [savingModNote, setSavingModNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<number | null>(null);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  const fetchGuildData = async (silent = false) => {
    if (!guildId) return;
    if (!silent) setLoading(true);
    try {
      const [detailsRes, configRes] = await Promise.all([
        apiFetch(`/api/guilds/${guildId}/details`),
        apiFetch(`/api/guilds/${guildId}/config`)
      ]);

      if (detailsRes.ok && configRes.ok) {
        const details = await detailsRes.json();
        const cfg = await configRes.json();
        setGuildDetails(details);
        setConfigs(cfg);
      } else if (!silent) {
        toast({
          title: "Veri Yükleme Hatası",
          description: "Sunucu ayarları çekilemedi veya bot bu sunucuda yetkili değil.",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error("Guild fetch failed:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchAuditLogs = async (silent = false) => {
    if (!guildId) return;
    if (!silent) setAuditLoading(true);
    try {
      const q = new URLSearchParams();
      if (auditSearch.trim()) q.set("search", auditSearch.trim());
      if (auditTypeFilter !== "all") q.set("type", auditTypeFilter);
      if (auditStatusFilter !== "all") q.set("status", auditStatusFilter);

      const res = await apiFetch(`/api/guilds/${guildId}/audit-logs?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
        if (data.stats) setAuditStats(data.stats);
      }
    } catch (e) {
      console.error("Audit logs fetch failed:", e);
    } finally {
      if (!silent) setAuditLoading(false);
    }
  };

  const fetchTranscripts = async (silent = false) => {
    if (!guildId) return;
    if (!silent) setTranscriptsLoading(true);
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/transcripts`);
      if (res.ok) {
        const data = await res.json();
        setTranscripts(data.transcripts || []);
      }
    } catch (e) {
      console.error("Transcripts fetch failed:", e);
    } finally {
      if (!silent) setTranscriptsLoading(false);
    }
  };

  const handleRevokePenalty = async (item: any) => {
    if (!guildId) return;
    setRevokingId(item.id);
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/audit-logs/${item.id}/revoke`, {
        method: "POST",
        body: JSON.stringify({
          source: item.source,
          actionType: item.action_type,
          userId: item.user_id,
          reason: "Dashboard üzerinden kaldırıldı"
        })
      });
      if (res.ok) {
        toast({
          title: "Ceza Kaldırıldı",
          description: "Kullanıcının cezası başarıyla kaldırıldı ve sunucu senkronize edildi."
        });
        fetchAuditLogs();
        if (sorguUserId) {
          handleFetchSorgu(sorguUserId);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        toast({
          title: "İşlem Başarısız",
          description: errData.error || "Ceza kaldırılırken hata oluştu.",
          variant: "destructive"
        });
      }
    } catch (e) {
      toast({
        title: "Bağlantı Hatası",
        description: "Sunucuya ulaşılamadı.",
        variant: "destructive"
      });
    } finally {
      setRevokingId(null);
    }
  };

  const [closingTicketId, setClosingTicketId] = useState<number | null>(null);

  const handleCloseTicket = async (ticketId: number) => {
    if (!guildId) return;
    setClosingTicketId(ticketId);
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/tickets/${ticketId}/close`, {
        method: "POST"
      });
      if (res.ok) {
        toast({
          title: "Bilet Kapatıldı",
          description: "Destek talebi başarıyla kapatıldı ve transkript arşive aktarıldı."
        });
        fetchGuildData();
        fetchTranscripts();
      } else {
        const d = await res.json().catch(() => ({}));
        toast({
          title: "İşlem Başarısız",
          description: d.error || "Bilet kapatılamadı.",
          variant: "destructive"
        });
      }
    } catch (e) {
      toast({
        title: "Bağlantı Hatası",
        description: "Sunucuya ulaşılamadı.",
        variant: "destructive"
      });
    } finally {
      setClosingTicketId(null);
    }
  };

  const handleFetchSorgu = async (targetId?: string, silent = false) => {
    const idToSearch = targetId || sorguUserId;
    if (!guildId || !idToSearch.trim()) {
      if (!silent) {
        toast({
          title: "Kullanıcı Seçilmedi",
          description: "Lütfen bir sunucu üyesi seçin veya Discord ID girin.",
          variant: "destructive"
        });
      }
      return;
    }

    if (!silent) setSorguLoading(true);
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/sorgu/${idToSearch.trim()}`);
      if (res.ok) {
        const data = await res.json();
        setSorguData(data);
      } else if (!silent) {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Sorgu Başarısız",
          description: err.error || "Kullanıcı bilgileri çekilemedi.",
          variant: "destructive"
        });
      }
    } catch (e: any) {
      if (!silent) {
        toast({
          title: "Bağlantı Hatası",
          description: e.message || "Sunucuya bağlanılamadı.",
          variant: "destructive"
        });
      }
    } finally {
      if (!silent) setSorguLoading(false);
    }
  };

  const handleAddModNote = async () => {
    if (!guildId || !sorguUserId.trim() || !newModNote.trim()) return;
    setSavingModNote(true);
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/sorgu/${sorguUserId.trim()}/notes`, {
        method: "POST",
        body: JSON.stringify({ note: newModNote.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        if (sorguData) {
          setSorguData({
            ...sorguData,
            notes: [data.note, ...(sorguData.notes || [])]
          });
        }
        setNewModNote("");
        toast({
          title: "Not Kaydedildi",
          description: "Moderatör notu başarıyla eklendi."
        });
      }
    } catch (e) {
      toast({
        title: "Hata",
        description: "Not eklenirken bir hata oluştu.",
        variant: "destructive"
      });
    } finally {
      setSavingModNote(false);
    }
  };

  const handleDeleteModNote = async (noteId: number) => {
    if (!guildId) return;
    setDeletingNoteId(noteId);
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/notes/${noteId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        if (sorguData) {
          setSorguData({
            ...sorguData,
            notes: (sorguData.notes || []).filter((n: any) => n.id !== noteId)
          });
        }
        toast({
          title: "Not Silindi",
          description: "Moderatör notu başarıyla kaldırıldı."
        });
      }
    } catch (e) {
      toast({
        title: "Hata",
        description: "Not silinirken hata oluştu.",
        variant: "destructive"
      });
    } finally {
      setDeletingNoteId(null);
    }
  };

  useEffect(() => {
    fetchGuildData();
  }, [guildId]);

  useEffect(() => {
    if (activeTab === "audit_logs") {
      fetchAuditLogs();
    } else if (activeTab === "ticket") {
      fetchTranscripts();
    } else if (activeTab === "sorgu" && !sorguData && !sorguLoading) {
      if (!sorguUserId && guildDetails?.members && guildDetails.members.length > 0) {
        const firstMemId = guildDetails.members[0].id;
        setSorguUserId(firstMemId);
        handleFetchSorgu(firstMemId);
      }
    }
  }, [activeTab, guildId, auditTypeFilter, auditStatusFilter]);

  // Real-Time Server-Sent Events (SSE) live connection for zero-refresh dashboard updates
  useEffect(() => {
    if (!guildId) return;

    let eventSource: EventSource | null = null;
    let isMounted = true;

    try {
      eventSource = new EventSource(`${API_BASE_URL}/api/events/live?guildId=${guildId}`);

      eventSource.addEventListener("connected", () => {
        if (isMounted) setIsLiveConnected(true);
      });

      eventSource.addEventListener("ticket_created", () => {
        fetchGuildData(true);
        fetchTranscripts(true);
      });

      eventSource.addEventListener("ticket_closed", () => {
        fetchGuildData(true);
        fetchTranscripts(true);
      });

      eventSource.addEventListener("ticket_claimed", () => {
        fetchGuildData(true);
        fetchTranscripts(true);
      });

      eventSource.addEventListener("ticket_message", () => {
        fetchTranscripts(true);
      });

      eventSource.addEventListener("audit_log", () => {
        fetchGuildData(true);
        fetchAuditLogs(true);
        if (sorguUserId) {
          handleFetchSorgu(sorguUserId, true);
        }
      });

      eventSource.addEventListener("giveaway_update", () => {
        fetchGuildData(true);
      });

      eventSource.addEventListener("sorgu_update", () => {
        if (sorguUserId) {
          handleFetchSorgu(sorguUserId, true);
        }
      });

      eventSource.onerror = () => {
        if (isMounted) setIsLiveConnected(false);
      };
    } catch (e) {
      console.warn("SSE live connection error in GuildDashboard:", e);
    }

    return () => {
      isMounted = false;
      if (eventSource) eventSource.close();
    };
  }, [guildId, sorguUserId]);

  const saveConfigModule = async (moduleName: string, dataToSave: any) => {
    if (!guildId) return;
    setSavingModule(moduleName);

    try {
      const res = await apiFetch(`/api/guilds/${guildId}/config`, {
        method: "POST",
        body: JSON.stringify({
          module: moduleName,
          data: dataToSave
        })
      });

      if (res.ok) {
        toast({
          title: "Ayarlar Kaydedildi",
          description: `${moduleName.toUpperCase()} yapılandırması veritabanına başarıyla yazıldı.`
        });
      } else {
        const err = await res.json();
        toast({
          title: "Kayıt Başarısız",
          description: err.error || "Ayar kaydedilemedi.",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      toast({
        title: "Bağlantı Hatası",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setSavingModule(null);
    }
  };

  const handleAddWord = async () => {
    if (!guildId || !newWord.trim()) return;

    try {
      const res = await apiFetch(`/api/guilds/${guildId}/words`, {
        method: "POST",
        body: JSON.stringify({
          word: newWord.trim(),
          action: newWordAction,
          match_type: "includes"
        })
      });

      if (res.ok) {
        const data = await res.json();
        setConfigs({ ...configs, filteredWords: data.words });
        setNewWord("");
        toast({
          title: "Kelime Eklendi",
          description: `"${newWord}" yasaklı kelimeler listesine eklendi.`
        });
      }
    } catch (err) {
      console.error("Add word error:", err);
    }
  };

  const handleDeleteWord = async (wordId: number) => {
    if (!guildId) return;

    try {
      const res = await apiFetch(`/api/guilds/${guildId}/words/${wordId}`, {
        method: "DELETE"
      });

      if (res.ok) {
        const data = await res.json();
        setConfigs({ ...configs, filteredWords: data.words });
        toast({
          title: "Kelime Silindi",
          description: "Yasaklı kelime kaldırıldı."
        });
      }
    } catch (err) {
      console.error("Delete word error:", err);
    }
  };

  const handleAddWhitelist = async () => {
    if (!guildId) return;
    const targetId = whitelistType === "user" ? selectedMemberId : selectedRoleId;
    if (!targetId) {
      toast({
        title: "Seçim Yapılmadı",
        description: `Lütfen listeye eklenecek bir ${whitelistType === "user" ? "üye / kişi" : "rol"} seçin.`,
        variant: "destructive"
      });
      return;
    }

    setWhitelistLoading(true);
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/antinuke/whitelist`, {
        method: "POST",
        body: JSON.stringify({
          target_id: targetId,
          target_type: whitelistType
        })
      });
      if (res.ok) {
        const data = await res.json();
        setConfigs({
          ...configs,
          antinuke: {
            ...configs.antinuke,
            whitelist: data.whitelist
          }
        });
        setSelectedMemberId("");
        setSelectedRoleId("");
        toast({
          title: "Güvenli Listeye Eklendi",
          description: `${whitelistType === "user" ? "Kişi" : "Rol"} başarıyla koruma istisnasına eklendi.`
        });
      }
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    } finally {
      setWhitelistLoading(false);
    }
  };

  const handleRemoveWhitelist = async (targetId: string) => {
    if (!guildId) return;
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/antinuke/whitelist/${targetId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        const data = await res.json();
        setConfigs({
          ...configs,
          antinuke: {
            ...configs.antinuke,
            whitelist: data.whitelist
          }
        });
        toast({
          title: "Listeden Kaldırıldı",
          description: "İstisna listeden silindi."
        });
      }
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    }
  };

  const handlePublishTicketPanel = async () => {
    if (!guildId) return;
    setPublishingPanel("ticket");
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/ticket/publish-panel`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        setConfigs({
          ...configs,
          ticketSetup: {
            ...configs.ticketSetup,
            published_panel_id: data.messageId
          }
        });
        toast({
          title: "Discord Bilet Paneli Güncellendi",
          description: data.message
        });
      } else {
        toast({
          title: "Hata",
          description: data.error || "Discord mesajı gönderilemedi.",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    } finally {
      setPublishingPanel(null);
    }
  };

  const handlePublishSuggestionPanel = async () => {
    if (!guildId) return;
    setPublishingPanel("suggestion");
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/suggestion/publish-panel`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        setConfigs({
          ...configs,
          suggestionSetup: {
            ...configs.suggestionSetup,
            published_message_id: data.messageId
          }
        });
        toast({
          title: "Discord Öneri Paneli Güncellendi",
          description: data.message
        });
      } else {
        toast({
          title: "Hata",
          description: data.error || "Discord mesajı gönderilemedi.",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    } finally {
      setPublishingPanel(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="container max-w-7xl pt-6 pb-20 px-4 min-h-screen">
        <div className="space-y-6">
          <Skeleton className="h-10 w-48 rounded-xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!guildDetails || !configs) {
    return (
      <div className="container max-w-4xl pt-10 pb-20 px-4 text-center min-h-screen">
        <div className="liquid-glass rounded-3xl p-12 border border-border/60">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold font-display mb-2">Sunucu Bulunamadı</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Bu sunucunun yönetim paneline erişim izniniz bulunmuyor veya bot sunucudan çıkarılmış olabilir.
          </p>
          <Button onClick={() => navigate("/dashboard")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Sunucu Listesine Dön
          </Button>
        </div>
      </div>
    );
  }

  const {
    general = {},
    automod = {},
    antinuke = {},
    welcome = {},
    autorole = {},
    logs = {},
    level = {},
    music = {},
    activeRooms = [],
    specialRoomsSetup = {},
    ticketSetup = {},
    suggestionSetup = {},
    vanity = {},
    autobump = {},
    tagRole = {},
    mediaChannels = [],
    tickets = [],
    giveaways = [],
    filteredWords = [],
    prefixes = ["!"]
  } = configs || {};

  const textChannels = guildDetails.channels.text || [];
  const voiceChannels = guildDetails.channels.voice || [];
  const categoryChannels = guildDetails.channels.categories || [];
  const roles = guildDetails.roles || [];
  const members = guildDetails.members || [];

  const filteredMembers = members.filter(m => {
    if (!memberSearchQuery.trim()) return true;
    const q = memberSearchQuery.toLowerCase();
    return m.displayName.toLowerCase().includes(q) || m.username.toLowerCase().includes(q) || m.id.includes(q);
  });

  const dashboardTabs = [
    { id: "eylemler", label: "⚡ Eylemler", icon: Zap },
    { id: "overview", label: "Genel Bakış", icon: Sliders },
    { id: "custom_commands", label: "Özel Komutlar", icon: Sparkles },
    { id: "automod", label: "AutoMod & Filtreler", icon: Shield },
    { id: "antinuke", label: "Anti-Nuke Koruma", icon: Lock },
    { id: "audit_logs", label: "Ceza & Denetim Kaydı", icon: ShieldAlert },
    { id: "sorgu", label: "Kullanıcı Sicil & Sorgu", icon: Search },
    { id: "ticket", label: "Destek Talepleri", icon: Ticket },
    { id: "giveaway", label: "Çekilişler", icon: Gift },
    { id: "suggestion", label: "Öneri Sistemi", icon: MessageSquare },
    { id: "welcome", label: "Karşılama & Otorol", icon: UserPlus },
    { id: "rooms", label: "Özel Odalar", icon: Radio },
    { id: "vanity_tag", label: "Vanity & Tag Rol", icon: Tag },
        { id: "extra_systems", label: "Ekstra Sistemler", icon: Settings },
    { id: "logs", label: "14 Log Kanalı", icon: FileText },
    { id: "music_levels", label: "Müzik & Seviye (XP)", icon: Music },
  ];

  const navCategories = [
    {
      title: "Eylem & Komutlar",
      items: [
        { id: "eylemler", label: "⚡ Eylemler Paneli", icon: Zap }
      ]
    },
    {
      title: "Genel Yönetim",
      items: [
        { id: "overview", label: "Genel Bakış", icon: Sliders },
        { id: "custom_commands", label: "Özel Komutlar", icon: Sparkles }
      ]
    },
    {
      title: "Güvenlik & Moderasyon",
      items: [
        { id: "automod", label: "AutoMod & Filtreler", icon: Shield },
        { id: "antinuke", label: "Anti-Nuke Koruma", icon: Lock },
        { id: "audit_logs", label: "Ceza & Denetim Kaydı", icon: ShieldAlert },
        { id: "sorgu", label: "Kullanıcı Sicil & Sorgu", icon: Search },
        { id: "logs", label: "14 Log Kanalı", icon: FileText }
      ]
    },
    {
      title: "Topluluk & Destek",
      items: [
        { id: "ticket", label: "Destek Talepleri", icon: Ticket },
        { id: "giveaway", label: "Çekilişler", icon: Gift },
        { id: "suggestion", label: "Öneri Sistemi", icon: MessageSquare },
        { id: "welcome", label: "Karşılama & Otorol", icon: UserPlus },
        { id: "vanity_tag", label: "Vanity & Tag Rol", icon: Tag },
        { id: "extra_systems", label: "Ekstra Sistemler", icon: Settings }
      ]
    },
    {
      title: "Ses & Seviye",
      items: [
        { id: "rooms", label: "Özel Odalar", icon: Radio },
        { id: "music_levels", label: "Müzik & Seviye (XP)", icon: Music }
      ]
    }
  ];

  const getTabBadge = (id: string): string | null => {
    if (id === "automod") {
      const count = (Array.isArray(automod.exempt_roles) ? automod.exempt_roles.length : 0) +
                    (Array.isArray(automod.exempt_channels) ? automod.exempt_channels.length : 0);
      if (count > 0) return `${count} Muaf`;
    } else if (id === "antinuke") {
      const count = Array.isArray(antinuke.whitelist) ? antinuke.whitelist.length : 0;
      if (count > 0) return `${count} Güvenli`;
    } else if (id === "audit_logs") {
      const activeCount = (auditStats.activeBans || 0) + (auditStats.activeMutes || 0);
      if (activeCount > 0) return `${activeCount} Aktif`;
    } else if (id === "sorgu") {
      return "Sicil";
    } else if (id === "ticket") {
      const openCount = Array.isArray(tickets) ? tickets.filter((t: any) => t.status === 'open').length : 0;
      if (openCount > 0) return `${openCount} Açık`;
      const count = Array.isArray(ticketSetup?.support_roles) ? ticketSetup.support_roles.length : 0;
      if (count > 0) return `${count} Yetkili`;
    } else if (id === "giveaway") {
      const activeCount = Array.isArray(giveaways) ? giveaways.filter((g: any) => g.status === 'active').length : 0;
      if (activeCount > 0) return `${activeCount} Aktif`;
      if (giveaways.length > 0) return `${giveaways.length} Toplam`;
    } else if (id === "music_levels") {
      const count = (Array.isArray(level.exempt_channels) ? level.exempt_channels.length : 0) +
                    (Array.isArray(level.exempt_roles) ? level.exempt_roles.length : 0);
      if (count > 0) return `${count} Muaf`;
    }
    return null;
  };

  return (
    <div className="container max-w-7xl pt-2 pb-20 px-3 sm:px-4 min-h-screen">
      {/* Sleek Compact Server Header Bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="liquid-glass rounded-3xl p-5 sm:p-6 border border-border/60 shadow-xl mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
      >
        {/* Left: Server Avatar + Details */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative shrink-0">
            {guildDetails.icon ? (
              <img
                src={guildDetails.icon}
                alt={guildDetails.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-2 ring-primary/40 shadow-xl bg-card"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary/20 ring-2 ring-primary/40 grid place-items-center text-primary font-display font-bold text-2xl shadow-xl">
                {guildDetails.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span
              className="absolute -bottom-1 -right-1 h-4 w-4 bg-emerald-500 ring-2 ring-background rounded-full animate-pulse"
              title="Bot Çevrimiçi"
            />
          </div>

          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-gradient bg-aurora bg-clip-text truncate">
                {guildDetails.name}
              </h1>
              {guildDetails.premiumTier && guildDetails.premiumTier > 0 ? (
                <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10 text-xs py-0.5 px-2.5 font-semibold">
                  Tier {guildDetails.premiumTier} Boost
                </Badge>
              ) : null}
            </div>

            <div className="flex items-center gap-2.5 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5 font-medium text-foreground bg-card/60 px-2.5 py-1 rounded-lg border border-border/50">
                <Users className="h-3.5 w-3.5 text-primary" />
                {guildDetails.memberCount} Üye
              </span>
              <span className="flex items-center gap-1.5 font-medium text-foreground bg-card/60 px-2.5 py-1 rounded-lg border border-border/50">
                <Hash className="h-3.5 w-3.5 text-primary" />
                {textChannels.length} Metin
              </span>
              <span className="flex items-center gap-1.5 font-medium text-foreground bg-card/60 px-2.5 py-1 rounded-lg border border-border/50">
                <Volume2 className="h-3.5 w-3.5 text-primary" />
                {voiceChannels.length} Ses
              </span>
              <span className="flex items-center gap-1.5 font-mono text-primary font-semibold bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                <Sparkles className="h-3.5 w-3.5" />
                Prefix: {prefixes[0] || "!"}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 self-stretch md:self-center shrink-0 flex-wrap justify-end">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-xl liquid-glass border border-border/70 hover:border-primary/50 text-foreground transition-all"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Sunucularıma Dön</span>
          </Link>

          <Badge
            variant="outline"
            className={isLiveConnected 
              ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-xs font-semibold py-2 px-3 rounded-xl flex items-center gap-2 shadow-sm"
              : "border-zinc-500/40 text-zinc-400 bg-zinc-500/10 text-xs font-semibold py-2 px-3 rounded-xl flex items-center gap-2 shadow-sm"
            }
          >
            <span className="relative flex h-2 w-2">
              {isLiveConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isLiveConnected ? "bg-emerald-500" : "bg-zinc-500"}`}></span>
            </span>
            <span>{isLiveConnected ? "Canlı Senkronize (F5 Gerekmez)" : "Bağlantı Kuruluyor..."}</span>
          </Badge>

          <Button
            size="sm"
            onClick={() => fetchGuildData()}
            disabled={loading}
            variant="outline"
            className="h-9 text-xs px-3.5 rounded-xl border-border/80 hover:border-primary/50 text-foreground"
          >
            <Repeat className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Yenile
          </Button>

          <Button
            asChild
            size="sm"
            variant="hero"
            className="h-9 text-xs px-4 rounded-xl shadow-md shadow-primary/20 font-medium"
          >
            <a href={`https://discord.com/channels/${guildDetails.id}`} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Discord'da Aç
            </a>
          </Button>
        </div>
      </motion.div>

      {/* Categorized Discord-style Sidebar & Content Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        {/* Mobile Horizontal Quick Switcher (lg:hidden) */}
        <div className="lg:hidden overflow-x-auto scrollbar-none pb-2 -mx-1 px-1 flex items-center gap-2">
          {dashboardTabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            const badge = getTabBadge(t.id);

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`whitespace-nowrap flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-[var(--shadow-glow)]"
                    : "liquid-glass text-foreground hover:border-primary/40"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{t.label}</span>
                {badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                      isActive ? "bg-black/30 text-white" : "bg-primary/20 text-primary"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Main Grid: Left Sidebar + Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Discord-style Vertical Navigation Sidebar */}
          <aside className="hidden lg:block lg:col-span-3 lg:sticky lg:top-24 space-y-3">
            <div className="liquid-glass rounded-2xl p-3 border border-border/60 shadow-lg space-y-4">
              {navCategories.map((category) => (
                <div key={category.title} className="space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 px-3 py-1">
                    {category.title}
                  </p>
                  <div className="space-y-0.5">
                    {category.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      const badge = getTabBadge(item.id);

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveTab(item.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                            isActive
                              ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
                            <span className="truncate">{item.label}</span>
                          </div>
                          {badge && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold shrink-0 transition-all ${
                                isActive
                                  ? "bg-black/20 text-white"
                                  : "bg-primary/15 text-primary border border-primary/20"
                              }`}
                            >
                              {badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* Right Column: Tab Contents */}
          <div className="lg:col-span-9 min-w-0">

        {/* FAZ 4: ÖZEL KOMUTLAR (CUSTOM COMMANDS) TAB */}
        <TabsContent value="custom_commands">
          <Card className="liquid-glass border-border/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Özel Komutlar (Gelişmiş Yönetim)
              </CardTitle>
              <CardDescription>
                Sunucunuz için belirlediğiniz tetikleyici kelimelere özel yanıtlar oluşturun, düzenleyin ve silin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CustomCommandsPanel guildId={guildId!} guildDetails={guildDetails} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 1. GENEL BAKIŞ TAB */}
        <TabsContent value="extra_systems">
          <Card className="liquid-glass border-border/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-display">Ekstra Sistemler & Modüller</CardTitle>
              <CardDescription>
                Starboard, doğum günü, kayıt, doğrulama, sayaç, yapışkan mesaj, market ve buton-rol ayarları.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExtraSystemsPanel
                guildId={guildId!}
                configs={configs}
                setConfigs={setConfigs}
                textChannels={textChannels}
                voiceChannels={voiceChannels}
                roles={roles}
                saveConfigModule={saveConfigModule}
                savingModule={savingModule}
                onRefresh={() => fetchGuildData(true)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview">
          <Card className="liquid-glass border-border/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center justify-between">
                <span>Hızlı Güvenlik & Moderasyon Durumu</span>
                <Button
                  size="sm"
                  onClick={() => saveConfigModule("general", general)}
                  disabled={savingModule === "general"}
                  className="h-8 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {savingModule === "general" ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </CardTitle>
              <CardDescription className="text-xs">
                Sunucunuzun bot üzerindeki aktif koruma modülleri ve veritabanı ayarları.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-card/40">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Küfür & Hakaret Filtresi</Label>
                    <p className="text-xs text-muted-foreground">Uygunsuz sözcükleri tespit eder ve anında temizler.</p>
                  </div>
                  <Switch
                    checked={!!automod.anti_swear}
                    onCheckedChange={(val) => {
                      const v = val ? 1 : 0;
                      setConfigs({
                        ...configs,
                        automod: { ...automod, anti_swear: v },
                        general: { ...general, anti_swear_enabled: v }
                      });
                    }}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-card/40">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Link & Bağlantı Engeli</Label>
                    <p className="text-xs text-muted-foreground">Harici web bağlantısı paylaşımlarını engeller.</p>
                  </div>
                  <Switch
                    checked={!!automod.anti_link}
                    onCheckedChange={(val) => {
                      const v = val ? 1 : 0;
                      setConfigs({
                        ...configs,
                        automod: { ...automod, anti_link: v },
                        general: { ...general, anti_link_enabled: v }
                      });
                    }}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-card/40">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Discord Davet Engeli</Label>
                    <p className="text-xs text-muted-foreground">Başka Discord sunucu davet linklerini otomatik siler.</p>
                  </div>
                  <Switch
                    checked={!!automod.anti_invite}
                    onCheckedChange={(val) => setConfigs({ ...configs, automod: { ...automod, anti_invite: val ? 1 : 0 } })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-card/40">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Spam Koruması</Label>
                    <p className="text-xs text-muted-foreground">Tekrarlanan ve seri gönderilen mesajları durdurur.</p>
                  </div>
                  <Switch
                    checked={!!general.anti_spam_enabled}
                    onCheckedChange={(val) => setConfigs({ ...configs, general: { ...general, anti_spam_enabled: val ? 1 : 0 } })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-card/40">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Caps Lock Filtresi</Label>
                    <p className="text-xs text-muted-foreground">Aşırı büyük harf kullanımını engeller.</p>
                  </div>
                  <Switch
                    checked={!!general.caps_filter_enabled}
                    onCheckedChange={(val) => setConfigs({ ...configs, general: { ...general, caps_filter_enabled: val ? 1 : 0 } })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-card/40">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Anti-Raid Koruması</Label>
                    <p className="text-xs text-muted-foreground">Ani sunucu baskınlarında otomatik kilit uygular.</p>
                  </div>
                  <Switch
                    checked={!!general.anti_raid_enabled}
                    onCheckedChange={(val) => setConfigs({ ...configs, general: { ...general, anti_raid_enabled: val ? 1 : 0 } })}
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border/60 bg-card/40 space-y-2">
                <Label className="text-sm font-medium flex items-center justify-between">
                  <span>Yetkili / Moderatör Rolü</span>
                  <span className="text-[11px] text-muted-foreground font-normal">Bot komutlarını yönetebilecek rol</span>
                </Label>
                <RoleSelect
                  value={general.mod_role_id || ""}
                  onChange={(val) => setConfigs({ ...configs, general: { ...general, mod_role_id: val || null } })}
                  roles={roles}
                  placeholder="Moderatör rolü seçiniz..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Whitelist & Exemption Center Overview Card */}
          <Card className="liquid-glass border-border/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <span>Sistem Muafiyetleri & Güvenli Liste Özeti (Whitelist)</span>
                </span>
                <Badge variant="outline" className="border-primary/40 text-primary text-xs px-2.5 py-0.5">
                  Tüm Sistemler
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Sunucunuzdaki bot korumalarından muaf tutulan kullanıcı, rol ve kanalların merkezi kontrol paneli.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. Anti-Nuke Whitelist */}
                <div className="p-3.5 rounded-2xl border border-border/70 bg-card/40 hover:border-primary/50 transition-all flex flex-col justify-between space-y-2.5 group">
                  <div className="flex items-start justify-between">
                    <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-semibold">
                      {Array.isArray(antinuke.whitelist) ? antinuke.whitelist.length : 0} Kayıt
                    </Badge>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">Anti-Nuke Whitelist</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Limit aşımında dokunulmazlığı olan yönetici ve roller.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("antinuke")}
                    className="w-full h-7 text-[11px] rounded-lg border-border/70 group-hover:border-primary/50 group-hover:text-primary transition-all cursor-pointer"
                  >
                    Yönet
                  </Button>
                </div>

                {/* 2. AutoMod Whitelist */}
                <div className="p-3.5 rounded-2xl border border-border/70 bg-card/40 hover:border-primary/50 transition-all flex flex-col justify-between space-y-2.5 group">
                  <div className="flex items-start justify-between">
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                      <Shield className="h-4 w-4" />
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-semibold">
                      {(Array.isArray(automod.exempt_roles) ? automod.exempt_roles.length : 0) + (Array.isArray(automod.exempt_channels) ? automod.exempt_channels.length : 0)} Muaf
                    </Badge>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">AutoMod Muafiyetleri</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Küfür, reklam ve spam filtrelerinden muaf roller/kanallar.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("automod")}
                    className="w-full h-7 text-[11px] rounded-lg border-border/70 group-hover:border-primary/50 group-hover:text-primary transition-all cursor-pointer"
                  >
                    Yönet
                  </Button>
                </div>

                {/* 3. Ticket Support Whitelist */}
                <div className="p-3.5 rounded-2xl border border-border/70 bg-card/40 hover:border-primary/50 transition-all flex flex-col justify-between space-y-2.5 group">
                  <div className="flex items-start justify-between">
                    <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                      <Ticket className="h-4 w-4" />
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-semibold">
                      {Array.isArray(ticketSetup?.support_roles) ? ticketSetup.support_roles.length : 0} Yetkili Rol
                    </Badge>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">Bilet Destek Ekibi</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Özel talepleri görüntüleme ve kapatma yetkili rolleri.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("ticket")}
                    className="w-full h-7 text-[11px] rounded-lg border-border/70 group-hover:border-primary/50 group-hover:text-primary transition-all cursor-pointer"
                  >
                    Yönet
                  </Button>
                </div>

                {/* 4. Level XP Whitelist */}
                <div className="p-3.5 rounded-2xl border border-border/70 bg-card/40 hover:border-primary/50 transition-all flex flex-col justify-between space-y-2.5 group">
                  <div className="flex items-start justify-between">
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      <Award className="h-4 w-4" />
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-semibold">
                      {(Array.isArray(level.exempt_channels) ? level.exempt_channels.length : 0) + (Array.isArray(level.exempt_roles) ? level.exempt_roles.length : 0)} Muaf
                    </Badge>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">XP Muafiyetleri</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Mesaj ve ses XP kazanımı kapalı olan kanallar ve roller.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("music_levels")}
                    className="w-full h-7 text-[11px] rounded-lg border-border/70 group-hover:border-primary/50 group-hover:text-primary transition-all cursor-pointer"
                  >
                    Yönet
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. AUTOMOD TAB */}
        <TabsContent value="automod" className="space-y-6">
          <Card className="liquid-glass border-border/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center justify-between">
                <span>Gelişmiş AutoMod Parametreleri</span>
                <Button
                  size="sm"
                  onClick={() => saveConfigModule("automod", automod)}
                  disabled={savingModule === "automod"}
                  className="h-8 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {savingModule === "automod" ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </CardTitle>
              <CardDescription className="text-xs">
                Botun Discord'da uyguladığı kurallar ve eşik değerleri.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card/40">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold">Küfür Engeli</Label>
                    <p className="text-[10px] text-muted-foreground">Uygunsuz sözcük</p>
                  </div>
                  <Switch
                    checked={!!automod.anti_swear}
                    onCheckedChange={(val) => setConfigs({ ...configs, automod: { ...automod, anti_swear: val ? 1 : 0 } })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card/40">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold">Davet Engeli</Label>
                    <p className="text-[10px] text-muted-foreground">Sunucu reklamı</p>
                  </div>
                  <Switch
                    checked={!!automod.anti_invite}
                    onCheckedChange={(val) => setConfigs({ ...configs, automod: { ...automod, anti_invite: val ? 1 : 0 } })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card/40">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold">Link Engeli</Label>
                    <p className="text-[10px] text-muted-foreground">Harici URL</p>
                  </div>
                  <Switch
                    checked={!!automod.anti_link}
                    onCheckedChange={(val) => setConfigs({ ...configs, automod: { ...automod, anti_link: val ? 1 : 0 } })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-3 rounded-xl border border-border/60 bg-card/40 space-y-1.5">
                  <Label className="text-xs font-semibold">Caps Eşiği (%)</Label>
                  <Input
                    type="number"
                    min="10"
                    max="100"
                    value={automod.caps_percent || 70}
                    onChange={(e) => setConfigs({ ...configs, automod: { ...automod, caps_percent: Number(e.target.value) } })}
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">Büyük harf kullanım oranı</p>
                </div>

                <div className="p-3 rounded-xl border border-border/60 bg-card/40 space-y-1.5">
                  <Label className="text-xs font-semibold">Etiket Limiti</Label>
                  <Input
                    type="number"
                    min="1"
                    value={automod.mention_limit || 5}
                    onChange={(e) => setConfigs({ ...configs, automod: { ...automod, mention_limit: Number(e.target.value) } })}
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">Maksimum etiket sayısı</p>
                </div>

                <div className="p-3 rounded-xl border border-border/60 bg-card/40 space-y-1.5">
                  <Label className="text-xs font-semibold">Spam Limiti</Label>
                  <Input
                    value={automod.spam_limit || "5/5s"}
                    onChange={(e) => setConfigs({ ...configs, automod: { ...automod, spam_limit: e.target.value } })}
                    className="h-8 text-xs"
                    placeholder="5/5s"
                  />
                  <p className="text-[10px] text-muted-foreground">Saniyede mesaj eşiği</p>
                </div>

                <div className="p-3 rounded-xl border border-border/60 bg-card/40 space-y-1.5">
                  <Label className="text-xs font-semibold">Emoji Limiti</Label>
                  <Input
                    type="number"
                    min="0"
                    value={automod.emoji_limit || 0}
                    onChange={(e) => setConfigs({ ...configs, automod: { ...automod, emoji_limit: Number(e.target.value) } })}
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">0 = limitsiz</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 rounded-xl border border-border/60 bg-card/40 space-y-1.5">
                  <Label className="text-xs font-semibold">Ceza Türü</Label>
                  <CustomSelect
                    value={automod.punishment_type || "mute"}
                    onChange={(val) => setConfigs({ ...configs, automod: { ...automod, punishment_type: val } })}
                    options={[
                      { value: "delete", label: "Sadece Mesajı Sil" },
                      { value: "warn", label: "Uyar (Warn Ekle)" },
                      { value: "mute", label: "Zaman Aşımı (Mute)" },
                      { value: "kick", label: "Sunucudan At (Kick)" },
                      { value: "ban", label: "Yasakla (Ban)" }
                    ]}
                  />
                </div>

                <div className="p-3 rounded-xl border border-border/60 bg-card/40 space-y-1.5">
                  <Label className="text-xs font-semibold">Mute Süresi (Dakika)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={automod.mute_duration || 10}
                    onChange={(e) => setConfigs({ ...configs, automod: { ...automod, mute_duration: Number(e.target.value) } })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filtered Words Table Card */}
          <Card className="liquid-glass border-border/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base font-display flex items-center justify-between">
                <span>Özel Yasaklı Kelime Listesi ({filteredWords.length} Adet)</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Sunucunuzda otomatik engellenmesini istediğiniz kelimeleri ekleyin.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Yasaklanacak kelimeyi yazın..."
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddWord()}
                  className="h-9 text-xs flex-1"
                />
                <div className="w-28">
                  <CustomSelect
                    value={newWordAction}
                    onChange={setNewWordAction}
                    options={[
                      { value: "warn", label: "Uyar" },
                      { value: "delete", label: "Sil" },
                      { value: "mute", label: "Sustur" }
                    ]}
                  />
                </div>
                <Button size="sm" onClick={handleAddWord} className="h-9 text-xs gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Ekle
                </Button>
              </div>

              {filteredWords && filteredWords.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  {filteredWords.map((item: any) => (
                    <div
                      key={item.id}
                      className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg border border-border/60 bg-card/60 text-xs font-mono"
                    >
                      <span>{item.word}</span>
                      <Badge variant="outline" className="text-[9px] py-0 px-1 border-muted-foreground/40 text-muted-foreground">
                        {item.action}
                      </Badge>
                      <button
                        onClick={() => handleDeleteWord(item.id)}
                        className="text-destructive/70 hover:text-destructive transition-colors ml-0.5"
                        title="Kelimeyi Sil"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic pt-1">
                  Henüz özel yasaklı kelime eklenmemiş.
                </p>
              )}
            </CardContent>
          </Card>

          {/* AutoMod Whitelist & Exemptions Card */}
          <Card className="liquid-glass border-border/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base font-display flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span>AutoMod Muafiyetleri & Güvenli Liste (Whitelist)</span>
                </span>
                <Button
                  size="sm"
                  onClick={() => saveConfigModule("automod", automod)}
                  disabled={savingModule === "automod"}
                  className="h-8 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {savingModule === "automod" ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </CardTitle>
              <CardDescription className="text-xs">
                Korumadan muaf tutulacak rolleri ve kanalları belirleyin. Bu rol ve kanallar küfür, reklam, spam vb. filtrelere takılmaz.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5 p-3.5 rounded-xl border border-border/60 bg-card/40">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-primary" />
                    Korumadan Muaf Roller
                  </Label>
                  <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                    {Array.isArray(automod.exempt_roles) ? automod.exempt_roles.length : 0} Rol Muaf
                  </Badge>
                </div>
                <MultiRoleSelect
                  values={Array.isArray(automod.exempt_roles) ? automod.exempt_roles : []}
                  onChange={(vals) => setConfigs({ ...configs, automod: { ...automod, exempt_roles: vals } })}
                  roles={roles}
                  placeholder="+ Muaf Rol Ekle..."
                />
                <p className="text-[10px] text-muted-foreground">Bu rollere sahip üyelerin mesajları AutoMod filtrelerine takılmaz.</p>
              </div>

              <div className="space-y-1.5 p-3.5 rounded-xl border border-border/60 bg-card/40">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-primary" />
                    Korumadan Muaf Kanallar
                  </Label>
                  <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                    {Array.isArray(automod.exempt_channels) ? automod.exempt_channels.length : 0} Kanal Muaf
                  </Badge>
                </div>
                <MultiChannelSelect
                  values={Array.isArray(automod.exempt_channels) ? automod.exempt_channels : []}
                  onChange={(vals) => setConfigs({ ...configs, automod: { ...automod, exempt_channels: vals } })}
                  channels={textChannels}
                  placeholder="+ Muaf Kanal Ekle..."
                />
                <p className="text-[10px] text-muted-foreground">Bu kanallarda paylaşılan mesajlar AutoMod tarafından taranmaz (örn: yetkili odası, bot kanalı).</p>
              </div>

              <div className="space-y-1.5 p-3.5 rounded-xl border border-border/60 bg-card/40">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5 text-primary" />
                    Medya Kanalları (Sadece Görsel / Video / Dosya)
                  </Label>
                  <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                    {Array.isArray(automod.media_channels) ? automod.media_channels.length : 0} Medya Kanalı
                  </Badge>
                </div>
                <MultiChannelSelect
                  values={Array.isArray(automod.media_channels) ? automod.media_channels : []}
                  onChange={(vals) => setConfigs({ ...configs, automod: { ...automod, media_channels: vals } })}
                  channels={textChannels}
                  placeholder="+ Medya Kanalı Ekle..."
                />
                <p className="text-[10px] text-muted-foreground">Bu kanallara ekli dosya/resim içermeyen düz metin mesajı yazılırsa otomatik olarak silinir.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. ANTI-NUKE TAB */}
        <TabsContent value="antinuke">
          <Card className="liquid-glass border-border/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center justify-between">
                <span>Anti-Nuke & Sunucu Koruma Sistemi</span>
                <Button
                  size="sm"
                  onClick={() => saveConfigModule("antinuke", antinuke)}
                  disabled={savingModule === "antinuke"}
                  className="h-8 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {savingModule === "antinuke" ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </CardTitle>
              <CardDescription className="text-xs">
                Yetkililerin kanalları veya rolleri toplu silmesini engelleyen profesyonel güvenlik katmanı.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between p-4 rounded-xl border border-primary/30 bg-primary/5">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Anti-Nuke Ana Koruma
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Açık olduğunda belirlenen limitleri aşan yöneticilerin yetkileri anında alınır ve ceza uygulanır.
                  </p>
                </div>
                <Switch
                  checked={!!antinuke.is_enabled}
                  onCheckedChange={(val) => setConfigs({ ...configs, antinuke: { ...antinuke, is_enabled: val ? 1 : 0 } })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-border/60 bg-card/40 space-y-2">
                  <Label className="text-xs font-semibold">Kanal Silme Limiti</Label>
                  <Input
                    type="number"
                    min="1"
                    value={antinuke.channel_delete_limit || 3}
                    onChange={(e) => setConfigs({ ...configs, antinuke: { ...antinuke, channel_delete_limit: Number(e.target.value) } })}
                    className="h-9 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">Kısa sürede bu kadar kanal silinirse koruma tetiklenir.</p>
                </div>

                <div className="p-4 rounded-xl border border-border/60 bg-card/40 space-y-2">
                  <Label className="text-xs font-semibold">Rol Silme Limiti</Label>
                  <Input
                    type="number"
                    min="1"
                    value={antinuke.role_delete_limit || 3}
                    onChange={(e) => setConfigs({ ...configs, antinuke: { ...antinuke, role_delete_limit: Number(e.target.value) } })}
                    className="h-9 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">Kısa sürede bu kadar rol silinirse koruma tetiklenir.</p>
                </div>

                <div className="p-4 rounded-xl border border-border/60 bg-card/40 space-y-2">
                  <Label className="text-xs font-semibold">Ban / Kick Limiti</Label>
                  <Input
                    type="number"
                    min="1"
                    value={antinuke.ban_limit || 3}
                    onChange={(e) => setConfigs({ ...configs, antinuke: { ...antinuke, ban_limit: Number(e.target.value) } })}
                    className="h-9 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">Toplu üye atma/yasaklama girişiminde koruma devreye girer.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-card/40">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">İzinsiz Bot Ekleme Engeli</Label>
                    <p className="text-xs text-muted-foreground">Whitelist dışındaki üyeler bot ekleyemez.</p>
                  </div>
                  <Switch
                    checked={!!antinuke.anti_bot_add}
                    onCheckedChange={(val) => setConfigs({ ...configs, antinuke: { ...antinuke, anti_bot_add: val ? 1 : 0 } })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-card/40">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">İzinsiz Webhook Engeli</Label>
                    <p className="text-xs text-muted-foreground">Webhook açarak spam yapılmasını önler.</p>
                  </div>
                  <Switch
                    checked={!!antinuke.anti_webhook}
                    onCheckedChange={(val) => setConfigs({ ...configs, antinuke: { ...antinuke, anti_webhook: val ? 1 : 0 } })}
                  />
                </div>
              </div>

              {/* Whitelist Manager (Member & Role Picker) */}
              <div className="p-4 rounded-xl border border-border/80 bg-card/60 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                  <div>
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      Güvenli Liste & İstisnalar (Whitelist - Kişi ve Rol Seçimi)
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Bu listede yer alan kişiler ve roller Anti-Nuke koruma sınırlarından ve cezalarından muaftır.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 p-1 bg-background/80 rounded-lg border border-border/60">
                    <button
                      type="button"
                      onClick={() => setWhitelistType("user")}
                      className={`text-xs px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 ${whitelistType === "user" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      Kişi / Üye Ekle
                    </button>
                    <button
                      type="button"
                      onClick={() => setWhitelistType("role")}
                      className={`text-xs px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 ${whitelistType === "role" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <Shield className="h-3.5 w-3.5" />
                      Rol Ekle
                    </button>
                  </div>
                </div>

                {/* Add Target Row */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  {whitelistType === "user" ? (
                    <MemberSelect
                      value={selectedMemberId}
                      onChange={setSelectedMemberId}
                      members={members}
                      placeholder={`-- Sunucudan Kişi / Üye Seçiniz (${members.length} üye) --`}
                      className="flex-1"
                    />
                  ) : (
                    <RoleSelect
                      value={selectedRoleId}
                      onChange={setSelectedRoleId}
                      roles={roles}
                      placeholder={`-- Sunucudan Rol Seçiniz (${roles.length} rol) --`}
                      className="flex-1"
                    />
                  )}

                  <Button
                    size="sm"
                    onClick={handleAddWhitelist}
                    disabled={whitelistLoading || (whitelistType === "user" ? !selectedMemberId : !selectedRoleId)}
                    className="h-9 text-xs bg-primary text-primary-foreground gap-1.5 shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {whitelistLoading ? "Ekleniyor..." : "Listeye Ekle"}
                  </Button>
                </div>

                {/* Whitelist Display Items */}
                <div className="space-y-2 pt-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Şu Anda Listede Olanlar ({Array.isArray(antinuke.whitelist) ? antinuke.whitelist.length : 0})
                  </Label>
                  {(!Array.isArray(antinuke.whitelist) || antinuke.whitelist.length === 0) ? (
                    <div className="p-4 rounded-lg border border-dashed border-border/60 text-center text-xs text-muted-foreground">
                      Henüz güvenli listeye eklenmiş kişi veya rol bulunmuyor.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                      {antinuke.whitelist.map((item: any) => {
                        const isUser = item.target_type === 'user';
                        const targetUser = isUser ? members.find(m => m.id === item.target_id) : null;
                        const targetRole = !isUser ? roles.find(r => r.id === item.target_id) : null;
                        return (
                          <div
                            key={item.target_id}
                            className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-card/40 text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {isUser ? (
                                targetUser?.avatar ? (
                                  <img src={targetUser.avatar} alt="avatar" className="w-6 h-6 rounded-full shrink-0" />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-primary/20 grid place-items-center font-bold text-[10px] text-primary shrink-0">
                                    U
                                  </div>
                                )
                              ) : (
                                <div
                                  className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20"
                                  style={{ backgroundColor: typeof targetRole?.color === 'number' ? `#${targetRole.color.toString(16).padStart(6, '0')}` : (targetRole?.color || '#99aab5') }}
                                />
                              )}
                              <div className="min-w-0 truncate">
                                <div className="font-semibold truncate">
                                  {isUser ? (targetUser?.displayName || item.target_id) : (targetRole?.name || item.target_id)}
                                </div>
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                                  <Badge variant="outline" className="text-[9px] py-0 px-1 border-border/60">
                                    {isUser ? "Kişi" : "Rol"}
                                  </Badge>
                                  <span className="font-mono text-[9px]">{item.target_id}</span>
                                </div>
                              </div>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleRemoveWhitelist(item.target_id)}
                              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 ml-2"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3.5. CEZA & DENETİM KAYDI (AUDIT LOGS) TAB */}
        <TabsContent value="audit_logs" className="space-y-6">
          {/* Stats Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="liquid-glass border-border/60 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground font-medium block">Toplam Ceza</span>
                  <span className="text-2xl font-bold font-display text-white mt-1 block">{auditStats.total}</span>
                </div>
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 grid place-items-center text-primary">
                  <History className="h-5 w-5" />
                </div>
              </div>
            </Card>

            <Card className="liquid-glass border-border/60 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground font-medium block">Aktif Banlar</span>
                  <span className="text-2xl font-bold font-display text-rose-400 mt-1 block">{auditStats.activeBans}</span>
                </div>
                <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 grid place-items-center text-rose-400">
                  <Ban className="h-5 w-5" />
                </div>
              </div>
            </Card>

            <Card className="liquid-glass border-border/60 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground font-medium block">Aktif Susturmalar</span>
                  <span className="text-2xl font-bold font-display text-amber-400 mt-1 block">{auditStats.activeMutes}</span>
                </div>
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 grid place-items-center text-amber-400">
                  <Clock className="h-5 w-5" />
                </div>
              </div>
            </Card>

            <Card className="liquid-glass border-border/60 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground font-medium block">Kayıtlı Uyarılar</span>
                  <span className="text-2xl font-bold font-display text-sky-400 mt-1 block">{auditStats.totalWarns}</span>
                </div>
                <div className="h-10 w-10 rounded-xl bg-sky-500/10 border border-sky-500/20 grid place-items-center text-sky-400">
                  <ShieldAlert className="h-5 w-5" />
                </div>
              </div>
            </Card>
          </div>

          {/* Audit Logs Table & Filter Panel */}
          <Card className="liquid-glass border-border/60 rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-display flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <span>Canlı Ceza & Denetim Kaydı (Audit Log)</span>
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Sunucuda yetkililer veya AutoMod tarafından uygulanan tüm cezaları filtreleyin, inceleyin veya tek tıkla kaldırın.
                  </CardDescription>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Kullanıcı ID, Yetkili veya Sebep Ara..."
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && fetchAuditLogs()}
                      className="pl-8 h-8 text-xs bg-card/40 border-border/60 rounded-xl"
                    />
                  </div>

                  {/* Type Filter */}
                  <div className="flex items-center gap-1 bg-card/40 border border-border/60 rounded-xl p-0.5">
                    {[
                      { id: "all", label: "Tümü" },
                      { id: "ban", label: "Ban" },
                      { id: "mute", label: "Mute" },
                      { id: "warn", label: "Warn" },
                      { id: "kick", label: "Kick" }
                    ].map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setAuditTypeFilter(f.id)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg transition-all font-medium cursor-pointer ${auditTypeFilter === f.id ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Status Filter */}
                  <div className="flex items-center gap-1 bg-card/40 border border-border/60 rounded-xl p-0.5">
                    {[
                      { id: "all", label: "Tüm Durumlar" },
                      { id: "active", label: "Aktif" },
                      { id: "inactive", label: "Pasif" }
                    ].map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setAuditStatusFilter(f.id)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg transition-all font-medium cursor-pointer ${auditStatusFilter === f.id ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetchAuditLogs()}
                    disabled={auditLoading}
                    className="h-8 px-2.5 text-xs rounded-xl cursor-pointer"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${auditLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {auditLoading ? (
                <div className="p-12 text-center text-xs text-muted-foreground">Ceza kayıtları yükleniyor...</div>
              ) : auditLogs.length === 0 ? (
                <div className="p-12 text-center text-xs text-muted-foreground">
                  Belirtilen filtrelere uygun ceza kaydı bulunamadı.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/50 bg-card/30 text-muted-foreground font-medium">
                        <th className="py-3 px-4">İşlem Türü</th>
                        <th className="py-3 px-4">Hedef Kullanıcı</th>
                        <th className="py-3 px-4">Yetkili / Uygulayan</th>
                        <th className="py-3 px-4">Gerekçe / Sebep</th>
                        <th className="py-3 px-4">Tarih</th>
                        <th className="py-3 px-4">Durum</th>
                        <th className="py-3 px-4 text-right">Eylemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {auditLogs.map((item) => {
                        const act = (item.action_type || "").toLowerCase();
                        const isActive = Boolean(item.is_active);

                        let badgeColor = "bg-primary/10 text-primary border-primary/20";
                        let typeLabel = act.toUpperCase();

                        if (act === "ban") {
                          badgeColor = "bg-rose-500/10 text-rose-400 border-rose-500/30";
                          typeLabel = "Yasaklama (Ban)";
                        } else if (act === "mute" || act === "vmute") {
                          badgeColor = "bg-amber-500/10 text-amber-400 border-amber-500/30";
                          typeLabel = act === "vmute" ? "Ses Susturma" : "Susturma (Mute)";
                        } else if (act === "warn") {
                          badgeColor = "bg-sky-500/10 text-sky-400 border-sky-500/30";
                          typeLabel = "Uyarı (Warn)";
                        } else if (act === "kick") {
                          badgeColor = "bg-orange-500/10 text-orange-400 border-orange-500/30";
                          typeLabel = "Sunucudan Atma (Kick)";
                        } else if (act === "softban") {
                          badgeColor = "bg-purple-500/10 text-purple-400 border-purple-500/30";
                          typeLabel = "Hafif Ban (Softban)";
                        }

                        const targetMember = members.find(m => m.id === item.user_id);
                        const modMember = members.find(m => m.id === item.moderator_id);

                        return (
                          <tr key={`${item.source}-${item.id}`} className="hover:bg-primary/5 transition-colors">
                            <td className="py-3 px-4">
                              <Badge variant="outline" className={`text-[10px] ${badgeColor}`}>
                                {typeLabel}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              {(() => {
                                const defaultAvatar = `https://cdn.discordapp.com/embed/avatars/${(parseInt((item.user_id || "0").slice(-2)) || 0) % 5}.png`;
                                const avatarUrl = targetMember?.avatar || item.user_avatar || defaultAvatar;
                                const name = targetMember ? (targetMember.displayName || targetMember.username) : (item.user_tag || `Kullanıcı (${item.user_id})`);

                                return (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (item.user_id) {
                                        setActiveTab("sorgu");
                                        setSorguUserId(item.user_id);
                                        handleFetchSorgu(item.user_id);
                                      }
                                    }}
                                    className="flex items-center gap-2.5 text-left group cursor-pointer"
                                    title="Kullanıcı profili ve sicilini incele"
                                  >
                                    <img
                                      src={avatarUrl}
                                      alt={name}
                                      className="h-7 w-7 rounded-full object-cover shrink-0 ring-1 ring-border/80 group-hover:ring-primary transition-all"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).src = defaultAvatar;
                                      }}
                                    />
                                    <div className="min-w-0">
                                      <span className="font-semibold text-foreground text-xs block truncate group-hover:text-primary transition-colors">
                                        {name}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground font-mono">ID: {item.user_id}</span>
                                    </div>
                                  </button>
                                );
                              })()}
                            </td>
                            <td className="py-3 px-4">
                              {(() => {
                                if (modMember) {
                                  return (
                                    <div className="flex items-center gap-2">
                                      <img
                                        src={modMember.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"}
                                        alt={modMember.displayName}
                                        className="h-5 w-5 rounded-full object-cover shrink-0 ring-1 ring-border/50"
                                      />
                                      <span className="text-foreground text-xs font-medium">{modMember.displayName || modMember.username}</span>
                                    </div>
                                  );
                                }
                                return (
                                  <span className="text-muted-foreground text-xs font-mono">
                                    {item.moderator_id ? `<@${item.moderator_id}>` : "Sistem"}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="py-3 px-4 max-w-[220px]">
                              <span className="truncate block text-muted-foreground font-medium" title={item.reason || "Belirtilmedi"}>
                                {item.reason || "Belirtilmedi"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-muted-foreground text-[11px] whitespace-nowrap">
                              {item.created_at ? new Date(item.created_at).toLocaleString("tr-TR") : "-"}
                            </td>
                            <td className="py-3 px-4">
                              {isActive ? (
                                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1">
                                  <CheckCircle className="h-3 w-3" /> Aktif
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-muted/30 text-muted-foreground border-border/50 gap-1">
                                  <XCircle className="h-3 w-3" /> Pasif
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              {isActive && (act === "ban" || act === "mute" || act === "vmute" || act === "warn") ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRevokePenalty(item)}
                                  disabled={revokingId === item.id}
                                  className="h-7 text-[11px] border-rose-500/30 text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                                >
                                  {revokingId === item.id ? "Kaldırılıyor..." : "Cezayı Kaldır"}
                                </Button>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3.8. KULLANICI SİCİL & SORGU TAB (/sorgu) */}
        <TabsContent value="sorgu" className="space-y-6">
          {/* Arama & Kullanıcı Seçim Kartı */}
          <Card className="liquid-glass border-border/60 rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-display flex items-center gap-2">
                    <Search className="h-5 w-5 text-primary" />
                    <span>Kullanıcı Sicil & Sorgu Paneli (`/sorgu`)</span>
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Sunucudaki herhangi bir üyenin veya yetkilinin profil kayıtlarını, ceza geçmişini, moderatör notlarını ve istatistiklerini anlık inceleyin.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sorguUserId && handleFetchSorgu(sorguUserId)}
                    disabled={sorguLoading || !sorguUserId}
                    className="h-8 px-2.5 text-xs rounded-xl cursor-pointer"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${sorguLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center justify-between">
                    <span>Sorgulamak İstediğiniz Sunucu Üyesini Seçin:</span>
                    {sorguUserId && (
                      <span className="text-[11px] font-mono text-primary">Seçili ID: {sorguUserId}</span>
                    )}
                  </Label>
                  <MemberSelect
                    members={members}
                    value={sorguUserId}
                    onChange={(val) => {
                      setSorguUserId(val);
                      if (val) handleFetchSorgu(val);
                    }}
                    placeholder={`-- Sunucudan Bir Üye Seçin veya İsimle Arayın (${members.length} üye) --`}
                    className="h-10"
                  />
                </div>
                <Button
                  onClick={() => handleFetchSorgu(sorguUserId)}
                  disabled={sorguLoading || !sorguUserId.trim()}
                  className="h-10 px-5 text-xs rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 cursor-pointer shrink-0"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${sorguLoading ? "animate-spin" : ""}`} />
                  <span>Yeniden Sorgula</span>
                </Button>
              </div>

              {/* Hızlı Seçim Butonları */}
              {members.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] text-muted-foreground font-medium block">Hızlı Üye Seçimi:</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {members.slice(0, 10).map((m) => {
                      const isSel = sorguUserId === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setSorguUserId(m.id);
                            handleFetchSorgu(m.id);
                          }}
                          className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-xl border transition-all cursor-pointer ${
                            isSel
                              ? "bg-primary/20 border-primary text-primary font-medium shadow-sm"
                              : "bg-card/40 border-border/40 text-muted-foreground hover:text-foreground hover:bg-card/70"
                          }`}
                        >
                          <img
                            src={m.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"}
                            alt={m.displayName}
                            className="h-3.5 w-3.5 rounded-full object-cover shrink-0"
                          />
                          <span>{m.displayName || m.username}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Yükleniyor Durumu */}
          {sorguLoading && (
            <div className="space-y-4">
              <Skeleton className="h-36 w-full rounded-2xl" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          )}

          {/* Sorgu Verisi Yüklendiğinde Gösterilecek Kartlar */}
          {!sorguLoading && sorguData && (
            <div className="space-y-6">
              {/* 1. Kullanıcı Profil ve Özet Kartı */}
              <Card className="liquid-glass border-border/60 rounded-2xl overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        {sorguData.user.avatar ? (
                          <img
                            src={sorguData.user.avatar}
                            alt={sorguData.user.username}
                            className="h-20 w-20 rounded-2xl border-2 border-border/60 object-cover shadow-lg"
                          />
                        ) : (
                          <div className="h-20 w-20 rounded-2xl bg-primary/20 border-2 border-primary/40 flex items-center justify-center font-bold text-2xl text-primary font-display">
                            {sorguData.user.username ? sorguData.user.username.slice(0, 2).toUpperCase() : "U"}
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 bg-emerald-500 h-4 w-4 rounded-full border-2 border-background" title="Aktif" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-bold font-display text-foreground">
                            {sorguData.user.global_name || sorguData.user.username}
                          </h3>
                          <Badge variant="outline" className="text-xs bg-muted/40 text-muted-foreground border-border/60 font-mono">
                            @{sorguData.user.username}
                          </Badge>
                          {sorguData.staffStats?.isStaff && (
                            <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-400 border-indigo-500/30 gap-1">
                              <Shield className="h-3 w-3" /> Yetkili Profil
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-mono">
                          <span>ID: {sorguData.user.id}</span>
                          <span>•</span>
                          <span className="text-amber-400 font-semibold inline-flex items-center gap-1">
                            <Award className="h-3.5 w-3.5" />
                            {sorguData.user.rep} İtibar (Rep)
                          </span>
                          {sorguData.user.birthday && (
                            <>
                              <span>•</span>
                              <span className="text-sky-400 inline-flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {sorguData.user.birthday}
                              </span>
                            </>
                          )}
                          {sorguData.user.afk && (
                            <>
                              <span>•</span>
                              <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-400 border-rose-500/30">
                                AFK ({sorguData.user.afk.reason || "Belirtilmedi"})
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Hızlı İstatistikler */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
                      <div className="bg-card/40 border border-border/40 p-3 rounded-xl text-center min-w-[90px]">
                        <span className="text-[10px] text-muted-foreground block">Toplam Ceza</span>
                        <span className={`text-base font-bold font-mono ${sorguData.warnings.length + sorguData.mutes.length > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                          {sorguData.warnings.length + sorguData.mutes.length}
                        </span>
                      </div>
                      <div className="bg-card/40 border border-border/40 p-3 rounded-xl text-center min-w-[90px]">
                        <span className="text-[10px] text-muted-foreground block">Mod Notları</span>
                        <span className="text-base font-bold font-mono text-foreground">
                          {sorguData.notes.length}
                        </span>
                      </div>
                      <div className="bg-card/40 border border-border/40 p-3 rounded-xl text-center min-w-[90px]">
                        <span className="text-[10px] text-muted-foreground block">Destek Bilet</span>
                        <span className="text-base font-bold font-mono text-primary">
                          {sorguData.tickets.length}
                        </span>
                      </div>
                      <div className="bg-card/40 border border-border/40 p-3 rounded-xl text-center min-w-[90px]">
                        <span className="text-[10px] text-muted-foreground block">Net Davet</span>
                        <span className="text-base font-bold font-mono text-emerald-400">
                          {sorguData.user.invites.net}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tarih ve Davet Detayı */}
                  <div className="mt-6 pt-4 border-t border-border/40 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-muted-foreground block">Sunucuya Katılış Tarihi:</span>
                      <span className="font-medium text-foreground">
                        {sorguData.user.joined_at ? new Date(sorguData.user.joined_at).toLocaleString("tr-TR") : "Sunucuda değil / Bilinmiyor"}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground block">Davet İstatistikleri:</span>
                      <span className="font-medium text-foreground font-mono">
                        {sorguData.user.invites.regular} gerçek • {sorguData.user.invites.left} ayrılan • {sorguData.user.invites.fake} sahte
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground block">Onu Davet Eden:</span>
                      <span className="font-medium text-foreground">
                        {sorguData.user.invites.invitedBy ? (
                          `ID: ${sorguData.user.invites.invitedBy.inviter_id} (Kod: ${sorguData.user.invites.invitedBy.invite_code || "Özel"})`
                        ) : (
                          "Bilinmiyor veya Doğrudan Link"
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Sahip Olduğu Roller */}
                  {Array.isArray(sorguData.user.roles) && sorguData.user.roles.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border/40 space-y-2">
                      <span className="text-xs text-muted-foreground block">Sahip Olduğu Roller ({sorguData.user.roles.length}):</span>
                      <div className="flex flex-wrap gap-1.5">
                        {sorguData.user.roles.map((roleId: string) => {
                          const rObj = roles.find(r => r.id === roleId);
                          return (
                            <Badge
                              key={roleId}
                              variant="outline"
                              className="text-[11px] bg-card/60 border-border/60 text-foreground"
                              style={{ borderColor: rObj?.color ? `#${rObj.color.toString(16).padStart(6, "0")}` : undefined }}
                            >
                              {rObj ? rObj.name : `Rol: ${roleId}`}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 2. Alt Sekmeler (Ceza Geçmişi, Mod Notları, Biletler, Silinen Mesajlar, Yetkili Performansı) */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-2">
                  <Button
                    size="sm"
                    variant={sorguSubTab === "penalties" ? "default" : "outline"}
                    onClick={() => setSorguSubTab("penalties")}
                    className="h-8 text-xs rounded-xl gap-1.5 cursor-pointer"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>Ceza & İhlal Geçmişi</span>
                    <Badge variant="outline" className="text-[10px] ml-1 px-1.5 py-0 bg-background/50">
                      {sorguData.warnings.length + sorguData.mutes.length}
                    </Badge>
                  </Button>

                  <Button
                    size="sm"
                    variant={sorguSubTab === "notes" ? "default" : "outline"}
                    onClick={() => setSorguSubTab("notes")}
                    className="h-8 text-xs rounded-xl gap-1.5 cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Moderatör Notları</span>
                    <Badge variant="outline" className="text-[10px] ml-1 px-1.5 py-0 bg-background/50">
                      {sorguData.notes.length}
                    </Badge>
                  </Button>

                  <Button
                    size="sm"
                    variant={sorguSubTab === "tickets" ? "default" : "outline"}
                    onClick={() => setSorguSubTab("tickets")}
                    className="h-8 text-xs rounded-xl gap-1.5 cursor-pointer"
                  >
                    <Ticket className="h-3.5 w-3.5" />
                    <span>Destek Talepleri</span>
                    <Badge variant="outline" className="text-[10px] ml-1 px-1.5 py-0 bg-background/50">
                      {sorguData.tickets.length}
                    </Badge>
                  </Button>

                  <Button
                    size="sm"
                    variant={sorguSubTab === "deleted" ? "default" : "outline"}
                    onClick={() => setSorguSubTab("deleted")}
                    className="h-8 text-xs rounded-xl gap-1.5 cursor-pointer"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Silinen Mesajlar</span>
                    <Badge variant="outline" className="text-[10px] ml-1 px-1.5 py-0 bg-background/50">
                      {sorguData.deletedMessages.length}
                    </Badge>
                  </Button>

                  {sorguData.staffStats?.isStaff && (
                    <Button
                      size="sm"
                      variant={sorguSubTab === "staff" ? "default" : "outline"}
                      onClick={() => setSorguSubTab("staff")}
                      className="h-8 text-xs rounded-xl gap-1.5 cursor-pointer"
                    >
                      <Sliders className="h-3.5 w-3.5" />
                      <span>Yetkili Performansı</span>
                      <Badge variant="outline" className="text-[10px] ml-1 px-1.5 py-0 bg-indigo-500/20 text-indigo-300">
                        {sorguData.staffStats.totalActions} Eylem
                      </Badge>
                    </Button>
                  )}
                </div>

                {/* Sub-Tab 1: Ceza Geçmişi */}
                {sorguSubTab === "penalties" && (
                  <Card className="liquid-glass border-border/60 rounded-2xl overflow-hidden">
                    <CardHeader className="border-b border-border/40 pb-3">
                      <CardTitle className="text-base font-display flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="h-4 w-4 text-rose-400" />
                          <span>Ceza ve Moderasyon Kayıtları</span>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {sorguData.warnings.length === 0 && sorguData.mutes.length === 0 ? (
                        <div className="p-8 text-center text-xs text-muted-foreground">
                          Bu kullanıcıya ait herhangi bir aktif veya geçmiş ceza kaydı bulunmuyor. (Temiz Sicil)
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-border/50 bg-card/30 text-muted-foreground font-medium">
                                <th className="py-3 px-4">Tür</th>
                                <th className="py-3 px-4">Gerekçe / Sebep</th>
                                <th className="py-3 px-4">Uygulayan Yetkili</th>
                                <th className="py-3 px-4">Tarih</th>
                                <th className="py-3 px-4">Durum</th>
                                <th className="py-3 px-4 text-right">Eylem</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                              {/* Warnings */}
                              {sorguData.warnings.map((w: any) => {
                                const modMem = members.find(m => m.id === w.moderator_id);
                                const isActive = Boolean(w.is_active);
                                return (
                                  <tr key={`warn-${w.id}`} className="hover:bg-primary/5 transition-colors">
                                    <td className="py-3 px-4">
                                      <Badge variant="outline" className="text-[10px] bg-sky-500/10 text-sky-400 border-sky-500/30">
                                        Uyarı (Warn)
                                      </Badge>
                                    </td>
                                    <td className="py-3 px-4 max-w-[200px]">
                                      <span className="truncate block font-medium text-foreground" title={w.reason || "Belirtilmedi"}>
                                        {w.reason || "Belirtilmedi"}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4">
                                      <span className="text-foreground">{modMem ? (modMem.displayName || modMem.username) : (w.moderator_id ? `<@${w.moderator_id}>` : "Sistem")}</span>
                                    </td>
                                    <td className="py-3 px-4 text-muted-foreground text-[11px] whitespace-nowrap">
                                      {w.created_at ? new Date(w.created_at).toLocaleString("tr-TR") : "-"}
                                    </td>
                                    <td className="py-3 px-4">
                                      {isActive ? (
                                        <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-400 border-rose-500/30">
                                          Aktif
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-[10px] bg-muted/40 text-muted-foreground border-border/50">
                                          Pasif
                                        </Badge>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                      {isActive && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleRevokePenalty({ id: w.id, source: "warn", action_type: "warn", user_id: w.user_id })}
                                          disabled={revokingId === w.id}
                                          className="h-7 text-[11px] border-rose-500/30 text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                                        >
                                          {revokingId === w.id ? "Kaldırılıyor..." : "Uyarıyı Sil"}
                                        </Button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}

                              {/* Mutes & Bans */}
                              {sorguData.mutes.map((m: any) => {
                                const modMem = members.find(mem => mem.id === m.moderator_id);
                                const isActive = Boolean(m.is_active);
                                const act = (m.action_type || "").toLowerCase();

                                let badgeColor = "bg-amber-500/10 text-amber-400 border-amber-500/30";
                                let actTitle = "Susturma (Mute)";
                                if (act === "ban") {
                                  badgeColor = "bg-rose-500/10 text-rose-400 border-rose-500/30";
                                  actTitle = "Yasaklama (Ban)";
                                } else if (act === "kick") {
                                  badgeColor = "bg-orange-500/10 text-orange-400 border-orange-500/30";
                                  actTitle = "Atılma (Kick)";
                                }

                                return (
                                  <tr key={`mute-${m.id}`} className="hover:bg-primary/5 transition-colors">
                                    <td className="py-3 px-4">
                                      <Badge variant="outline" className={`text-[10px] ${badgeColor}`}>
                                        {actTitle}
                                      </Badge>
                                    </td>
                                    <td className="py-3 px-4 max-w-[200px]">
                                      <span className="truncate block font-medium text-foreground" title={m.reason || "Belirtilmedi"}>
                                        {m.reason || "Belirtilmedi"}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4">
                                      <span className="text-foreground">{modMem ? (modMem.displayName || modMem.username) : (m.moderator_id ? `<@${m.moderator_id}>` : "Sistem")}</span>
                                    </td>
                                    <td className="py-3 px-4 text-muted-foreground text-[11px] whitespace-nowrap">
                                      {m.created_at ? new Date(m.created_at).toLocaleString("tr-TR") : "-"}
                                    </td>
                                    <td className="py-3 px-4">
                                      {isActive ? (
                                        <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-400 border-rose-500/30">
                                          Aktif
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-[10px] bg-muted/40 text-muted-foreground border-border/50">
                                          Pasif
                                        </Badge>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                      {isActive && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleRevokePenalty({ id: m.id, source: "mute", action_type: m.action_type, user_id: m.user_id })}
                                          disabled={revokingId === m.id}
                                          className="h-7 text-[11px] border-rose-500/30 text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                                        >
                                          {revokingId === m.id ? "Kaldırılıyor..." : "Cezayı Kaldır"}
                                        </Button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Sub-Tab 2: Moderatör Notları */}
                {sorguSubTab === "notes" && (
                  <div className="space-y-4">
                    {/* Yeni Not Ekleme Formu */}
                    <Card className="liquid-glass border-border/60 rounded-2xl p-4">
                      <div className="space-y-3">
                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-primary" />
                          <span>Bu Kullanıcı İçin Yeni Moderatör Notu Ekle</span>
                        </Label>
                        <Textarea
                          placeholder="Kullanıcı hakkında diğer yetkililerin görmesi gereken bir not yazın..."
                          value={newModNote}
                          onChange={(e) => setNewModNote(e.target.value)}
                          rows={2}
                          className="text-xs bg-card/40 border-border/60 rounded-xl resize-none"
                        />
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            onClick={handleAddModNote}
                            disabled={savingModNote || !newModNote.trim()}
                            className="h-8 text-xs rounded-xl bg-primary text-primary-foreground gap-1 cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>{savingModNote ? "Kaydediliyor..." : "Notu Kaydet"}</span>
                          </Button>
                        </div>
                      </div>
                    </Card>

                    {/* Notlar Listesi */}
                    <Card className="liquid-glass border-border/60 rounded-2xl overflow-hidden">
                      <CardHeader className="border-b border-border/40 pb-3">
                        <CardTitle className="text-base font-display flex items-center justify-between">
                          <span>Kayıtlı Moderatör Notları ({sorguData.notes.length})</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 space-y-3">
                        {sorguData.notes.length === 0 ? (
                          <div className="p-6 text-center text-xs text-muted-foreground">
                            Bu kullanıcıya ait henüz bir moderatör notu eklenmemiş.
                          </div>
                        ) : (
                          sorguData.notes.map((n: any) => {
                            const modMem = members.find(m => m.id === n.moderator_id);
                            return (
                              <div
                                key={n.id}
                                className="bg-card/40 border border-border/40 rounded-xl p-3 flex items-start justify-between gap-3 hover:border-border/60 transition-colors"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                    <span className="font-semibold text-foreground">
                                      {modMem ? (modMem.displayName || modMem.username) : `<@${n.moderator_id}>`}
                                    </span>
                                    <span>•</span>
                                    <span>{n.created_at ? new Date(n.created_at).toLocaleString("tr-TR") : "-"}</span>
                                  </div>
                                  <p className="text-xs text-foreground font-medium whitespace-pre-wrap">
                                    {n.note}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteModNote(n.id)}
                                  disabled={deletingNoteId === n.id}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                                  title="Notu Sil"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            );
                          })
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Sub-Tab 3: Destek Talepleri */}
                {sorguSubTab === "tickets" && (
                  <Card className="liquid-glass border-border/60 rounded-2xl overflow-hidden">
                    <CardHeader className="border-b border-border/40 pb-3">
                      <CardTitle className="text-base font-display flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Ticket className="h-4 w-4 text-primary" />
                          <span>Kullanıcının Açtığı Destek Talepleri ({sorguData.tickets.length})</span>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {sorguData.tickets.length === 0 ? (
                        <div className="p-8 text-center text-xs text-muted-foreground">
                          Bu kullanıcı tarafından açılmış herhangi bir destek talebi bulunmuyor.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-border/50 bg-card/30 text-muted-foreground font-medium">
                                <th className="py-3 px-4">Bilet No</th>
                                <th className="py-3 px-4">Kategori</th>
                                <th className="py-3 px-4">Konu / Sebep</th>
                                <th className="py-3 px-4">Açılış Tarihi</th>
                                <th className="py-3 px-4">Durum</th>
                                <th className="py-3 px-4 text-right">Transkript</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                              {sorguData.tickets.map((t: any) => {
                                const isOpen = t.status === "open";
                                return (
                                  <tr key={t.id} className="hover:bg-primary/5 transition-colors">
                                    <td className="py-3 px-4 font-mono font-bold text-white">#{t.id}</td>
                                    <td className="py-3 px-4">
                                      <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                                        {t.category || "Destek"}
                                      </Badge>
                                    </td>
                                    <td className="py-3 px-4 max-w-[200px]">
                                      <span className="truncate block text-muted-foreground" title={t.reason || "Destek"}>
                                        {t.reason || "Destek"}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-muted-foreground text-[11px] whitespace-nowrap">
                                      {t.opened_at ? new Date(t.opened_at).toLocaleString("tr-TR") : "-"}
                                    </td>
                                    <td className="py-3 px-4">
                                      {isOpen ? (
                                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                                          Aktif Açık
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-[10px] bg-muted/40 text-muted-foreground border-border/50">
                                          Kapatıldı
                                        </Badge>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                      <Button
                                        asChild
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-[11px] bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 rounded-lg gap-1 cursor-pointer"
                                      >
                                        <a href={`/transcripts/${t.id}`} target="_blank" rel="noreferrer">
                                          <span>Transkript</span>
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                      </Button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Sub-Tab 4: Silinen Mesajlar */}
                {sorguSubTab === "deleted" && (
                  <Card className="liquid-glass border-border/60 rounded-2xl overflow-hidden">
                    <CardHeader className="border-b border-border/40 pb-3">
                      <CardTitle className="text-base font-display flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-amber-400" />
                          <span>Silinen Mesaj Kayıtları ({sorguData.deletedMessages.length})</span>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {sorguData.deletedMessages.length === 0 ? (
                        <div className="p-8 text-center text-xs text-muted-foreground">
                          Bu kullanıcıya ait silinmiş mesaj kaydı bulunmuyor.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-border/50 bg-card/30 text-muted-foreground font-medium">
                                <th className="py-3 px-4">Kanal ID</th>
                                <th className="py-3 px-4">Mesaj İçeriği</th>
                                <th className="py-3 px-4">Silen Yetkili</th>
                                <th className="py-3 px-4">Sebep</th>
                                <th className="py-3 px-4 text-right">Silinme Tarihi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                              {sorguData.deletedMessages.map((d: any) => (
                                <tr key={d.id} className="hover:bg-primary/5 transition-colors">
                                  <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                                    <span className="inline-flex items-center gap-1">
                                      <Hash className="h-3 w-3" />
                                      {d.channel_id}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 max-w-[260px]">
                                    <span className="truncate block font-mono text-foreground" title={d.content || "Boş"}>
                                      {d.content || "Boş"}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="text-foreground">{d.deleted_by ? `<@${d.deleted_by}>` : "AutoMod / Sistem"}</span>
                                  </td>
                                  <td className="py-3 px-4 text-muted-foreground">
                                    {d.reason || "Kural İhlali"}
                                  </td>
                                  <td className="py-3 px-4 text-right text-muted-foreground text-[11px] whitespace-nowrap">
                                    {d.deleted_at ? new Date(d.deleted_at).toLocaleString("tr-TR") : "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Sub-Tab 5: Yetkili Moderasyon Performansı */}
                {sorguSubTab === "staff" && sorguData.staffStats?.isStaff && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      <Card className="liquid-glass border-border/60 rounded-xl p-4 text-center">
                        <span className="text-[10px] text-muted-foreground block">Toplam Eylem</span>
                        <span className="text-xl font-bold font-mono text-primary mt-1 block">
                          {sorguData.staffStats.totalActions}
                        </span>
                      </Card>
                      <Card className="liquid-glass border-border/60 rounded-xl p-4 text-center">
                        <span className="text-[10px] text-muted-foreground block">Verilen Uyarı</span>
                        <span className="text-xl font-bold font-mono text-sky-400 mt-1 block">
                          {sorguData.staffStats.warnsGiven}
                        </span>
                      </Card>
                      <Card className="liquid-glass border-border/60 rounded-xl p-4 text-center">
                        <span className="text-[10px] text-muted-foreground block">Susturma (Mute)</span>
                        <span className="text-xl font-bold font-mono text-amber-400 mt-1 block">
                          {sorguData.staffStats.mutesGiven}
                        </span>
                      </Card>
                      <Card className="liquid-glass border-border/60 rounded-xl p-4 text-center">
                        <span className="text-[10px] text-muted-foreground block">Uygulanan Ban</span>
                        <span className="text-xl font-bold font-mono text-rose-400 mt-1 block">
                          {sorguData.staffStats.bansGiven}
                        </span>
                      </Card>
                      <Card className="liquid-glass border-border/60 rounded-xl p-4 text-center">
                        <span className="text-[10px] text-muted-foreground block">Kapatılan Bilet</span>
                        <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">
                          {sorguData.staffStats.ticketsClosed}
                        </span>
                      </Card>
                      <Card className="liquid-glass border-border/60 rounded-xl p-4 text-center">
                        <span className="text-[10px] text-muted-foreground block">Silinen Mesaj</span>
                        <span className="text-xl font-bold font-mono text-foreground mt-1 block">
                          {sorguData.staffStats.delsCount}
                        </span>
                      </Card>
                    </div>

                    <Card className="liquid-glass border-border/60 rounded-2xl p-6">
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold font-display text-foreground flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-emerald-400" />
                          <span>Yetkili Denetim Değerlendirmesi</span>
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Bu yetkili sunucu moderasyonuna aktif olarak katkı sağlamaktadır. Komut geçmişi, kapatılan yardım biletleri ve silinen mesajlar Discord audit logları ve bot eylem kayıtları ile eşzamanlı olarak tutulmaktadır.
                        </p>
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* 4. DESTEK BİLET (TICKET) TAB & CANLI ÖNİZLEME */}
        <TabsContent value="ticket" className="space-y-6">
          {/* Bilet Durum Filtre Çubuğu */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-card/40 p-2.5 rounded-2xl border border-border/50">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={ticketStatusFilter === "all" ? "default" : "outline"}
                onClick={() => setTicketStatusFilter("all")}
                className="h-8 text-xs rounded-xl cursor-pointer"
              >
                Tüm Biletler ({tickets.length})
              </Button>
              <Button
                size="sm"
                variant={ticketStatusFilter === "open" ? "default" : "outline"}
                onClick={() => setTicketStatusFilter("open")}
                className="h-8 text-xs rounded-xl gap-1.5 cursor-pointer"
              >
                <Ticket className="h-3.5 w-3.5 text-emerald-400" />
                Aktif / Açık Talepler ({tickets.filter((t: any) => t.status === "open").length})
              </Button>
              <Button
                size="sm"
                variant={ticketStatusFilter === "closed" ? "default" : "outline"}
                onClick={() => setTicketStatusFilter("closed")}
                className="h-8 text-xs rounded-xl gap-1.5 cursor-pointer"
              >
                <History className="h-3.5 w-3.5 text-sky-400" />
                Kapatılan & Arşiv ({transcripts.length || tickets.filter((t: any) => t.status === "closed").length})
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  fetchGuildData();
                  fetchTranscripts();
                }}
                disabled={loading || transcriptsLoading}
                className="h-8 px-2.5 text-xs rounded-xl cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading || transcriptsLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Canlı Açık Destek Talepleri Tablosu (Aktif veya Tümü seçiliyken) */}
          {(ticketStatusFilter === "all" || ticketStatusFilter === "open") && (
          <Card className="liquid-glass border-border/60 rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-display flex items-center gap-2">
                    <Ticket className="h-5 w-5 text-primary" />
                    <span>Aktif Destek Talepleri (Açık Biletler)</span>
                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                      {tickets.filter((t: any) => t.status === "open").length} Açık
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Kullanıcıların Discord üzerinden oluşturduğu ve şu an aktif olan yardım taleplerini anlık yönetin.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fetchGuildData()}
                  disabled={loading}
                  className="h-8 px-2.5 text-xs rounded-xl cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {tickets.filter((t: any) => t.status === "open").length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Şu anda açık bir destek talebi bulunmuyor.</p>
                  <p>Kullanıcılar Discord'da bilet açtığında anlık burada listelenir, konuşmaları okunabilir ve sonlandırılabilir.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/50 bg-card/30 text-muted-foreground font-medium">
                        <th className="py-3 px-4">Bilet No</th>
                        <th className="py-3 px-4">Talep Sahibi</th>
                        <th className="py-3 px-4">Kategori</th>
                        <th className="py-3 px-4">Konu / Sebep</th>
                        <th className="py-3 px-4">Açılış Tarihi</th>
                        <th className="py-3 px-4">Mesajlar</th>
                        <th className="py-3 px-4 text-right">Eylemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {tickets
                        .filter((t: any) => t.status === "open")
                        .map((t: any) => (
                          <tr key={t.id} className="hover:bg-primary/5 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-white">
                              #{t.id}
                            </td>
                            <td className="py-3 px-4">
                              {(() => {
                                const ownerMember = members.find((m) => m.id === t.owner_id);
                                const defaultAvatar = `https://cdn.discordapp.com/embed/avatars/${(parseInt((t.owner_id || "0").slice(-2)) || 0) % 5}.png`;
                                const avatarUrl = ownerMember?.avatar || defaultAvatar;
                                const name = ownerMember ? (ownerMember.displayName || ownerMember.username) : (t.owner_tag || `Kullanıcı (${t.owner_id})`);

                                return (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (t.owner_id) {
                                        setActiveTab("sorgu");
                                        setSorguUserId(t.owner_id);
                                        handleFetchSorgu(t.owner_id);
                                      }
                                    }}
                                    className="flex items-center gap-2.5 text-left group cursor-pointer"
                                    title="Kullanıcı profili ve sicilini incele"
                                  >
                                    <img
                                      src={avatarUrl}
                                      alt={name}
                                      className="h-7 w-7 rounded-full object-cover shrink-0 ring-1 ring-border/80 group-hover:ring-primary transition-all"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).src = defaultAvatar;
                                      }}
                                    />
                                    <div className="min-w-0">
                                      <span className="font-semibold text-foreground text-xs block truncate group-hover:text-primary transition-colors">
                                        {name}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground font-mono">ID: {t.owner_id}</span>
                                    </div>
                                  </button>
                                );
                              })()}
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                                {t.category || "Genel Destek"}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 max-w-[200px]">
                              <span className="truncate block text-muted-foreground" title={t.reason || "Destek Talebi"}>
                                {t.reason || "Destek Talebi"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-muted-foreground text-[11px] whitespace-nowrap">
                              {t.opened_at ? new Date(t.opened_at).toLocaleString("tr-TR") : "-"}
                            </td>
                            <td className="py-3 px-4 font-medium">
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <MessageSquare className="h-3 w-3 text-amber-400" />
                                {t.message_count}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                              <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 rounded-lg gap-1 cursor-pointer"
                              >
                                <a href={`/transcripts/${t.id}`} target="_blank" rel="noreferrer">
                                  <span>Canlı Gör</span>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCloseTicket(t.id)}
                                disabled={closingTicketId === t.id}
                                className="h-7 text-[11px] border-rose-500/30 text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                              >
                                {closingTicketId === t.id ? "Kapatılıyor..." : "Talebi Kapat"}
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="liquid-glass border-border/60 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg font-display flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span>Destek Bilet Sistemi Yapılandırması (`/ticket`)</span>
                      {ticketSetup?.published_panel_id && (
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                          Discord'da Canlı (ID: {ticketSetup.published_panel_id})
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        type="button"
                        onClick={handlePublishTicketPanel}
                        disabled={publishingPanel === "ticket" || !ticketSetup?.panel_channel_id}
                        className="h-8 text-xs bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 gap-1.5"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {publishingPanel === "ticket" ? "Gönderiliyor..." : "Discord'a Paneli Gönder / Canlı Güncelle"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => saveConfigModule("ticket", ticketSetup)}
                        disabled={savingModule === "ticket"}
                        className="h-8 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
                      >
                        <Save className="h-3.5 w-3.5 mr-1.5" />
                        {savingModule === "ticket" ? "Kaydediliyor..." : "Kaydet"}
                      </Button>
                    </div>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Üyelerin sunucunuzda tek tıkla özel destek odası açmasını sağlar.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/40">
                      <Label className="text-xs font-semibold">Bilet Paneli Yayın Kanalı</Label>
                      <ChannelSelect
                        value={ticketSetup?.panel_channel_id || ""}
                        onChange={(val) => setConfigs({ ...configs, ticketSetup: { ...ticketSetup, panel_channel_id: val || null } })}
                        channels={textChannels}
                        placeholder="Metin kanalı seçiniz..."
                      />
                      <p className="text-[10px] text-muted-foreground">Panonun Discord'da görüntüleneceği kanal.</p>
                    </div>

                    <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/40">
                      <Label className="text-xs font-semibold">Bilet Kategori Alanı</Label>
                      <ChannelSelect
                        value={ticketSetup?.category_id || ""}
                        onChange={(val) => setConfigs({ ...configs, ticketSetup: { ...ticketSetup, category_id: val || null } })}
                        channels={categoryChannels}
                        type="category"
                        placeholder="Kategori seçiniz..."
                      />
                    </div>

                    <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/40">
                      <Label className="text-xs font-semibold">Bilet Log Kanalı</Label>
                      <ChannelSelect
                        value={ticketSetup?.log_channel_id || ""}
                        onChange={(val) => setConfigs({ ...configs, ticketSetup: { ...ticketSetup, log_channel_id: val || null } })}
                        channels={textChannels}
                        placeholder="Metin kanalı seçiniz..."
                      />
                    </div>

                    <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/40">
                      <Label className="text-xs font-semibold">Kapatma Davranışı</Label>
                      <CustomSelect
                        value={ticketSetup?.close_behavior || "archive"}
                        onChange={(val) => setConfigs({ ...configs, ticketSetup: { ...ticketSetup, close_behavior: val } })}
                        options={[
                          { value: "archive", label: "Arşivle & Kilitle (Arşiv Kategorisi)" },
                          { value: "delete", label: "Kanalı Tamamen Sil" }
                        ]}
                      />
                    </div>

                    {/* Multi-Role Support Staff Picker */}
                    <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/40 md:col-span-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-primary" />
                          Bilet Yetkili Rolleri (Destek Ekibi Whitelist)
                        </Label>
                        <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                          {(Array.isArray(ticketSetup?.support_roles) ? ticketSetup.support_roles : []).length} Yetkili Rol
                        </Badge>
                      </div>
                      <MultiRoleSelect
                        values={Array.isArray(ticketSetup?.support_roles) ? ticketSetup.support_roles : []}
                        onChange={(vals) => setConfigs({ ...configs, ticketSetup: { ...ticketSetup, support_roles: vals } })}
                        roles={roles}
                        placeholder="+ Destek Ekibi Rolü Ekle..."
                      />
                      <p className="text-[10px] text-muted-foreground">Bu rollere sahip yetkililer açılan biletleri görür, yanıtlar ve yönetebilir.</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Bilet Açılış Karşılama Mesajı</Label>
                    <Textarea
                      rows={3}
                      value={ticketSetup?.welcome_message || ""}
                      onChange={(e) => setConfigs({ ...configs, ticketSetup: { ...ticketSetup, welcome_message: e.target.value } })}
                      className="text-xs"
                      placeholder="Yetkili ekibimiz en kısa sürede sizinle ilgilenecektir."
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Live Discord Ticket Panel Preview */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-primary" />
                  Canlı Discord Bilet Paneli Önizlemesi
                </span>
                <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border border-primary/20">
                  Discord V2
                </Badge>
              </div>

              {/* Realistic Discord Channel Window */}
              <div className="bg-[#313338] rounded-2xl overflow-hidden border border-[#1F2023] shadow-2xl relative">
                {/* Discord Channel Header Bar */}
                <div className="bg-[#2B2D31] px-4 py-2.5 border-b border-[#1F2023] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-[#80848E]" />
                    <span className="font-bold text-white tracking-wide">
                      {textChannels.find(c => c.id === ticketSetup?.panel_channel_id)?.name || "destek-talebi"}
                    </span>
                    <div className="h-3.5 w-[1px] bg-[#3F4147] mx-1" />
                    <span className="text-[11px] text-[#949BA4] hidden sm:inline">
                      Özel Destek Talepleri
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[#B5BAC1]">
                    <Bell className="h-3.5 w-3.5 hover:text-white cursor-pointer" />
                    <Pin className="h-3.5 w-3.5 hover:text-white cursor-pointer" />
                  </div>
                </div>

                {/* Discord Message Content */}
                <div className="p-4 space-y-4 text-white font-sans text-xs">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-[#5865F2] flex items-center justify-center font-bold text-white text-xs shadow shrink-0">
                      {botInitials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm text-white hover:underline cursor-pointer">{botName}</span>
                        <span className="bg-[#5865F2] text-[10px] px-1 py-0.5 rounded font-bold uppercase text-white tracking-wider leading-none">
                          APP
                        </span>
                        <span className="text-[11px] text-[#949BA4]">Bugün 22:58</span>
                      </div>

                      {/* Discord Components V2 Container */}
                      <div className="mt-2 bg-[#2B2D31] border border-[#1E1F22] rounded-lg p-4 space-y-3 shadow-sm max-w-xl">
                        <div className="font-bold text-sm text-white flex items-center gap-2">
                          <Ticket className="h-4 w-4 text-[#5865F2]" />
                          <span>{ticketSetup?.panel_title || "Destek Bilet Sistemi"}</span>
                        </div>

                        <div className="text-[#DBDEE1] text-xs leading-relaxed space-y-1">
                          <p>{ticketSetup?.welcome_message || "Yetkili ekibimiz en kısa sürede sizinle ilgilenecektir."}</p>
                          <div className="h-[1px] bg-[#3F4147] my-2.5" />
                          <p className="text-[11px] text-[#949BA4]">• Aşağıdaki butona tıklayarak özel destek talebi başlatabilirsiniz.</p>
                          <p className="text-[11px] text-[#949BA4]">• Gereksiz talep açmak yetkililerin işini aksatır, lütfen sorununuzu net şekilde belirtin.</p>
                        </div>

                        {/* Discord Buttons ActionRow */}
                        <div className="pt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setTicketModalOpen(true)}
                            className="bg-[#5865F2] hover:bg-[#4752C4] active:bg-[#3C45A5] text-white text-xs font-semibold px-4 py-2 rounded-[4px] flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
                          >
                            <Ticket className="h-3.5 w-3.5" />
                            Talep Oluştur
                          </button>
                          <button
                            type="button"
                            className="bg-[#4E5058] hover:bg-[#6D6F78] active:bg-[#474950] text-white text-xs font-semibold px-4 py-2 rounded-[4px] flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Kurallar & SSS
                          </button>
                        </div>
                      </div>

                      {/* Simulated Ticket Created Feedback */}
                      {previewTicketOpened && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-3 p-3 bg-[#1E1F22] rounded-lg border border-emerald-500/40 text-[11px] text-emerald-400 flex items-center justify-between max-w-xl"
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                            <span>Örnek bilet oluşturuldu: <strong className="text-white">#ticket-{(user?.username || 'muhammedpyz').toLowerCase()}</strong></span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPreviewTicketOpened(false)}
                            className="text-zinc-400 hover:text-white text-xs px-2 py-0.5 rounded cursor-pointer"
                          >
                            Kapat
                          </button>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Interactive Discord Modal (Pixel Perfect Mockup) */}
                {ticketModalOpen && (
                  <div className="absolute inset-0 z-20 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in-50 duration-150">
                    <div className="bg-[#313338] border border-[#202225] rounded-lg w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-white">
                      {/* Modal Header */}
                      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                        <h4 className="font-bold text-base text-white">Destek Talebi Oluştur</h4>
                        <button
                          type="button"
                          onClick={() => setTicketModalOpen(false)}
                          className="text-[#949BA4] hover:text-white p-1 rounded transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Modal Body */}
                      <div className="p-4 space-y-4 text-xs">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-[#B5BAC1] uppercase tracking-wider block">
                            KONU <span className="text-[#F23F43]">*</span>
                          </label>
                          <input
                            type="text"
                            value={ticketSubjectInput}
                            onChange={(e) => setTicketSubjectInput(e.target.value)}
                            placeholder="Talebinizin konusunu kısaca özetleyin"
                            className="w-full bg-[#1E1F22] border border-[#1E1F22] focus:border-[#5865F2] text-white text-xs rounded-[4px] p-2.5 outline-none transition-colors"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-[#B5BAC1] uppercase tracking-wider block">
                            DETAYLI AÇIKLAMA
                          </label>
                          <textarea
                            rows={3}
                            value={ticketDescInput}
                            onChange={(e) => setTicketDescInput(e.target.value)}
                            placeholder="Ne kadar çok bilgi verirseniz o kadar hızlı çözülür..."
                            className="w-full bg-[#1E1F22] border border-[#1E1F22] focus:border-[#5865F2] text-white text-xs rounded-[4px] p-2.5 outline-none transition-colors resize-none"
                          />
                        </div>
                      </div>

                      {/* Modal Footer */}
                      <div className="bg-[#2B2D31] px-4 py-3 flex items-center justify-end gap-3 border-t border-[#1F2023]">
                        <button
                          type="button"
                          onClick={() => setTicketModalOpen(false)}
                          className="text-white text-xs hover:underline px-3 py-1.5 font-medium cursor-pointer"
                        >
                          İptal
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTicketModalOpen(false);
                            setPreviewTicketOpened(true);
                            setTicketSubjectInput("");
                            setTicketDescInput("");
                          }}
                          className="bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-semibold px-5 py-2 rounded-[4px] transition-colors cursor-pointer"
                        >
                          Gönder
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Kapatılan Biletler ve Transkript Arşivi */}
          {(ticketStatusFilter === "all" || ticketStatusFilter === "closed") && (
          <Card className="liquid-glass border-border/60 rounded-2xl overflow-hidden mt-6">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-display flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    <span>Kapatılan Biletler & Transkript Arşivi</span>
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Sonlandırılan tüm destek taleplerinin konuşma kayıtlarını web üzerinden Discord arayüzüyle inceleyin.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Bilet ID veya Kullanıcı Ara..."
                      value={transcriptSearch}
                      onChange={(e) => setTranscriptSearch(e.target.value)}
                      className="pl-8 h-8 text-xs bg-card/40 border-border/60 rounded-xl"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetchTranscripts()}
                    disabled={transcriptsLoading}
                    className="h-8 px-2.5 text-xs rounded-xl"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${transcriptsLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {transcriptsLoading ? (
                <div className="p-8 text-center text-xs text-muted-foreground">Transkriptler yükleniyor...</div>
              ) : transcripts.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">Henüz kapatılmış ve arşivlenmiş bir destek bileti bulunmuyor.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/50 bg-card/30 text-muted-foreground font-medium">
                        <th className="py-3 px-4">Bilet</th>
                        <th className="py-3 px-4">Açan Üye</th>
                        <th className="py-3 px-4">Kategori</th>
                        <th className="py-3 px-4">Kapatan Yetkili</th>
                        <th className="py-3 px-4">Mesajlar</th>
                        <th className="py-3 px-4">Kapanış Tarihi</th>
                        <th className="py-3 px-4 text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {transcripts
                        .filter(t => {
                          if (!transcriptSearch.trim()) return true;
                          const q = transcriptSearch.toLowerCase();
                          return (
                            String(t.id).includes(q) ||
                            (t.owner_tag && t.owner_tag.toLowerCase().includes(q)) ||
                            (t.owner_id && t.owner_id.includes(q)) ||
                            (t.category && t.category.toLowerCase().includes(q)) ||
                            (t.close_reason && t.close_reason.toLowerCase().includes(q))
                          );
                        })
                        .map((t) => (
                          <tr key={t.id} className="hover:bg-primary/5 transition-colors">
                            <td className="py-3 px-4 font-mono font-semibold text-white">
                              #{t.id}
                            </td>
                            <td className="py-3 px-4">
                              {(() => {
                                const ownerMember = members.find((m) => m.id === t.owner_id);
                                const defaultAvatar = `https://cdn.discordapp.com/embed/avatars/${(parseInt((t.owner_id || "0").slice(-2)) || 0) % 5}.png`;
                                const avatarUrl = ownerMember?.avatar || defaultAvatar;
                                const name = ownerMember ? (ownerMember.displayName || ownerMember.username) : (t.owner_tag || `Kullanıcı (${t.owner_id})`);

                                return (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (t.owner_id) {
                                        setActiveTab("sorgu");
                                        setSorguUserId(t.owner_id);
                                        handleFetchSorgu(t.owner_id);
                                      }
                                    }}
                                    className="flex items-center gap-2.5 text-left group cursor-pointer"
                                    title="Kullanıcı profili ve sicilini incele"
                                  >
                                    <img
                                      src={avatarUrl}
                                      alt={name}
                                      className="h-7 w-7 rounded-full object-cover shrink-0 ring-1 ring-border/80 group-hover:ring-primary transition-all"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).src = defaultAvatar;
                                      }}
                                    />
                                    <div className="min-w-0">
                                      <span className="font-semibold text-foreground text-xs block truncate group-hover:text-primary transition-colors">
                                        {name}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground font-mono">ID: {t.owner_id}</span>
                                    </div>
                                  </button>
                                );
                              })()}
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                                {t.category || "Destek"}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              {(() => {
                                const closerMember = members.find((m) => m.id === t.closed_by);
                                if (closerMember) {
                                  return (
                                    <div className="flex items-center gap-2">
                                      <img
                                        src={closerMember.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"}
                                        alt={closerMember.displayName}
                                        className="h-5 w-5 rounded-full object-cover shrink-0 ring-1 ring-border/50"
                                      />
                                      <div>
                                        <span className="text-foreground text-xs font-medium block">{closerMember.displayName || closerMember.username}</span>
                                        {t.close_reason && (
                                          <span className="text-[10px] text-muted-foreground block truncate max-w-[150px]">
                                            {t.close_reason}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                }
                                return (
                                  <div>
                                    <span className="text-foreground text-xs font-mono">{t.closed_by ? `<@${t.closed_by}>` : "Bilinmiyor"}</span>
                                    {t.close_reason && (
                                      <span className="text-[10px] text-muted-foreground block truncate max-w-[150px]">
                                        {t.close_reason}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="py-3 px-4 font-medium">
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <MessageSquare className="h-3 w-3 text-amber-400" />
                                {t.message_count}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-muted-foreground text-[11px]">
                              {t.closed_at ? new Date(t.closed_at).toLocaleString("tr-TR") : "-"}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 rounded-lg gap-1 cursor-pointer"
                              >
                                <a href={`/transcripts/${t.id}`} target="_blank" rel="noreferrer">
                                  <span>Transkript</span>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          )}
        </TabsContent>

        {/* 4.5. ÇEKİLİŞLER (GIVEAWAY) TAB */}
        <TabsContent value="giveaway" className="space-y-6">
          {/* Stats Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="liquid-glass border-border/60 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground font-medium block">Toplam Çekiliş</span>
                  <span className="text-2xl font-bold font-display text-white mt-1 block">{giveaways.length}</span>
                </div>
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 grid place-items-center text-primary">
                  <Gift className="h-5 w-5" />
                </div>
              </div>
            </Card>

            <Card className="liquid-glass border-border/60 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground font-medium block">Devam Eden Çekiliş</span>
                  <span className="text-2xl font-bold font-display text-emerald-400 mt-1 block">
                    {giveaways.filter((g: any) => g.status === "active").length}
                  </span>
                </div>
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 grid place-items-center text-emerald-400">
                  <Flame className="h-5 w-5" />
                </div>
              </div>
            </Card>

            <Card className="liquid-glass border-border/60 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground font-medium block">Sonlanan Çekilişler</span>
                  <span className="text-2xl font-bold font-display text-sky-400 mt-1 block">
                    {giveaways.filter((g: any) => g.status !== "active").length}
                  </span>
                </div>
                <div className="h-10 w-10 rounded-xl bg-sky-500/10 border border-sky-500/20 grid place-items-center text-sky-400">
                  <CheckCircle className="h-5 w-5" />
                </div>
              </div>
            </Card>
          </div>

          {/* Giveaways Table Card */}
          <Card className="liquid-glass border-border/60 rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-display flex items-center gap-2">
                    <Gift className="h-5 w-5 text-primary" />
                    <span>Sunucu Çekilişleri Listesi</span>
                    <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                      {giveaways.length} Kayıtlı
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Sunucunuzda başlatılan tüm çekilişlerin durumlarını, katılımcılarını ve kazananlarını görüntüleyin.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <code className="px-2.5 py-1 rounded-lg font-mono text-xs bg-primary/15 text-primary border border-primary/30">
                    /giveaway
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetchGuildData()}
                    disabled={loading}
                    className="h-8 px-2.5 text-xs rounded-xl cursor-pointer"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {giveaways.length === 0 ? (
                <div className="p-10 text-center text-xs text-muted-foreground space-y-1.5">
                  <p className="font-semibold text-foreground text-sm">Henüz bu sunucuda yapılmış bir çekiliş kaydı bulunmuyor.</p>
                  <p>Discord kanalında <code className="text-primary font-mono">/giveaway start</code> komutunu kullanarak hemen yeni bir çekiliş başlatabilirsiniz.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/50 bg-card/30 text-muted-foreground font-medium">
                        <th className="py-3 px-4">Ödül</th>
                        <th className="py-3 px-4">Açıklama</th>
                        <th className="py-3 px-4">Kazanan Sayısı</th>
                        <th className="py-3 px-4">Katılımcı</th>
                        <th className="py-3 px-4">Kazananlar</th>
                        <th className="py-3 px-4">Durum</th>
                        <th className="py-3 px-4 text-right">Oluşturulma</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {giveaways.map((g: any) => {
                        let participantsList: string[] = [];
                        try {
                          if (g.participants) {
                            participantsList = typeof g.participants === "string" ? JSON.parse(g.participants) : g.participants;
                          }
                        } catch(e) {}

                        let winnersList: string[] = [];
                        try {
                          if (g.winners) {
                            winnersList = typeof g.winners === "string" ? JSON.parse(g.winners) : g.winners;
                          }
                        } catch(e) {}

                        const isActive = g.status === "active";

                        return (
                          <tr key={g.id} className="hover:bg-primary/5 transition-colors">
                            <td className="py-3 px-4 font-semibold text-foreground flex items-center gap-2">
                              <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center text-primary shrink-0">
                                <Gift className="h-3.5 w-3.5" />
                              </div>
                              <span className="font-medium text-white">{g.prize}</span>
                            </td>
                            <td className="py-3 px-4 max-w-[180px]">
                              <span className="truncate block text-muted-foreground" title={g.description || "-"}>
                                {g.description || "-"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-muted-foreground font-medium">
                              {g.winner_count} Kişi
                            </td>
                            <td className="py-3 px-4 font-medium">
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <UserPlus className="h-3 w-3 text-primary" />
                                {participantsList.length} Katılımcı
                              </span>
                            </td>
                            <td className="py-3 px-4 min-w-[200px]">
                              {winnersList.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {winnersList.map((wId, wIdx) => {
                                    const mem = members.find((m) => m.id === wId);
                                    const defaultAvatar = `https://cdn.discordapp.com/embed/avatars/${(parseInt((wId || "0").slice(-2)) || 0) % 5}.png`;
                                    const avatarUrl = mem?.avatar || defaultAvatar;
                                    const name = mem ? (mem.displayName || mem.username) : `Kullanıcı (${wId})`;

                                    return (
                                      <button
                                        key={wIdx}
                                        type="button"
                                        onClick={() => {
                                          setActiveTab("sorgu");
                                          setSorguUserId(wId);
                                          handleFetchSorgu(wId);
                                        }}
                                        title={`Profili ve Sicili İncele: ${name}`}
                                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-medium transition-all group cursor-pointer"
                                      >
                                        <img
                                          src={avatarUrl}
                                          alt={name}
                                          className="h-4 w-4 rounded-full object-cover shrink-0 ring-1 ring-amber-500/40"
                                          onError={(e) => {
                                            (e.currentTarget as HTMLImageElement).src = defaultAvatar;
                                          }}
                                        />
                                        <span className="truncate max-w-[120px]">{name}</span>
                                        <ExternalLink className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100 shrink-0" />
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">
                                  {isActive ? "Belirleniyor..." : "Kazanan yok"}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {isActive ? (
                                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1">
                                  <Flame className="h-3 w-3" /> Devam Ediyor
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-muted/30 text-muted-foreground border-border/50 gap-1">
                                  <CheckCircle className="h-3 w-3" /> Sonlandı
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right text-muted-foreground text-[11px] whitespace-nowrap">
                              {g.created_at ? new Date(g.created_at).toLocaleDateString("tr-TR") : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. ÖNERİLER (SUGGESTION) TAB & CANLI ÖNİZLEME */}
        <TabsContent value="suggestion" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="liquid-glass border-border/60 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg font-display flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span>Öneri Sistemi Yapılandırması (`/oneri`)</span>
                      {suggestionSetup?.published_message_id && (
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                          Discord'da Canlı (ID: {suggestionSetup.published_message_id})
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        type="button"
                        onClick={handlePublishSuggestionPanel}
                        disabled={publishingPanel === "suggestion" || !suggestionSetup?.panel_channel_id}
                        className="h-8 text-xs bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 gap-1.5"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {publishingPanel === "suggestion" ? "Gönderiliyor..." : "Discord'a Paneli Gönder / Canlı Güncelle"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => saveConfigModule("suggestion", suggestionSetup)}
                        disabled={savingModule === "suggestion"}
                        className="h-8 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
                      >
                        <Save className="h-3.5 w-3.5 mr-1.5" />
                        {savingModule === "suggestion" ? "Kaydediliyor..." : "Kaydet"}
                      </Button>
                    </div>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Kullanıcıların sunucunuz için fikir ve öneri oylaması başlatmasını sağlar.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/40">
                      <Label className="text-xs font-semibold">Öneri Paneli Yayın Kanalı</Label>
                      <ChannelSelect
                        value={suggestionSetup?.panel_channel_id || ""}
                        onChange={(val) => setConfigs({ ...configs, suggestionSetup: { ...suggestionSetup, panel_channel_id: val || null } })}
                        channels={textChannels}
                        type="text"
                        placeholder="-- Metin Kanalı Seçiniz --"
                      />
                      <p className="text-[10px] text-muted-foreground">"Öneri Yap" butonunun paylaşılacağı kanal.</p>
                    </div>

                    <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/40">
                      <Label className="text-xs font-semibold">Önerilerin Paylaşılacağı Kanal</Label>
                      <ChannelSelect
                        value={suggestionSetup?.suggestion_channel_id || ""}
                        onChange={(val) => setConfigs({ ...configs, suggestionSetup: { ...suggestionSetup, suggestion_channel_id: val || null } })}
                        channels={textChannels}
                        type="text"
                        placeholder="-- Metin Kanalı Seçiniz --"
                      />
                      <p className="text-[10px] text-muted-foreground">Oylanacak öneri mesajlarının düştüğü kanal.</p>
                    </div>

                    <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/40">
                      <Label className="text-xs font-semibold">Öneri Log Kanalı</Label>
                      <ChannelSelect
                        value={suggestionSetup?.log_channel_id || ""}
                        onChange={(val) => setConfigs({ ...configs, suggestionSetup: { ...suggestionSetup, log_channel_id: val || null } })}
                        channels={textChannels}
                        type="text"
                        placeholder="-- Metin Kanalı Seçiniz --"
                      />
                      <p className="text-[10px] text-muted-foreground">Kabul/red işlemlerinin kaydedildiği kanal.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Panel Başlığı</Label>
                      <Input
                        value={suggestionSetup?.panel_title || "Öneri Paneli"}
                        onChange={(e) => setConfigs({ ...configs, suggestionSetup: { ...suggestionSetup, panel_title: e.target.value } })}
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Öneri Gönderme Bekleme Süresi (Saniye)</Label>
                      <Input
                        type="number"
                        min="5"
                        value={suggestionSetup?.cooldown_seconds || 30}
                        onChange={(e) => setConfigs({ ...configs, suggestionSetup: { ...suggestionSetup, cooldown_seconds: Number(e.target.value) } })}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Panel Açıklaması</Label>
                    <Textarea
                      rows={2}
                      value={suggestionSetup?.panel_description || ""}
                      onChange={(e) => setConfigs({ ...configs, suggestionSetup: { ...suggestionSetup, panel_description: e.target.value } })}
                      className="text-xs"
                      placeholder="Sunucumuz için bir önerin mi var? Aşağıdaki butona tıklayarak paylaşabilirsin."
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Live Discord Suggestion Preview with Mode Toggle */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-primary" />
                  Canlı Discord Öneri Önizlemesi
                </span>
                <div className="flex items-center gap-1 p-0.5 bg-card/60 rounded-lg border border-border/60">
                  <button
                    type="button"
                    onClick={() => setSuggestionPreviewMode("panel")}
                    className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      suggestionPreviewMode === "panel"
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Pano Önizlemesi
                  </button>
                  <button
                    type="button"
                    onClick={() => setSuggestionPreviewMode("card")}
                    className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      suggestionPreviewMode === "card"
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Oylama Kartı
                  </button>
                </div>
              </div>

              {/* Realistic Discord Channel Window */}
              <div className="bg-[#313338] rounded-2xl overflow-hidden border border-[#1F2023] shadow-2xl relative">
                {/* Discord Channel Header Bar */}
                <div className="bg-[#2B2D31] px-4 py-2.5 border-b border-[#1F2023] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-[#80848E]" />
                    <span className="font-bold text-white tracking-wide">
                      {suggestionPreviewMode === "panel"
                        ? (textChannels.find(c => c.id === suggestionSetup?.panel_channel_id)?.name || "oneri-paneli")
                        : (textChannels.find(c => c.id === suggestionSetup?.suggestion_channel_id)?.name || "oneriler")}
                    </span>
                    <div className="h-3.5 w-[1px] bg-[#3F4147] mx-1" />
                    <span className="text-[11px] text-[#949BA4] hidden sm:inline">
                      {suggestionPreviewMode === "panel" ? "Fikir ve Öneri Panosu" : "Topluluk Öneri Oylaması"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[#B5BAC1]">
                    <Bell className="h-3.5 w-3.5 hover:text-white cursor-pointer" />
                    <Pin className="h-3.5 w-3.5 hover:text-white cursor-pointer" />
                  </div>
                </div>

                {/* Discord Message Content */}
                <div className="p-4 space-y-4 text-white font-sans text-xs">
                  {suggestionPreviewMode === "panel" ? (
                    /* Pano Önizlemesi (Bot Prompt Message) */
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-[#5865F2] flex items-center justify-center font-bold text-white text-xs shadow shrink-0">
                        {botInitials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-sm text-white hover:underline cursor-pointer">{botName}</span>
                          <span className="bg-[#5865F2] text-[10px] px-1 py-0.5 rounded font-bold uppercase text-white tracking-wider leading-none">
                            APP
                          </span>
                          <span className="text-[11px] text-[#949BA4]">Bugün 22:58</span>
                        </div>

                        {/* Discord Components V2 Container */}
                        <div className="mt-2 bg-[#2B2D31] border border-[#1E1F22] rounded-lg p-4 space-y-3 shadow-sm max-w-xl">
                          <div className="font-bold text-sm text-white flex items-center gap-2">
                            <Ticket className="h-4 w-4 text-emerald-400" />
                            <span>{suggestionSetup?.panel_title || "Öneri Paneli"}</span>
                          </div>

                          <div className="text-[#DBDEE1] text-xs leading-relaxed space-y-1">
                            <p>
                              {suggestionSetup?.panel_description ||
                                "Topluluğumuzun gelişmesine katkıda bulunmak için fikirlerini paylaşabilirsin. İstersen adını gösterebilir veya anonim kalabilirsin!"}
                            </p>
                            <div className="h-[1px] bg-[#3F4147] my-2.5" />
                            <p className="text-[11px] text-[#949BA4]">
                              -# Aşağıdaki butona tıklayarak açılan form üzerinden önerinizi hemen iletebilirsiniz.
                            </p>
                          </div>

                          {/* ActionRow */}
                          <div className="pt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSuggestionModalOpen(true)}
                              className="bg-[#248046] hover:bg-[#1A6334] active:bg-[#15522A] text-white text-xs font-semibold px-4 py-2 rounded-[4px] flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
                            >
                              <Ticket className="h-3.5 w-3.5" />
                              Öneri Yap
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Öneri Oylama Kartı */
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-[#5865F2] flex items-center justify-center font-bold text-white text-xs shadow shrink-0">
                        {botInitials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-sm text-white hover:underline cursor-pointer">{botName}</span>
                          <span className="bg-[#5865F2] text-[10px] px-1 py-0.5 rounded font-bold uppercase text-white tracking-wider leading-none">
                            APP
                          </span>
                          <span className="text-[11px] text-[#949BA4]">Bugün 23:00</span>
                        </div>

                        {/* Discord Components V2 Container */}
                        <div className="mt-2 bg-[#2B2D31] border border-[#1E1F22] rounded-lg p-4 space-y-3 shadow-sm max-w-xl">
                          <div className="font-bold text-sm text-white flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-[#5865F2]" />
                            <span>Öneri</span>
                          </div>

                          <div className="bg-[#1E1F22]/80 border-l-4 border-emerald-500 rounded p-3 text-xs text-white leading-relaxed font-medium">
                            {activeSuggestionText}
                          </div>

                          <div className="h-[1px] bg-[#3F4147] my-2" />

                          <div className="text-[11px] text-[#949BA4] space-y-1">
                            <div><strong>Öneri No:</strong> #0042</div>
                            <div><strong>Gönderen:</strong> @{activeSuggestionAuthor}</div>
                            <div><strong>Gönderildi:</strong> 10 dakika önce</div>
                          </div>

                          {/* Voting ActionRow with Discord Buttons */}
                          <div className="pt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (previewUserVote === "up") {
                                  setPreviewUpvotes(previewUpvotes - 1);
                                  setPreviewUserVote(null);
                                } else {
                                  setPreviewUpvotes(previewUpvotes + 1);
                                  if (previewUserVote === "down") setPreviewDownvotes(previewDownvotes - 1);
                                  setPreviewUserVote("up");
                                }
                              }}
                              className={`text-xs font-semibold px-4 py-2 rounded-[4px] flex items-center gap-2 transition-colors cursor-pointer shadow-sm ${
                                previewUserVote === "up"
                                  ? "bg-[#248046] ring-2 ring-emerald-400 text-white"
                                  : "bg-[#248046] hover:bg-[#1A6334] text-white"
                              }`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>{previewUpvotes}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (previewUserVote === "down") {
                                  setPreviewDownvotes(previewDownvotes - 1);
                                  setPreviewUserVote(null);
                                } else {
                                  setPreviewDownvotes(previewDownvotes + 1);
                                  if (previewUserVote === "up") setPreviewUpvotes(previewUpvotes - 1);
                                  setPreviewUserVote("down");
                                }
                              }}
                              className={`text-xs font-semibold px-4 py-2 rounded-[4px] flex items-center gap-2 transition-colors cursor-pointer shadow-sm ${
                                previewUserVote === "down"
                                  ? "bg-[#DA373C] ring-2 ring-red-400 text-white"
                                  : "bg-[#DA373C] hover:bg-[#A12828] text-white"
                              }`}
                            >
                              <Minus className="h-3.5 w-3.5" />
                              <span>{previewDownvotes}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Interactive Discord Modal (Pixel Perfect Mockup) */}
                {suggestionModalOpen && (
                  <div className="absolute inset-0 z-20 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in-50 duration-150">
                    <div className="bg-[#313338] border border-[#202225] rounded-lg w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-white">
                      {/* Modal Header */}
                      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                        <h4 className="font-bold text-base text-white">Önerini Paylaş</h4>
                        <button
                          type="button"
                          onClick={() => setSuggestionModalOpen(false)}
                          className="text-[#949BA4] hover:text-white p-1 rounded transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Modal Body */}
                      <div className="p-4 space-y-4 text-xs">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-[#B5BAC1] uppercase tracking-wider block">
                            ÖNERİNİZ <span className="text-[#F23F43]">*</span>
                          </label>
                          <textarea
                            rows={3}
                            value={suggestionTextInput}
                            onChange={(e) => setSuggestionTextInput(e.target.value)}
                            placeholder="Neyi, neden ve nasıl değiştirmek istediğinizi anlatın..."
                            className="w-full bg-[#1E1F22] border border-[#1E1F22] focus:border-[#5865F2] text-white text-xs rounded-[4px] p-2.5 outline-none transition-colors resize-none"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-[#B5BAC1] uppercase tracking-wider block">
                            ANONİM GÖNDERİLSİN Mİ? (EVET / HAYIR)
                          </label>
                          <input
                            type="text"
                            value={suggestionAnonInput}
                            onChange={(e) => setSuggestionAnonInput(e.target.value)}
                            placeholder="Anonim olması için Evet yazın (varsayılan: Hayır)"
                            className="w-full bg-[#1E1F22] border border-[#1E1F22] focus:border-[#5865F2] text-white text-xs rounded-[4px] p-2.5 outline-none transition-colors"
                          />
                        </div>
                      </div>

                      {/* Modal Footer */}
                      <div className="bg-[#2B2D31] px-4 py-3 flex items-center justify-end gap-3 border-t border-[#1F2023]">
                        <button
                          type="button"
                          onClick={() => setSuggestionModalOpen(false)}
                          className="text-white text-xs hover:underline px-3 py-1.5 font-medium cursor-pointer"
                        >
                          İptal
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (suggestionTextInput.trim()) {
                              setActiveSuggestionText(suggestionTextInput.trim());
                              const isAnon = suggestionAnonInput.trim().toLowerCase() === "evet";
                              setActiveSuggestionAuthor(isAnon ? "Anonim" : (user?.username || "Muhammedpyz"));
                              setPreviewUpvotes(1);
                              setPreviewDownvotes(0);
                              setPreviewUserVote("up");
                            }
                            setSuggestionModalOpen(false);
                            setSuggestionPreviewMode("card");
                            setSuggestionTextInput("");
                          }}
                          className="bg-[#248046] hover:bg-[#1A6334] text-white text-xs font-semibold px-5 py-2 rounded-[4px] transition-colors cursor-pointer"
                        >
                          Gönder
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 6. KARŞILAMA & OTOROL TAB & CANLI ÖNİZLEME */}
        <TabsContent value="welcome" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Welcome Config Card */}
              <Card className="liquid-glass border-border/60 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg font-display flex items-center justify-between">
                    <span>Hoş Geldin & Uğurlama (`/hosgeldin`)</span>
                    <Button
                      size="sm"
                      onClick={() => saveConfigModule("welcome", welcome)}
                      disabled={savingModule === "welcome"}
                      className="h-8 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
                    >
                      <Save className="h-3.5 w-3.5 mr-1.5" />
                      {savingModule === "welcome" ? "Kaydediliyor..." : "Kaydet"}
                    </Button>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Gelen ve ayrılan üyeler için mesaj kanallarını ve özel metinleri ayarlayın.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Karşılama Kanalı</Label>
                      <ChannelSelect
                        value={welcome.welcome_channel_id || ""}
                        onChange={(val) => setConfigs({ ...configs, welcome: { ...welcome, welcome_channel_id: val || null } })}
                        channels={textChannels}
                        type="text"
                        placeholder="-- Kanal Seçiniz --"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Uğurlama (Ayrılma) Kanalı</Label>
                      <ChannelSelect
                        value={welcome.goodbye_channel_id || ""}
                        onChange={(val) => setConfigs({ ...configs, welcome: { ...welcome, goodbye_channel_id: val || null } })}
                        channels={textChannels}
                        type="text"
                        placeholder="-- Kanal Seçiniz --"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Hoş Geldin Mesaj Şablonu</Label>
                    <Textarea
                      rows={2}
                      value={welcome.welcome_message || ""}
                      onChange={(e) => setConfigs({ ...configs, welcome: { ...welcome, welcome_message: e.target.value } })}
                      className="text-xs"
                      placeholder="Sunucumuza hoş geldin {user}!"
                    />
                    <p className="text-[10px] text-muted-foreground">{`{user}`} değişkeni üyenin etiketini ekler.</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Uğurlama Mesaj Şablonu</Label>
                    <Textarea
                      rows={2}
                      value={welcome.goodbye_message || ""}
                      onChange={(e) => setConfigs({ ...configs, welcome: { ...welcome, goodbye_message: e.target.value } })}
                      className="text-xs"
                      placeholder="{user} aramızdan ayrıldı."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Özel DM Hoş Geldin Mesajı (Opsiyonel)</Label>
                    <Textarea
                      rows={2}
                      value={welcome.welcome_dm_message || ""}
                      onChange={(e) => setConfigs({ ...configs, welcome: { ...welcome, welcome_dm_message: e.target.value } })}
                      className="text-xs"
                      placeholder="Yeni üyeye DM ile iletilecek özel mesaj..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card/40">
                      <Label className="text-xs font-medium">Resimli Karşılama Kartı</Label>
                      <Switch
                        checked={!!welcome.welcome_gen_image}
                        onCheckedChange={(val) => setConfigs({ ...configs, welcome: { ...welcome, welcome_gen_image: val ? 1 : 0 } })}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card/40">
                      <Label className="text-xs font-medium">Resimli Uğurlama Kartı</Label>
                      <Switch
                        checked={!!welcome.goodbye_gen_image}
                        onCheckedChange={(val) => setConfigs({ ...configs, welcome: { ...welcome, goodbye_gen_image: val ? 1 : 0 } })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* AutoRole Config Card */}
              <Card className="liquid-glass border-border/60 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg font-display flex items-center justify-between">
                    <span>Otorol Sistemi (`/otorol`)</span>
                    <Button
                      size="sm"
                      onClick={() => saveConfigModule("autorole", autorole)}
                      disabled={savingModule === "autorole"}
                      className="h-8 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
                    >
                      <Save className="h-3.5 w-3.5 mr-1.5" />
                      {savingModule === "autorole" ? "Kaydediliyor..." : "Kaydet"}
                    </Button>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Sunucuya yeni katılan kullanıcılara ve botlara otomatik verilecek roller.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card/40">
                    <Label className="text-xs font-medium">Otorol Sistemi Aktif</Label>
                    <Switch
                      checked={!!autorole.is_enabled}
                      onCheckedChange={(val) => setConfigs({ ...configs, autorole: { ...autorole, is_enabled: val ? 1 : 0 } })}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Yeni Kullanıcı Rolü</Label>
                      <RoleSelect
                        value={autorole.user_role_id || ""}
                        onChange={(val) => setConfigs({ ...configs, autorole: { ...autorole, user_role_id: val || null } })}
                        roles={roles}
                        placeholder="-- Rol Seçiniz --"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Yeni Bot Rolü</Label>
                      <RoleSelect
                        value={autorole.bot_role_id || ""}
                        onChange={(val) => setConfigs({ ...configs, autorole: { ...autorole, bot_role_id: val || null } })}
                        roles={roles}
                        placeholder="-- Rol Seçiniz --"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Live Discord Welcome Card Preview */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-primary" />
                  Canlı Discord Karşılama Önizlemesi
                </span>
                <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border border-primary/20">
                  Discord Görünümü
                </Badge>
              </div>

              {/* Realistic Discord Channel Window */}
              <div className="bg-[#313338] rounded-2xl overflow-hidden border border-[#1F2023] shadow-2xl">
                {/* Discord Channel Header Bar */}
                <div className="bg-[#2B2D31] px-4 py-2.5 border-b border-[#1F2023] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-[#80848E]" />
                    <span className="font-bold text-white tracking-wide">
                      {textChannels.find(c => c.id === welcome.welcome_channel_id)?.name || "hos-geldin"}
                    </span>
                    <div className="h-3.5 w-[1px] bg-[#3F4147] mx-1" />
                    <span className="text-[11px] text-[#949BA4] hidden sm:inline">
                      Yeni Katılan Üyeler
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[#B5BAC1]">
                    <Bell className="h-3.5 w-3.5 hover:text-white cursor-pointer" />
                    <Pin className="h-3.5 w-3.5 hover:text-white cursor-pointer" />
                  </div>
                </div>

                {/* Discord Message */}
                <div className="p-4 space-y-3 text-white font-sans text-xs">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-[#5865F2] flex items-center justify-center font-bold text-white text-xs shadow shrink-0">
                      {botInitials}
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm text-white hover:underline cursor-pointer">{botName}</span>
                        <span className="bg-[#5865F2] text-[10px] px-1 py-0.5 rounded font-bold uppercase text-white tracking-wider leading-none">
                          APP
                        </span>
                        <span className="text-[11px] text-[#949BA4]">Bugün 23:05</span>
                      </div>

                      <p className="text-zinc-200 text-xs leading-relaxed">
                        {(welcome.welcome_message || "{user} sunucumuza hoş geldin! Seni aramızda görmekten mutluluk duyuyoruz.")
                          .replace("{user}", `@${user?.username || "Muhammedpyz"}`)
                          .replace("{guild}", guildDetails.name)
                          .replace("{count}", String(guildDetails.memberCount))}
                      </p>

                      {/* Welcome Card Image Attachment */}
                      {welcome.welcome_gen_image ? (
                        <div className="mt-2 rounded-xl overflow-hidden border border-[#3f4147] bg-gradient-to-r from-indigo-950 via-purple-950 to-zinc-900 p-5 text-center shadow-lg relative max-w-md">
                          <div className="h-14 w-14 rounded-full border-2 border-indigo-400 mx-auto bg-indigo-600 flex items-center justify-center text-base font-bold shadow-xl">
                            {user?.username?.slice(0, 2).toUpperCase() || "MP"}
                          </div>
                          <div className="mt-3 space-y-1">
                            <div className="text-sm font-black text-white tracking-wider">HOŞ GELDİN</div>
                            <div className="text-xs text-indigo-300 font-mono">@{user?.username || "Muhammedpyz"}</div>
                            <div className="text-[10px] text-zinc-400 mt-1 inline-block bg-black/40 px-2.5 py-0.5 rounded-full border border-white/10">
                              Sunucunun #{guildDetails.memberCount}. üyesi!
                            </div>
                          </div>
                          <div className="mt-3 pt-2 border-t border-white/10 text-[9px] text-zinc-500 font-mono">
                            attachment://welcome.png
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 7. ÖZEL ODALAR TAB */}
        <TabsContent value="rooms" className="space-y-6">
          {/* Setup Configuration Card */}
          <Card className="liquid-glass border-border/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center justify-between">
                <span>Özel Oda Şablon & Kanal Ayarları</span>
                <Button
                  size="sm"
                  onClick={() => saveConfigModule("special_rooms", specialRoomsSetup)}
                  disabled={savingModule === "special_rooms"}
                  className="h-8 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {savingModule === "special_rooms" ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </CardTitle>
              <CardDescription className="text-xs">
                Kullanıcıların kendi geçici ses odalarını açacağı şablon kanalları (`/ozel-oda`).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/40">
                  <Label className="text-xs font-semibold">"Oda Oluştur" Ses Kanalı</Label>
                  <ChannelSelect
                    value={specialRoomsSetup?.setup_voice_channel_id || ""}
                    onChange={(val) =>
                      setConfigs({
                        ...configs,
                        specialRoomsSetup: { ...specialRoomsSetup, setup_voice_channel_id: val || null }
                      })
                    }
                    channels={voiceChannels}
                    type="voice"
                    placeholder="-- Ses Kanalı Seçiniz --"
                  />
                </div>

                <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/40">
                  <Label className="text-xs font-semibold">Kontrol Paneli Metin Kanalı</Label>
                  <ChannelSelect
                    value={specialRoomsSetup?.setup_channel_id || ""}
                    onChange={(val) =>
                      setConfigs({
                        ...configs,
                        specialRoomsSetup: { ...specialRoomsSetup, setup_channel_id: val || null }
                      })
                    }
                    channels={textChannels}
                    type="text"
                    placeholder="-- Metin Kanalı Seçiniz --"
                  />
                </div>

                <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/40">
                  <Label className="text-xs font-semibold">Özel Oda Log Kanalı</Label>
                  <ChannelSelect
                    value={specialRoomsSetup?.log_channel_id || ""}
                    onChange={(val) =>
                      setConfigs({
                        ...configs,
                        specialRoomsSetup: { ...specialRoomsSetup, log_channel_id: val || null }
                      })
                    }
                    channels={textChannels}
                    type="text"
                    placeholder="-- Metin Kanalı Seçiniz --"
                  />
                </div>

                <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/40">
                  <Label className="text-xs font-semibold">Şablon Kategorisi</Label>
                  <ChannelSelect
                    value={specialRoomsSetup?.setup_category_id || ""}
                    onChange={(val) =>
                      setConfigs({
                        ...configs,
                        specialRoomsSetup: { ...specialRoomsSetup, setup_category_id: val || null }
                      })
                    }
                    channels={categoryChannels}
                    type="category"
                    placeholder="-- Kategori Seçiniz --"
                  />
                </div>

                <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/40">
                  <Label className="text-xs font-semibold">Aktif Odalar Kategorisi</Label>
                  <ChannelSelect
                    value={specialRoomsSetup?.active_rooms_category_id || ""}
                    onChange={(val) =>
                      setConfigs({
                        ...configs,
                        specialRoomsSetup: { ...specialRoomsSetup, active_rooms_category_id: val || null }
                      })
                    }
                    channels={categoryChannels}
                    type="category"
                    placeholder="-- Kategori Seçiniz --"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Rooms Table Card */}
          <Card className="liquid-glass border-border/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center justify-between">
                <span>Anlık Aktif Özel Odalar</span>
                <Badge variant="outline" className="border-primary/40 text-primary">
                  {activeRooms.length} Aktif Oda
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeRooms.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-border/80 rounded-xl">
                  <Radio className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">Şu an aktif özel oda bulunmuyor.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Üyeler "Oda Oluştur" kanalına katıldığında geçici odaları anında burada listelenir.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-muted-foreground border-b border-border/60">
                      <tr>
                        <th className="py-2.5 px-3">Oda Adı</th>
                        <th className="py-2.5 px-3">Kanal ID</th>
                        <th className="py-2.5 px-3">Oda Sahibi ID</th>
                        <th className="py-2.5 px-3">Oluşturulma</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {activeRooms.map((room: any) => (
                        <tr key={room.channel_id} className="hover:bg-card/50">
                          <td className="py-3 px-3 font-semibold text-foreground">{room.room_name || "Özel Oda"}</td>
                          <td className="py-3 px-3 font-mono text-muted-foreground">{room.channel_id}</td>
                          <td className="py-3 px-3 font-mono text-muted-foreground">{room.owner_id}</td>
                          <td className="py-3 px-3 text-muted-foreground">{new Date(room.created_at).toLocaleString("tr-TR")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 8. ÖZEL DURUM & TAG ROL TAB */}
        <TabsContent value="vanity_tag" className="space-y-6">
          {/* Vanity Config Card */}
          <Card className="liquid-glass border-border/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center justify-between">
                <span>Özel Durum (Vanity Role) Sistemi</span>
                <Button
                  size="sm"
                  onClick={() => saveConfigModule("vanity", vanity)}
                  disabled={savingModule === "vanity"}
                  className="h-8 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {savingModule === "vanity" ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </CardTitle>
              <CardDescription className="text-xs">
                Discord durumunda sunucunuzun davet linkini taşıyan üyelere otomatik özel rol verir.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card/40">
                <Label className="text-xs font-medium">Vanity Rol Sistemi Aktif</Label>
                <Switch
                  checked={!!vanity.is_enabled}
                  onCheckedChange={(val) => setConfigs({ ...configs, vanity: { ...vanity, is_enabled: val ? 1 : 0 } })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Aranacak Durum Metni / Linki</Label>
                  <Input
                    value={vanity.vanity_string || ""}
                    onChange={(e) => setConfigs({ ...configs, vanity: { ...vanity, vanity_string: e.target.value } })}
                    placeholder=".gg/sunucunuz veya botadi"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Verilecek Özel Rol</Label>
                  <RoleSelect
                    value={vanity.role_id || ""}
                    onChange={(val) => setConfigs({ ...configs, vanity: { ...vanity, role_id: val || null } })}
                    roles={roles}
                    placeholder="-- Rol Seçiniz --"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Tebrik / Bildirim Kanalı</Label>
                <ChannelSelect
                  value={vanity.channel_id || ""}
                  onChange={(val) => setConfigs({ ...configs, vanity: { ...vanity, channel_id: val || null } })}
                  channels={textChannels}
                  type="text"
                  placeholder="-- Kanal Seçiniz --"
                />
              </div>
            </CardContent>
          </Card>

          {/* Tag Role Card */}
          <Card className="liquid-glass border-border/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center justify-between">
                <span>Tag Rol Sistemi (`/tag-rol`)</span>
                <Button
                  size="sm"
                  onClick={() => saveConfigModule("tag_role", tagRole)}
                  disabled={savingModule === "tag_role"}
                  className="h-8 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {savingModule === "tag_role" ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Sunucu Tagı / Sembolü</Label>
                  <Input
                    value={tagRole.tag_text || ""}
                    onChange={(e) => setConfigs({ ...configs, tagRole: { ...tagRole, tag_text: e.target.value } })}
                    placeholder="Örn: TL | veya [TL]"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Tag Rolü</Label>
                  <RoleSelect
                    value={tagRole.role_id || ""}
                    onChange={(val) => setConfigs({ ...configs, tagRole: { ...tagRole, role_id: val || null } })}
                    roles={roles}
                    placeholder="-- Rol Seçiniz --"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 9. 14 KATEGORİLİ LOG KANALLARI TAB */}
        <TabsContent value="logs">
          <Card className="liquid-glass border-border/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center justify-between">
                <span>14 Kategorili Gelişmiş Log Kanalları</span>
                <Button
                  size="sm"
                  onClick={() => saveConfigModule("logs", { channels: logs })}
                  disabled={savingModule === "logs"}
                  className="h-8 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {savingModule === "logs" ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </CardTitle>
              <CardDescription className="text-xs">
                Sunucunuzdaki olayları türüne göre farklı Discord metin kanallarıyla eşleştirin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: "message", label: "Mesaj Logları (Silme, Düzenleme, Sabitleme)" },
                  { key: "member", label: "Üye Logları (Rol Değişimi, Takma Ad, Giriş/Çıkış)" },
                  { key: "ban", label: "Yasaklama Logları (Ban & Unban)" },
                  { key: "kick", label: "Atma Logları (Kick)" },
                  { key: "mute", label: "Susturma Logları (Metin & Ses Timeout)" },
                  { key: "warn", label: "Uyarı Logları (Warn Verme & Sıfırlama)" },
                  { key: "channel_ops", label: "Kanal İşlemleri (Oluşturma, Silme, Güncelleme)" },
                  { key: "automod", label: "AutoMod Logları (Küfür, Reklam, Spam, Caps)" },
                  { key: "channel", label: "Kanal İzinleri (İzinler, Konu, NSFW, Bitrate)" },
                  { key: "role", label: "Rol Logları (Oluşturma, Silme, Renk, Yetki)" },
                  { key: "voice", label: "Ses Logları (Giriş, Çıkış, Taşıma, Sağırlaştırma)" },
                  { key: "guild", label: "Sunucu Logları (İsim, İkon, Webhook, Emoji)" },
                  { key: "thread", label: "Konu / Thread Logları" },
                  { key: "invite", label: "Davet Logları (Üretilen ve Silinen Davetler)" },
                ].map((item) => (
                  <div key={item.key} className="p-3.5 rounded-xl border border-border/60 bg-card/40 space-y-1.5">
                    <Label className="text-xs font-semibold">{item.label}</Label>
                    <ChannelSelect
                      value={logs[item.key] || ""}
                      onChange={(val) =>
                        setConfigs({
                          ...configs,
                          logs: { ...logs, [item.key]: val || null }
                        })
                      }
                      channels={textChannels}
                      type="text"
                      placeholder="-- Kanal Seçiniz (Kapalı) --"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 10. MÜZİK, SEVİYE & ÇEKİLİŞLER TAB */}
        <TabsContent value="music_levels" className="space-y-6">
          {/* Music Card */}
          <Card className="liquid-glass border-border/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span>Müzik & Ses Ayarları</span>
                  <code className="px-2 py-0.5 rounded font-mono text-[11px] bg-primary/15 text-primary border border-primary/30">/247</code>
                  <code className="px-2 py-0.5 rounded font-mono text-[11px] bg-primary/15 text-primary border border-primary/30">/volume</code>
                </span>
                <Button
                  size="sm"
                  onClick={() => saveConfigModule("music", music)}
                  disabled={savingModule === "music"}
                  className="h-8 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {savingModule === "music" ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </CardTitle>
              <CardDescription className="text-xs">
                Botun müzik kalitesi ve 7/24 ses odasında kalma yapılandırması.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card/40">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold">7/24 Kesintisiz Ses Odasında Kalma</Label>
                    <p className="text-[10px] text-muted-foreground">Oda boşalsa bile bot ses kanalından çıkmaz.</p>
                  </div>
                  <Switch
                    checked={!!music.stay_247}
                    onCheckedChange={(val) => setConfigs({ ...configs, music: { ...music, stay_247: val ? 1 : 0 } })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card/40">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold">Otomatik Şarkı Çalma (Autoplay)</Label>
                    <p className="text-[10px] text-muted-foreground">Sıra bitince benzer şarkılar çalar.</p>
                  </div>
                  <Switch
                    checked={!!music.autoplay}
                    onCheckedChange={(val) => setConfigs({ ...configs, music: { ...music, autoplay: val ? 1 : 0 } })}
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl border border-border/60 bg-card/40 space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span>Varsayılan Ses Seviyesi: %{music.default_volume || 100}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="150"
                  value={music.default_volume || 100}
                  onChange={(e) => setConfigs({ ...configs, music: { ...music, default_volume: Number(e.target.value) } })}
                  className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Sabit Ses Kanalı (7/24 İçin)</Label>
                  <ChannelSelect
                    value={music.voice_channel_id || ""}
                    onChange={(val) => setConfigs({ ...configs, music: { ...music, voice_channel_id: val || null } })}
                    channels={voiceChannels}
                    type="voice"
                    placeholder="-- Ses Kanalı Seçiniz --"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Müzik Komut / Bildirim Kanalı</Label>
                  <ChannelSelect
                    value={music.text_channel_id || ""}
                    onChange={(val) => setConfigs({ ...configs, music: { ...music, text_channel_id: val || null } })}
                    channels={textChannels}
                    type="text"
                    placeholder="-- Metin Kanalı Seçiniz --"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Level Card */}
          <Card className="liquid-glass border-border/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary" />
                  <span>Seviye & XP Sistemi</span>
                  <code className="px-2 py-0.5 rounded font-mono text-[11px] bg-primary/15 text-primary border border-primary/30">/level</code>
                </span>
                <Button
                  size="sm"
                  onClick={() => saveConfigModule("level", level)}
                  disabled={savingModule === "level"}
                  className="h-8 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {savingModule === "level" ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card/40">
                <Label className="text-xs font-semibold">Seviye Sistemi Aktif</Label>
                <Switch
                  checked={!!level.enabled}
                  onCheckedChange={(val) => setConfigs({ ...configs, level: { ...level, enabled: val ? 1 : 0 } })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/40">
                  <Label className="text-xs font-semibold">Mesaj Başı XP</Label>
                  <Input
                    type="number"
                    min="1"
                    value={level.message_xp || 15}
                    onChange={(e) => setConfigs({ ...configs, level: { ...level, message_xp: Number(e.target.value) } })}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/40">
                  <Label className="text-xs font-semibold">Ses Başı XP (dk)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={level.voice_xp || 25}
                    onChange={(e) => setConfigs({ ...configs, level: { ...level, voice_xp: Number(e.target.value) } })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/40">
                <Label className="text-xs font-semibold">Seviye Atlama Bildirim Kanalı</Label>
                <ChannelSelect
                  value={level.announcement_channel_id || level.channel_id || ""}
                  onChange={(val) => setConfigs({ ...configs, level: { ...level, announcement_channel_id: val || null, channel_id: val || null } })}
                  channels={textChannels}
                  type="text"
                  placeholder="-- Kanal Seçiniz (Boş = Mesajın Yazıldığı Kanal) --"
                />
              </div>

              {/* XP Whitelist & Exemptions */}
              <div className="pt-3 border-t border-border/60 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-2 text-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span>XP Muafiyetleri & Güvenli Liste (Whitelist)</span>
                  </Label>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Badge variant="outline" className="border-primary/30 text-primary">
                      {Array.isArray(level.exempt_channels) ? level.exempt_channels.length : 0} Kanal Muaf
                    </Badge>
                    <Badge variant="outline" className="border-primary/30 text-primary">
                      {Array.isArray(level.exempt_roles) ? level.exempt_roles.length : 0} Rol Muaf
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/40">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5 text-primary" />
                      XP Kazanımından Muaf Kanallar
                    </Label>
                    <MultiChannelSelect
                      values={Array.isArray(level.exempt_channels) ? level.exempt_channels : []}
                      onChange={(vals) => setConfigs({ ...configs, level: { ...level, exempt_channels: vals } })}
                      channels={textChannels}
                      placeholder="+ Muaf Kanal Ekle..."
                    />
                    <p className="text-[10px] text-muted-foreground">Bu kanallarda kullanıcıların yazdığı mesajlar veya ses odaları XP kazandırmaz.</p>
                  </div>

                  <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-card/40">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-primary" />
                      XP Kazanımından Muaf Roller
                    </Label>
                    <MultiRoleSelect
                      values={Array.isArray(level.exempt_roles) ? level.exempt_roles : []}
                      onChange={(vals) => setConfigs({ ...configs, level: { ...level, exempt_roles: vals } })}
                      roles={roles}
                      placeholder="+ Muaf Rol Ekle..."
                    />
                    <p className="text-[10px] text-muted-foreground">Bu rollere sahip kullanıcılara (botlar, cezalılar vb.) seviye XP'si verilmez.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
