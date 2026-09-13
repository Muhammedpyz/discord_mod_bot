import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Edit2, Check, X, Sparkles, Eye, MessageSquare } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

export function CustomCommandsPanel({ guildId, guildDetails }: { guildId: string, guildDetails: any }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [commands, setCommands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [trigger, setTrigger] = useState("");
  const [response, setResponse] = useState("");
  const [type, setType] = useState("embed");

  const AVAILABLE_VARIABLES = [
    { key: "{user}", desc: "Kullanıcıyı etiketler" },
    { key: "{username}", desc: "Kullanıcı adı" },
    { key: "{server}", desc: "Sunucu adı" },
    { key: "{channel}", desc: "Kanalı etiketler" },
    { key: "{membercount}", desc: "Üye sayısı" },
    { key: "{roles}", desc: "Kullanıcı rolleri" },
    { key: "{date}", desc: "Günün tarihi" },
    { key: "{time}", desc: "Şu anki saat" }
  ];

  const insertVariable = (variable: string) => {
    setResponse(prev => prev + variable);
  };

  // Preview renderer function
  const renderPreview = (text: string) => {
    if (!text || text.trim() === '') return <span className="opacity-50 italic">Önizleme burada görünecek...</span>;
    
    // HTML Escape (Kullanıcının girdiği < ve > işaretleri sayfayı bozmasın)
    let preview = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    // Gerçek kullanıcı ve sunucu verilerini kullan
    const myName = user?.globalName || user?.username || "Sen";
    const serverName = guildDetails?.name || "Sunucu";
    const memberCount = guildDetails?.memberCount?.toLocaleString('tr-TR') || "1,234";
    const randomChannel = guildDetails?.channels?.text?.[0]?.name || "genel-sohbet";
    const userRole = guildDetails?.roles?.find((r:any) => r.name !== '@everyone')?.name || "Aktif Üye";
    const roleColor = guildDetails?.roles?.find((r:any) => r.name !== '@everyone')?.color 
      ? `#${guildDetails.roles.find((r:any) => r.name !== '@everyone').color.toString(16).padStart(6, '0')}`
      : "slate-300";

    // Değişkenleri vurgulu renklere çevir
    preview = preview.replace(/\{user\}/g, `<span class="bg-[#5865F2]/20 text-[#c9cdfb] px-1 rounded cursor-pointer font-medium hover:bg-[#5865F2]/40">@${myName}</span>`);
    preview = preview.replace(/\{username\}/g, myName);
    preview = preview.replace(/\{server\}/g, serverName);
    preview = preview.replace(/\{channel\}/g, `<span class="bg-[#5865F2]/20 text-[#c9cdfb] px-1 rounded cursor-pointer font-medium hover:bg-[#5865F2]/40">#${randomChannel}</span>`);
    preview = preview.replace(/\{membercount\}/g, memberCount);
    preview = preview.replace(/\{roles\}/g, `<span class="bg-[#3b3d42] text-[${roleColor === 'slate-300' ? '#94a3b8' : roleColor}] px-1 rounded" style="color: ${roleColor === 'slate-300' ? '#94a3b8' : roleColor}">@${userRole}</span>`);
    preview = preview.replace(/\{date\}/g, new Date().toLocaleDateString('tr-TR'));
    preview = preview.replace(/\{time\}/g, new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
    
    return <div className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: preview }} />;
  };

  const fetchCommands = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/guilds/${guildId}/custom-commands`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setCommands(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCommands();
  }, [guildId]);

  const handleAdd = async () => {
    if (!trigger || !response) {
      return toast({
        title: "Eksik Bilgi",
        description: "Lütfen tetikleyici kelimeyi ve yanıtı boş bırakmayın.",
        variant: "destructive"
      });
    }
    
    try {
      const res = await fetch(`${API_BASE_URL}/guilds/${guildId}/custom-commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ trigger_word: trigger, response_text: response, reply_type: type })
      });
      if (res.ok) {
        setTrigger("");
        setResponse("");
        fetchCommands();
        toast({
          title: "Başarılı",
          description: "Özel komut başarıyla oluşturuldu.",
          variant: "default"
        });
      } else {
        toast({
          title: "Hata",
          description: "Komut eklenirken sunucuda bir hata oluştu.",
          variant: "destructive"
        });
      }
    } catch (e) {
      console.error(e);
      toast({
        title: "Bağlantı Hatası",
        description: "Sunucuya bağlanılamadı.",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bu komutu silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/guilds/${guildId}/custom-commands/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setCommands(commands.filter(c => c.id !== id));
        toast({
          title: "Silindi",
          description: "Özel komut başarıyla silindi.",
          variant: "default"
        });
      } else {
        toast({
          title: "Hata",
          description: "Komut silinirken bir hata oluştu.",
          variant: "destructive"
        });
      }
    } catch (e) {
      console.error(e);
      toast({
        title: "Bağlantı Hatası",
        description: "Sunucuya bağlanılamadı.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* ADD NEW COMMAND */}
      <div className="p-5 rounded-xl bg-card border border-border/50 shadow-sm relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <h3 className="text-sm font-semibold mb-5 text-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Yeni Özel Komut Oluştur
        </h3>
        
        <div className="grid gap-5 md:grid-cols-2 relative z-10">
          <div className="space-y-3">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tetikleyici Kelime</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 font-mono">!</span>
              <Input 
                placeholder="kurallar" 
                value={trigger}
                onChange={e => setTrigger(e.target.value)}
                className="pl-8 bg-background/50 focus:bg-background transition-colors"
              />
            </div>
            <p className="text-[11px] text-muted-foreground/70">Üyeler sohbete !{trigger || 'kurallar'} yazdığında tetiklenir.</p>
          </div>
          
          <div className="space-y-3">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mesaj Tipi (Görünüm)</Label>
            <div className="flex gap-2">
              <button 
                onClick={() => setType('embed')}
                className={`flex-1 flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${type === 'embed' ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 bg-background/50 text-muted-foreground hover:bg-background'}`}
              >
                <Sparkles className="w-5 h-5 mb-1" />
                <span className="text-xs font-medium">Modern Kutu (V2)</span>
              </button>
              <button 
                onClick={() => setType('plain')}
                className={`flex-1 flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${type === 'plain' ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 bg-background/50 text-muted-foreground hover:bg-background'}`}
              >
                <MessageSquare className="w-5 h-5 mb-1" />
                <span className="text-xs font-medium">Düz Metin</span>
              </button>
            </div>
          </div>
          
          <div className="space-y-3 md:col-span-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex justify-between">
              Botun Vereceği Yanıt
              <span className="text-[10px] lowercase normal-case opacity-70">(Değişkenleri tıklayarak ekleyin)</span>
            </Label>
            
            {/* Variable Selectors */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {AVAILABLE_VARIABLES.map(v => (
                <button
                  key={v.key}
                  onClick={() => insertVariable(v.key)}
                  className="px-2 py-1 bg-secondary/60 hover:bg-primary/20 hover:text-primary text-muted-foreground border border-transparent hover:border-primary/30 rounded-md text-[10px] font-mono transition-all group relative"
                >
                  {v.key}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-popover text-popover-foreground text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap shadow-md z-20">
                    {v.desc}
                  </div>
                </button>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Textarea 
                placeholder="Merhaba {user}! Sunucumuza hoş geldin..." 
                value={response}
                onChange={e => setResponse(e.target.value)}
                className="min-h-[140px] bg-background/50 focus:bg-background transition-colors resize-none"
              />
              
              {/* LIVE PREVIEW BOX */}
              <div className="flex flex-col h-full">
                <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Eye className="w-3 h-3" /> Canlı Önizleme
                </Label>
                <div className="flex-1 bg-[#313338] rounded-md border border-border/20 p-4 text-[#dbdee1] text-sm font-sans flex flex-col gap-2 overflow-y-auto">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-full bg-[#111214] flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden border border-[#2b2d31]">
                      <img src="/favicon.png" alt="Nyx" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <span className="absolute">N</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-white">Nyx</span>
                        <span className="bg-[#5865F2] text-white text-[9px] px-1 rounded font-medium flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5" /> BOT
                        </span>
                        <span className="text-[#80848E] text-[10px] ml-1">Bugün saat {new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                  
                  {type === 'embed' ? (
                    <div className="ml-10 bg-[#2b2d31] border-l-4 border-[#5865F2] rounded-r-md p-3 max-w-[90%]">
                      <div className="text-sm">
                        {renderPreview(response)}
                      </div>
                    </div>
                  ) : (
                    <div className="ml-10 text-sm">
                      {renderPreview(response)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-5 flex justify-end relative z-10">
          <Button onClick={handleAdd} className="bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all">
            <Plus className="w-4 h-4 mr-2" />
            Komutu Kaydet
          </Button>
        </div>
      </div>

      {/* LIST COMMANDS */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 px-1">
          Aktif Özel Komutlar <span className="bg-secondary text-secondary-foreground text-[10px] px-2 py-0.5 rounded-full">{commands.length}</span>
        </h3>
        
        {loading ? (
          <div className="text-center py-10 text-muted-foreground animate-pulse text-sm">Komutlar yükleniyor...</div>
        ) : commands.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border/50 rounded-xl bg-background/30 text-muted-foreground flex flex-col items-center">
            <MessageSquare className="w-8 h-8 mb-3 opacity-20" />
            <p className="text-sm">Henüz hiçbir özel komut oluşturmadınız.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {commands.map(cmd => (
              <div key={cmd.id} className="group relative p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all shadow-sm hover:shadow-md">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-primary/10 text-primary font-mono text-xs px-2 py-1 rounded-md font-semibold border border-primary/20">
                      !{cmd.trigger_word}
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase px-1.5 py-0.5 rounded bg-secondary">
                      {cmd.reply_type === 'embed' ? 'Modern' : 'Metin'}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleDelete(cmd.id)}
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all p-1"
                    title="Komutu Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-foreground/80 line-clamp-3 mt-3 bg-background/50 p-2 rounded-lg border border-border/30 text-xs whitespace-pre-line">
                  {cmd.response_text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
