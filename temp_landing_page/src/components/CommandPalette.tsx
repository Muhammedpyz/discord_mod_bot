import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Search, Shield, Music, Radio, Ticket, Terminal, 
  BookOpen, Sparkles, Server, FileText, ExternalLink,
  ChevronRight, Laptop, ArrowRight
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { siteConfig } from "@/config/site";

export const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [commands, setCommands] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.commandCategories && Object.keys(data.commandCategories).length > 0) {
          const allCmds: any[] = [];
          Object.keys(data.commandCategories).forEach((cat) => {
            data.commandCategories[cat].forEach((cmd: any) => {
              allCmds.push({ ...cmd, category: cat });
            });
          });
          setCommands(allCmds);
        }
      })
      .catch(() => {});
  }, []);

  const runCommand = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <>
      {/* Keyboard Trigger Button for Navbar */}
      <button
        onClick={() => setOpen(true)}
        className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-muted-foreground liquid-glass hover:text-foreground hover:bg-muted/40 transition-colors"
        title="Hızlı arama yapın (Ctrl + K)"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Hızlı Ara…</span>
        <kbd className="pointer-events-none inline-flex h-4.5 select-none items-center gap-0.5 rounded border border-border/60 bg-muted px-1.5 font-mono text-[10px] font-medium opacity-80">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Komut, rehber veya sayfa ara (örn. ban, oda, mute)..." />
        <CommandList className="max-h-[380px] p-2">
          <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
            Aramanızla eşleşen sonuç bulunamadı.
          </CommandEmpty>

          {/* Navigation Pages */}
          <CommandGroup heading="Sayfalar">
            {siteConfig.nav.map((item) => (
              <CommandItem
                key={item.href}
                onSelect={() => runCommand(() => navigate(item.href))}
                className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-medium text-foreground">{item.label}</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator className="my-1" />

          {/* Quick Guide Links */}
          <CommandGroup heading="Kullanım Rehberi & Modüller">
            {[
              { name: "Rol Hafızası (Role Memory)", query: "rol" },
              { name: "Geçici Özel Ses Odaları (/odapanel)", query: "oda" },
              { name: "Destek Bilet (Ticket) Sistemi", query: "ticket" },
              { name: "14 Kategorili Loglama Sistemi", query: "log" },
              { name: "Kayıpsız Müzik & Filtreler", query: "play" },
              { name: "AutoMod & Raid Koruma", query: "automod" },
            ].map((g) => (
              <CommandItem
                key={g.name}
                onSelect={() => runCommand(() => navigate(`/docs?q=${encodeURIComponent(g.query)}`))}
                className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="h-4 w-4 text-emerald-400" />
                  <span className="text-foreground">{g.name}</span>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground">Kılavuz</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator className="my-1" />

          {/* Commands */}
          <CommandGroup heading="Komutlar">
            {(commands.length > 0 ? commands : siteConfig.commandCategories.flatMap(c => c.commands)).map((c: any) => (
              <CommandItem
                key={c.name}
                onSelect={() => runCommand(() => navigate(`/commands?q=${encodeURIComponent(c.name.replace('/', ''))}`))}
                className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Terminal className="h-4 w-4 text-indigo-400 shrink-0" />
                  <span className="font-mono font-semibold text-primary">{c.name}</span>
                  <span className="text-xs text-muted-foreground truncate hidden sm:inline">{c.description}</span>
                </div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                  {c.category || "Komut"}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
};
