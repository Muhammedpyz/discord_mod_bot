import React, { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Search, Shield, X, Hash, Volume2, Folder, User } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

export interface Role {
  id: string;
  name: string;
  color?: number | string;
}

export interface Channel {
  id: string;
  name: string;
  type: number;
}

export interface Member {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  isBot: boolean;
  roles: string[];
}

export function getRoleColor(color?: number | string): string {
  if (!color || color === 0 || color === "0" || color === "#000000") return "#99aab5";
  if (typeof color === "number") {
    return `#${color.toString(16).padStart(6, "0")}`;
  }
  return color;
}

export function RoleSelect({
  value,
  onChange,
  roles,
  placeholder = "-- Rol Seçiniz --",
  disabled = false,
  className = "",
  allowClear = true,
}: {
  value: string;
  onChange: (val: string) => void;
  roles: Role[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedRole = roles.find((r) => r.id === value);
  const selectedColor = selectedRole ? getRoleColor(selectedRole.color) : "#99aab5";

  const filteredRoles = useMemo(() => {
    if (!search.trim()) return roles;
    const q = search.toLowerCase();
    return roles.filter((r) => r.name.toLowerCase().includes(q));
  }, [roles, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={`w-full flex items-center justify-between text-xs h-10 rounded-xl border border-border/70 bg-card/80 hover:bg-card hover:border-primary/50 px-3 transition-all text-left group shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {selectedRole ? (
              <>
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-white/20 shadow-sm"
                  style={{ backgroundColor: selectedColor }}
                />
                <span className="truncate font-medium text-foreground">
                  {selectedRole.name}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground flex items-center gap-2 truncate">
                <Shield className="h-3.5 w-3.5 opacity-40 shrink-0" />
                <span>{placeholder}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            {allowClear && selectedRole && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                className="h-5 w-5 rounded-md hover:bg-muted/60 grid place-items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Seçimi Temizle"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-foreground transition-colors" />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[320px] p-2 bg-card/95 backdrop-blur-xl border border-border/80 rounded-2xl shadow-2xl z-50"
      >
        <div className="relative mb-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rol ara..."
            className="h-8 pl-8 text-xs rounded-xl bg-background/90 border-border/60 focus-visible:ring-1 focus-visible:ring-primary"
            autoFocus
          />
        </div>

        <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1 scrollbar-none">
          {allowClear && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
                setSearch("");
              }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs text-left transition-colors ${
                !value
                  ? "bg-primary/20 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 shrink-0" />
                <span>-- Rol Yok (Seçimi Kaldır) --</span>
              </div>
              {!value && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          )}

          {filteredRoles.length === 0 ? (
            <p className="text-center py-4 text-xs text-muted-foreground">Eşleşen rol bulunamadı.</p>
          ) : (
            filteredRoles.map((r) => {
              const rColor = getRoleColor(r.color);
              const isSelected = r.id === value;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    onChange(r.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs text-left transition-all ${
                    isSelected
                      ? "bg-primary/20 text-foreground font-semibold shadow-sm"
                      : "text-muted-foreground hover:bg-card/80 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm ring-1 ring-white/10"
                      style={{ backgroundColor: rColor }}
                    />
                    <span
                      className="truncate"
                      style={{ color: rColor !== "#99aab5" ? rColor : undefined }}
                    >
                      {r.name}
                    </span>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ChannelSelect({
  value,
  onChange,
  channels,
  placeholder = "-- Kanal Seçiniz --",
  type = "text",
  disabled = false,
  className = "",
  allowClear = true,
}: {
  value: string;
  onChange: (val: string) => void;
  channels: Channel[];
  placeholder?: string;
  type?: "text" | "voice" | "category" | "all";
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedChannel = channels.find((c) => c.id === value);
  const Icon = type === "voice" ? Volume2 : type === "category" ? Folder : Hash;

  const filteredChannels = useMemo(() => {
    if (!search.trim()) return channels;
    const q = search.toLowerCase();
    return channels.filter((c) => c.name.toLowerCase().includes(q));
  }, [channels, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={`w-full flex items-center justify-between text-xs h-10 rounded-xl border border-border/70 bg-card/80 hover:bg-card hover:border-primary/50 px-3 transition-all text-left group shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Icon className="h-3.5 w-3.5 text-primary shrink-0 opacity-80" />
            {selectedChannel ? (
              <span className="truncate font-medium text-foreground">
                {selectedChannel.name}
              </span>
            ) : (
              <span className="text-muted-foreground truncate">{placeholder}</span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            {allowClear && selectedChannel && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                className="h-5 w-5 rounded-md hover:bg-muted/60 grid place-items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Seçimi Temizle"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-foreground transition-colors" />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[320px] p-2 bg-card/95 backdrop-blur-xl border border-border/80 rounded-2xl shadow-2xl z-50"
      >
        <div className="relative mb-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Kanal ara..."
            className="h-8 pl-8 text-xs rounded-xl bg-background/90 border-border/60 focus-visible:ring-1 focus-visible:ring-primary"
            autoFocus
          />
        </div>

        <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1 scrollbar-none">
          {allowClear && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
                setSearch("");
              }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs text-left transition-colors ${
                !value
                  ? "bg-primary/20 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
              }`}
            >
              <span>-- Kanal Yok (Devre Dışı) --</span>
              {!value && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          )}

          {filteredChannels.length === 0 ? (
            <p className="text-center py-4 text-xs text-muted-foreground">Eşleşen kanal bulunamadı.</p>
          ) : (
            filteredChannels.map((c) => {
              const isSelected = c.id === value;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onChange(c.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs text-left transition-all ${
                    isSelected
                      ? "bg-primary/20 text-foreground font-semibold shadow-sm"
                      : "text-muted-foreground hover:bg-card/80 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{c.name}</span>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function MemberSelect({
  value,
  onChange,
  members,
  placeholder = "-- Kişi / Üye Seçiniz --",
  disabled = false,
  className = "",
  allowClear = true,
}: {
  value: string;
  onChange: (val: string) => void;
  members: Member[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedMember = members.find((m) => m.id === value);

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        m.username.toLowerCase().includes(q) ||
        m.id.includes(q)
    );
  }, [members, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={`w-full flex items-center justify-between text-xs h-10 rounded-xl border border-border/70 bg-card/80 hover:bg-card hover:border-primary/50 px-3 transition-all text-left group shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {selectedMember ? (
              <>
                <img
                  src={selectedMember.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"}
                  alt={selectedMember.username}
                  className="h-5 w-5 rounded-full object-cover shrink-0 ring-1 ring-border/80"
                />
                <span className="truncate font-medium text-foreground">
                  {selectedMember.displayName}{" "}
                  <span className="text-[11px] text-muted-foreground font-normal">
                    (@{selectedMember.username})
                  </span>
                </span>
                {selectedMember.isBot && (
                  <span className="text-[9px] bg-primary/20 text-primary px-1 rounded font-bold">
                    BOT
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground flex items-center gap-2 truncate">
                <User className="h-3.5 w-3.5 opacity-40 shrink-0" />
                <span>{placeholder}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            {allowClear && selectedMember && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                className="h-5 w-5 rounded-md hover:bg-muted/60 grid place-items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Seçimi Temizle"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-foreground transition-colors" />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[340px] p-2 bg-card/95 backdrop-blur-xl border border-border/80 rounded-2xl shadow-2xl z-50"
      >
        <div className="relative mb-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="İsim, kullanıcı adı veya ID ile ara..."
            className="h-8 pl-8 text-xs rounded-xl bg-background/90 border-border/60 focus-visible:ring-1 focus-visible:ring-primary"
            autoFocus
          />
        </div>

        <div className="max-h-60 overflow-y-auto space-y-0.5 pr-1 scrollbar-none">
          {allowClear && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
                setSearch("");
              }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs text-left transition-colors ${
                !value
                  ? "bg-primary/20 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
              }`}
            >
              <span>-- Kişi Yok (Seçimi Kaldır) --</span>
              {!value && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          )}

          {filteredMembers.length === 0 ? (
            <div className="py-2 px-1 text-center space-y-2">
              <p className="text-xs text-muted-foreground">Eşleşen üye bulunamadı.</p>
              {search.trim().length >= 4 && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(search.trim());
                    setOpen(false);
                    setSearch("");
                  }}
                  className="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs bg-primary/20 hover:bg-primary/30 text-primary font-medium transition-all cursor-pointer"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>"{search.trim()}" ID'sini Seç</span>
                </button>
              )}
            </div>
          ) : (
            filteredMembers.map((m) => {
              const isSelected = m.id === value;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs text-left transition-all ${
                    isSelected
                      ? "bg-primary/20 text-foreground font-semibold shadow-sm"
                      : "text-muted-foreground hover:bg-card/80 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <img
                      src={m.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"}
                      alt={m.username}
                      className="h-6 w-6 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground leading-tight flex items-center gap-1.5">
                        <span>{m.displayName}</span>
                        {m.isBot && (
                          <span className="text-[9px] bg-primary/20 text-primary px-1 rounded font-bold">
                            BOT
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">@{m.username}</p>
                    </div>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "-- Seçiniz --",
  disabled = false,
  className = "",
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={`w-full flex items-center justify-between text-xs h-10 rounded-xl border border-border/70 bg-card/80 hover:bg-card hover:border-primary/50 px-3 transition-all text-left group shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        >
          <span className={`truncate ${selected ? "font-medium text-foreground" : "text-muted-foreground"}`}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-foreground transition-colors ml-2 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[280px] p-1.5 bg-card/95 backdrop-blur-xl border border-border/80 rounded-2xl shadow-2xl z-50"
      >
        <div className="max-h-56 overflow-y-auto space-y-0.5 scrollbar-none">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs text-left transition-all ${
                  isSelected
                    ? "bg-primary/20 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-card/80 hover:text-foreground"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function MultiRoleSelect({
  values = [],
  onChange,
  roles,
  placeholder = "+ Rol Ekle...",
  disabled = false,
  className = "",
}: {
  values: string[];
  onChange: (vals: string[]) => void;
  roles: Role[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredRoles = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return roles;
    return roles.filter((r) => r.name.toLowerCase().includes(q));
  }, [roles, search]);

  const toggleRole = (roleId: string) => {
    if (values.includes(roleId)) {
      onChange(values.filter((id) => id !== roleId));
    } else {
      onChange([...values, roleId]);
    }
  };

  const removeRole = (roleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(values.filter((id) => id !== roleId));
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-1.5 min-h-[42px] p-2 rounded-xl border border-border/70 bg-card/70 shadow-inner">
        {values.length === 0 ? (
          <span className="text-xs text-muted-foreground/70 px-1 py-1 italic flex items-center gap-1.5">
            <Shield className="h-3 w-3 opacity-40" />
            Henüz muaf rol eklenmedi
          </span>
        ) : (
          values.map((roleId) => {
            const role = roles.find((r) => r.id === roleId);
            const name = role ? role.name : roleId;
            const color = role ? getRoleColor(role.color) : "#99aab5";
            return (
              <span
                key={roleId}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-card border border-border/80 shadow-sm transition-all hover:border-primary/50 group"
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0 ring-1 ring-white/20"
                  style={{ backgroundColor: color }}
                />
                <span
                  className="truncate max-w-[140px]"
                  style={{ color: color !== "#99aab5" ? color : undefined }}
                >
                  {name}
                </span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => removeRole(roleId, e)}
                    className="h-4 w-4 rounded grid place-items-center text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-0.5 cursor-pointer"
                    title="Rolü Kaldır"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            );
          })
        )}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-dashed border-primary/50 bg-primary/10 hover:bg-primary/20 text-primary font-medium transition-all ml-auto cursor-pointer disabled:opacity-50"
            >
              <span>{placeholder}</span>
              <ChevronsUpDown className="h-3 w-3 opacity-70" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-[280px] p-2 bg-card/95 backdrop-blur-xl border border-border/80 rounded-2xl shadow-2xl z-50"
          >
            <div className="relative mb-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rol ara..."
                className="h-8 pl-8 text-xs rounded-xl bg-background/90 border-border/60 focus-visible:ring-1 focus-visible:ring-primary"
                autoFocus
              />
            </div>
            <div className="max-h-52 overflow-y-auto space-y-0.5 pr-1 scrollbar-none">
              {filteredRoles.length === 0 ? (
                <p className="text-center py-3 text-xs text-muted-foreground">Rol bulunamadı.</p>
              ) : (
                filteredRoles.map((r) => {
                  const isSelected = values.includes(r.id);
                  const color = getRoleColor(r.color);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleRole(r.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs text-left transition-all ${
                        isSelected
                          ? "bg-primary/20 text-foreground font-semibold"
                          : "text-muted-foreground hover:bg-card/80 hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span
                          className="truncate"
                          style={{ color: color !== "#99aab5" ? color : undefined }}
                        >
                          {r.name}
                        </span>
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
                    </button>
                  );
                })
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export function MultiChannelSelect({
  values = [],
  onChange,
  channels,
  placeholder = "+ Kanal Ekle...",
  disabled = false,
  className = "",
}: {
  values: string[];
  onChange: (vals: string[]) => void;
  channels: Channel[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredChannels = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return channels;
    return channels.filter((c) => c.name.toLowerCase().includes(q));
  }, [channels, search]);

  const toggleChannel = (channelId: string) => {
    if (values.includes(channelId)) {
      onChange(values.filter((id) => id !== channelId));
    } else {
      onChange([...values, channelId]);
    }
  };

  const removeChannel = (channelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(values.filter((id) => id !== channelId));
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-1.5 min-h-[42px] p-2 rounded-xl border border-border/70 bg-card/70 shadow-inner">
        {values.length === 0 ? (
          <span className="text-xs text-muted-foreground/70 px-1 py-1 italic flex items-center gap-1.5">
            <Hash className="h-3 w-3 opacity-40" />
            Henüz muaf kanal eklenmedi
          </span>
        ) : (
          values.map((channelId) => {
            const ch = channels.find((c) => c.id === channelId);
            const name = ch ? ch.name : channelId;
            return (
              <span
                key={channelId}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-card border border-border/80 shadow-sm transition-all hover:border-primary/50 group"
              >
                <Hash className="h-3 w-3 text-primary shrink-0" />
                <span className="truncate max-w-[140px] text-foreground">{name}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => removeChannel(channelId, e)}
                    className="h-4 w-4 rounded grid place-items-center text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-0.5 cursor-pointer"
                    title="Kanalı Kaldır"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            );
          })
        )}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-dashed border-primary/50 bg-primary/10 hover:bg-primary/20 text-primary font-medium transition-all ml-auto cursor-pointer disabled:opacity-50"
            >
              <span>{placeholder}</span>
              <ChevronsUpDown className="h-3 w-3 opacity-70" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-[280px] p-2 bg-card/95 backdrop-blur-xl border border-border/80 rounded-2xl shadow-2xl z-50"
          >
            <div className="relative mb-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Kanal ara..."
                className="h-8 pl-8 text-xs rounded-xl bg-background/90 border-border/60 focus-visible:ring-1 focus-visible:ring-primary"
                autoFocus
              />
            </div>
            <div className="max-h-52 overflow-y-auto space-y-0.5 pr-1 scrollbar-none">
              {filteredChannels.length === 0 ? (
                <p className="text-center py-3 text-xs text-muted-foreground">Kanal bulunamadı.</p>
              ) : (
                filteredChannels.map((c) => {
                  const isSelected = values.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleChannel(c.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs text-left transition-all ${
                        isSelected
                          ? "bg-primary/20 text-foreground font-semibold"
                          : "text-muted-foreground hover:bg-card/80 hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Hash className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate">{c.name}</span>
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
                    </button>
                  );
                })
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
