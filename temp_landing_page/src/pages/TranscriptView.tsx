import React, { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  Ticket, 
  ArrowLeft, 
  Download, 
  Printer,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Layout,
  Code2
} from "lucide-react";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface TranscriptTicket {
  id: number;
  guild_id: string;
  channel_id: string;
  owner_id: string;
  owner_tag?: string;
  category?: string;
  reason?: string;
  status: string;
  claimed_by?: string;
  closed_by?: string;
  close_reason?: string;
  opened_at: string;
  closed_at: string;
}

export default function TranscriptView() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const [ticket, setTicket] = useState<TranscriptTicket | null>(null);
  const [rawHtml, setRawHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"html" | "raw">("html");
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const loadTranscript = async (silent = false) => {
    if (!ticketId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      // 1. Fetch JSON metadata
      const metaRes = await apiFetch(`/api/transcripts/${ticketId}`);
      if (!metaRes.ok) {
        throw new Error("Transkript bulunamadı veya bilet kaydı silinmiş.");
      }
      const metaData = await metaRes.json();
      setTicket(metaData.ticket);

      // 2. Fetch 1:1 Discord HTML with cache-busting timestamp
      const htmlRes = await fetch(`${API_BASE_URL}/api/transcripts/${ticketId}/html?t=${Date.now()}`);
      if (!htmlRes.ok) {
        throw new Error("1:1 Discord HTML transkripti oluşturulamadı.");
      }
      const htmlText = await htmlRes.text();
      setRawHtml(htmlText);
    } catch (err: any) {
      console.error("Transcript loading error:", err);
      if (!silent) setError(err.message || "Transkript verisi yüklenemedi.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadTranscript();

    if (!ticketId) return;

    // Real-Time Server-Sent Events (SSE) live connection
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`${API_BASE_URL}/api/events/live?ticketId=${ticketId}`);

      eventSource.addEventListener("connected", () => {
        setIsLiveConnected(true);
      });

      eventSource.addEventListener("ticket_message", () => {
        // Discord'da yeni mesaj yazıldığında sayfayı yenilemeden anlık güncelle!
        loadTranscript(true);
      });

      eventSource.addEventListener("ticket_closed", () => {
        loadTranscript(true);
      });

      eventSource.onerror = () => {
        setIsLiveConnected(false);
      };
    } catch (e) {
      console.warn("SSE connection error:", e);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [ticketId]);

  const handlePrint = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    } else {
      window.print();
    }
  };

  const handleDownload = () => {
    if (!rawHtml) return;
    const blob = new Blob([rawHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ticket-${ticket?.id || ticketId}-transcript.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1E1F22] text-[#DBDEE1] flex flex-col items-center justify-center p-6 space-y-4">
        <RefreshCw className="h-10 w-10 text-[#5865F2] animate-spin" />
        <div className="text-center space-y-1">
          <h3 className="font-semibold text-white text-base">1:1 Discord Transkripti Yükleniyor</h3>
          <p className="text-xs text-[#949BA4]">Bilet mesajları ve medya dosyaları senkronize ediliyor...</p>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-[#1E1F22] text-[#DBDEE1] flex flex-col items-center justify-center p-6 text-center">
        <div className="h-16 w-16 mx-auto rounded-2xl bg-destructive/10 border border-destructive/20 grid place-items-center mb-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-white">Transkript Kaydı Bulunamadı</h2>
        <p className="text-xs text-[#949BA4] mt-2 max-w-md mx-auto">
          {error || "İstenen bilet kaydı veritabanında bulunamadı. Silinmiş veya ID yanlış olabilir."}
        </p>
        <div className="flex items-center gap-3 mt-6">
          <Button asChild variant="outline" className="rounded-xl bg-[#2B2D31] border-[#3F4147] text-white hover:bg-[#35373C]">
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" /> Panele Dön
            </Link>
          </Button>
          <Button onClick={() => loadTranscript()} variant="default" className="rounded-xl bg-[#5865F2] hover:bg-[#4752C4]">
            <RefreshCw className="h-4 w-4 mr-2" /> Yeniden Dene
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1E1F22] text-[#DBDEE1] flex flex-col">
      {/* Top Discord-Style Control Toolbar */}
      <header className="sticky top-0 z-30 bg-[#2B2D31] border-b border-[#1F2023] px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="h-8 px-2.5 text-[#949BA4] hover:text-white hover:bg-[#35373C]">
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Panel
            </Link>
          </Button>
          <div className="h-4 w-[1px] bg-[#3F4147]" />
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-[#5865F2]" />
            <span className="font-semibold text-white text-sm">
              Bilet #{ticket.id}
            </span>
            <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${ticket.status === "closed" ? "bg-[#232428] text-emerald-400 border-emerald-500/30" : "bg-[#5865F2]/20 text-[#5865F2] border-[#5865F2]/40"}`}>
              {ticket.status === "closed" ? "Kapatıldı & Arşiv" : "Açık"}
            </Badge>
            {ticket.category && (
              <span className="hidden sm:inline-block text-xs text-[#949BA4] font-medium">
                • {ticket.category}
              </span>
            )}
            {ticket.owner_tag && (
              <span className="hidden md:inline-block text-xs text-[#949BA4]">
                • Sahibi: <strong className="text-[#DBDEE1]">{ticket.owner_tag}</strong>
              </span>
            )}
            {isLiveConnected && (
              <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium ml-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span>Canlı Yayın</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="bg-[#1E1F22] p-0.5 rounded-lg border border-[#3F4147] hidden sm:flex items-center gap-1">
            <Button
              size="sm"
              variant={viewMode === "html" ? "secondary" : "ghost"}
              onClick={() => setViewMode("html")}
              className={`h-7 px-2.5 text-xs rounded-md ${viewMode === "html" ? "bg-[#35373C] text-white font-medium" : "text-[#949BA4] hover:text-white"}`}
            >
              <Layout className="h-3.5 w-3.5 mr-1" />
              1:1 Discord HTML
            </Button>
            <Button
              size="sm"
              variant={viewMode === "raw" ? "secondary" : "ghost"}
              onClick={() => setViewMode("raw")}
              className={`h-7 px-2.5 text-xs rounded-md ${viewMode === "raw" ? "bg-[#35373C] text-white font-medium" : "text-[#949BA4] hover:text-white"}`}
            >
              <Code2 className="h-3.5 w-3.5 mr-1" />
              Kaynak Kod
            </Button>
          </div>

          {/* Open Direct URL in New Tab */}
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-8 bg-[#313338] border-[#3F4147] text-white hover:bg-[#383A40] text-xs gap-1.5 cursor-pointer"
          >
            <a href={`${API_BASE_URL}/api/transcripts/${ticket.id}/html`} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Yeni Sekmede Aç</span>
            </a>
          </Button>

          {/* Download HTML */}
          <Button
            onClick={handleDownload}
            size="sm"
            variant="outline"
            className="h-8 bg-[#313338] border-[#3F4147] text-white hover:bg-[#383A40] text-xs gap-1.5 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">İndir</span>
          </Button>

          {/* Print / PDF */}
          <Button
            onClick={handlePrint}
            size="sm"
            variant="outline"
            className="h-8 bg-[#313338] border-[#3F4147] text-white hover:bg-[#383A40] text-xs gap-1.5 cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Yazdır</span>
          </Button>
        </div>
      </header>

      {/* Main 1:1 Discord HTML Frame Container */}
      <main className="flex-1 w-full bg-[#313338] overflow-hidden flex flex-col">
        {viewMode === "html" ? (
          <iframe
            ref={iframeRef}
            srcDoc={rawHtml}
            title={`Bilet #${ticket.id} Discord Transkripti`}
            className="w-full flex-1 border-0 min-h-[calc(100vh-53px)]"
            sandbox="allow-same-origin allow-scripts allow-popups allow-modals"
          />
        ) : (
          <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full">
            <div className="bg-[#1E1F22] border border-[#3F4147] rounded-xl p-4 overflow-x-auto">
              <pre className="text-xs font-mono text-[#DBDEE1] whitespace-pre-wrap break-all">
                {rawHtml}
              </pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
