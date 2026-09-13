// EYLEMLER TAB - Inline component for GuildDashboard.tsx
// Bu dosya sadece referans içindir, direkt GuildDashboard.tsx içine dahil edilecek

function EylemlerTab({ guildId, guildDetails, configs, setConfigs, saveConfigModule, savingModule, onRefresh }) {
  const [selectedMember, setSelectedMember] = useState("");
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("");
  const [loadingAction, setLoadingAction] = useState(null);
  const [actionResult, setActionResult] = useState(null);
  const [activeSection, setActiveSection] = useState("moderation");
  const [kickReason, setKickReason] = useState("");
  const [banReason, setBanReason] = useState("");
  const [deleteMsgSeconds, setDeleteMsgSeconds] = useState(0);
  const [muteDuration, setMuteDuration] = useState(60);
  const [muteReason, setMuteReason] = useState("");
  const [warnReason, setWarnReason] = useState("");
  const [nickChange, setNickChange] = useState("");
  const [giveRoleInput, setGiveRoleInput] = useState("");
  const [removeRoleInput, setRemoveRoleInput] = useState("");
  const [createChanName, setCreateChanName] = useState("");
  const [createChanType, setCreateChanType] = useState("text");
  const [createChanParent, setCreateChanParent] = useState("");
  const [lockdownChan, setLockdownChan] = useState("");
  const [lockdownState, setLockdownState] = useState(true);
  const [slowmodeRate, setSlowmodeRate] = useState(0);
  const [clearCount, setClearCount] = useState(50);
  const [announcementText, setAnnouncementText] = useState("");
  const [ticketSubject, setTicketSubject] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState([""]);
  const [musicQuery, setMusicQuery] = useState("");
  const [musicVolume, setMusicVolume] = useState(configs?.music?.default_volume || 80);
  const [diceSides, setDiceSides] = useState(6);
  const [betAmount, setBetAmount] = useState(100);
  const [guessMax, setGuessMax] = useState(100);
  const [guessNum, setGuessNum] = useState("");
  const textChannels = guildDetails?.channels.text || [];
  const voiceChannels = guildDetails?.channels.voice || [];
  const categoryChannels = guildDetails?.channels.categories || [];
  const roles = guildDetails?.roles || [];
  const members = guildDetails?.members || [];
  const filteredMembers = members.filter(m => !memberSearchQuery.trim() || m.displayName.toLowerCase().includes(memberSearchQuery.toLowerCase()) || m.username.toLowerCase().includes(memberSearchQuery.toLowerCase()) || m.id.includes(memberSearchQuery));

  // Generic action executor
  const executeAction = async (endpoint, body, successMsg) => {
    if (!guildId) return;
    setLoadingAction(endpoint);
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/execute/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Başarılı", description: data.message || successMsg });
        setActionResult(data);
        onRefresh?.(true);
      } else {
        toast({ title: "Hata", description: data.error || "İşlem başarısız.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Bağlantı Hatası", description: e.message, variant: "destructive" });
    } finally {
      setLoadingAction(null);
    }
  };

  // Fetch user info / avatar
  const fetchUserInfo = async (userId) => {
    if (!userId) return;
    setLoadingAction(`user-info-${userId}`);
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/execute/user-info/${userId}`);
      const data = await res.json();
      if (res.ok) {
        setActionResult({ type: "userInfo", ...data });
      }
    } catch (e) {}
    setLoadingAction(null);
  };

  const fetchServerInfo = async () => {
    if (!guildId) return;
    setLoadingAction("server-info");
    try {
      const res = await apiFetch(`/api/guilds/${guildId}/execute/server-info`);
      const data = await res.json();
      if (res.ok) setActionResult({ type: "serverInfo", ...data });
    } catch (e) {}
    setLoadingAction(null);
  };

  // Quick helper buttons
  const quickActions = [
    { id: "moderation", label: "Moderasyon", icon: ShieldAlert, badge: null },
    { id: "muted", label: "Susturma", icon: Clock, badge: null },
    { id: "roles", label: "Rol & Nick", icon: Shield, badge: null },
    { id: "channels", label: "Kanal İşlemleri", icon: Hash, badge: null },
    { id: "messages", label: "Mesaj & Bilet", icon: MessageSquare, badge: null },
    { id: "music", label: "Müzik Kontrol", icon: Volume2, badge: null },
    { id: "games", label: "Oyunlar & Ekonomi", icon: Gamepad2, badge: null },
    { id: "info", label: "Bilgi & Araçlar", icon: Info, badge: null },
  ];

  return (
    <>
      <Card className="liquid-glass border-border/60 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Komutlar & Eylemler Paneli
          </CardTitle>
          <CardDescription>
            Tüm bot komutlarını web panelinden doğrudan yönetin ve uygulayın. Discord'a gitmeden her şeyi buradan kontrol edin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Section Tabs */}
          <Tabs value={activeSection} onValueChange={setActiveSection} className="space-y-6">
            <div className="flex overflow-x-auto scrollbar-none pb-2 -mx-1 px-1 gap-2">
              {quickActions.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSection(s.id)}
                    className={`whitespace-nowrap flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer ${
                      activeSection === s.id
                        ? "bg-primary text-primary-foreground font-semibold shadow-[var(--shadow-glow)]"
                        : "liquid-glass text-foreground hover:border-primary/40"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{s.label}</span>
                    {s.badge && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-md font-semibold">{s.badge}</span>}
                  </button>
                );
              })}
            </div>

            {/* ================= MODERASYON EYLEMLERİ ================= */}
            <TabsContent value="moderation">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* KICK */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Trash2 className="h-4 w-4 text-red-400"/>Sunucudan At (Kick)</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <MemberSelect members={members} value={selectedMember} onChange={setSelectedMember} placeholder="Üye seçiniz..." className="h-9"/>
                    <div><Label className="text-xs">Gerekçe</Label><Input className="h-8 text-xs mt-1" value={kickReason} onChange={(e) => setKickReason(e.target.value)} placeholder="Sebep yazın..."/></div>
                    <Button size="sm" disabled={!selectedMember || loadingAction} onClick={() => executeAction("kick", { userId: selectedMember, reason: kickReason })} className="w-full h-8 text-xs bg-red-500 hover:bg-red-600">{loadingAction === "kick" ? "Uygulanıyor..." : "Kick Uygula"}</Button>
                  </CardContent>
                </Card>
                {/* BAN */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Ban className="h-4 w-4 text-red-500"/>Yasakla (Ban)</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <MemberSelect members={members} value={selectedMember} onChange={setSelectedMember} placeholder="Üye seçiniz..." className="h-9"/>
                    <div><Label className="text-xs">Silinecek Mesaj Süresi (dk)</Label><Input type="number" className="h-8 text-xs mt-1" value={deleteMsgSeconds} onChange={(e) => setDeleteMsgSeconds(Number(e.target.value))} min="0" max="1440"/></div>
                    <div><Label className="text-xs">Gerekçe</Label><Input className="h-8 text-xs mt-1" value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Sebep yazın..."/></div>
                    <Button size="sm" disabled={!selectedMember || loadingAction} onClick={() => executeAction("ban", { userId: selectedMember, deleteMessageSeconds: deleteMsgSeconds * 60, reason: banReason })} className="w-full h-8 text-xs bg-red-600 hover:bg-red-700">{loadingAction === "ban" ? "Uygulanıyor..." : "BAN Uygula"}</Button>
                  </CardContent>
                </Card>
                {/* SOFTBAN */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-purple-400"/>Softban (Mesajları Sil + Ban)</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <MemberSelect members={members} value={selectedMember} onChange={setSelectedMember} placeholder="Üye seçiniz..." className="h-9"/>
                    <div><Label className="text-xs">Silme Süresi (gün, max 7)</Label><Input type="number" className="h-8 text-xs mt-1" value={deleteMsgSeconds} onChange={(e) => setDeleteMsgSeconds(Math.min(Math.max(Number(e.target.value)||1,0), 7))} min="0" max="7"/></div>
                    <Button size="sm" disabled={!selectedMember || loadingAction} onClick={() => executeAction("softban", { userId: selectedMember, deleteMessageSeconds: Math.min(deleteMsgSeconds, 7) * 86400, reason: "Softban" })} className="w-full h-8 text-xs bg-purple-600 hover:bg-purple-700">{loadingAction === "softban" ? "Uygulanıyor..." : "Softban Uygula"}</Button>
                  </CardContent>
                </Card>
                {/* SÜRELİ BAN */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4 text-orange-400"/>Süreli Ban</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <MemberSelect members={members} value={selectedMember} onChange={setSelectedMember} placeholder="Üye seçiniz..." className="h-9"/>
                    <div><Label className="text-xs">Süre (dakika)</Label><Input type="number" className="h-8 text-xs mt-1" value={muteDuration} onChange={(e) => setMuteDuration(Number(e.target.value))} min="1"/></div>
                    <div><Label className="text-xs">Gerekçe</Label><Input className="h-8 text-xs mt-1" value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Sebep..."/></div>
                    <Button size="sm" disabled={!selectedMember || loadingAction} onClick={() => executeAction("temp-ban", { userId: selectedMember, durationMinutes: muteDuration, reason: banReason })} className="w-full h-8 text-xs bg-orange-600 hover:bg-orange-700">{loadingAction === "temp-ban" ? "Uygulanıyor..." : "Süreli Ban Uygula"}</Button>
                  </CardContent>
                </Card>
                {/* UNBAN */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-400"/>Yasak Kaldır (Unban)</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <MemberSelect members={members} value={selectedMember} onChange={setSelectedMember} placeholder="ID gir veya üye seç..." className="h-9"/>
                    <Button size="sm" disabled={!selectedMember || loadingAction} onClick={() => executeAction("unban", { userId: selectedMember, reason: "Web Panel" })} className="w-full h-8 text-xs bg-green-600 hover:bg-green-700">{loadingAction === "unban" ? "Uygulanıyor..." : "UNBAN Uygula"}</Button>
                  </CardContent>
                </Card>
                {/* WARN */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-yellow-400"/>Uyarı Ver (Warn)</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <MemberSelect members={members} value={selectedMember} onChange={setSelectedMember} placeholder="Üye seçiniz..." className="h-9"/>
                    <div><Label className="text-xs">Gerekçe</Label><Input className="h-8 text-xs mt-1" value={warnReason} onChange={(e) => setWarnReason(e.target.value)} placeholder="Neden uyardığınızı yazın..."/></div>
                    <Button size="sm" disabled={!selectedMember || loadingAction} onClick={() => executeAction("warn", { userId: selectedMember, reason: warnReason })} className="w-full h-8 text-xs bg-yellow-600 hover:bg-yellow-700">{loadingAction === "warn" ? "Uygulanıyor..." : "WARN Uygula"}</Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ================= SUSTURMA YÖNETİMİ ================= */}
            <TabsContent value="muted">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* MUTE (Timeout) */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4 text-amber-400"/>Metin Sustur (Timeout)</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <MemberSelect members={members} value={selectedMember} onChange={setSelectedMember} placeholder="Üye seçiniz..." className="h-9"/>
                    <div><Label className="text-xs">Süre (dakika, max 10080)</Label><Input type="number" className="h-8 text-xs mt-1" value={muteDuration} onChange={(e) => setMuteDuration(Number(e.target.value))} min="1" max="10080"/></div>
                    <div><Label className="text-xs">Gerekçe</Label><Input className="h-8 text-xs mt-1" value={muteReason} onChange={(e) => setMuteReason(e.target.value)} placeholder="Sebep..."/></div>
                    <Button size="sm" disabled={!selectedMember || loadingAction} onClick={() => executeAction("mute", { userId: selectedMember, durationMinutes: muteDuration, reason: muteReason })} className="w-full h-8 text-xs bg-amber-600 hover:bg-amber-700">{loadingAction === "mute" ? "Uygulanıyor..." : "MUTE UYGULA"}</Button>
                  </CardContent>
                </Card>
                {/* UNMUTE */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Unlock className="h-4 w-4 text-green-400"/>Susturma Kaldır (Unmute)</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <MemberSelect members={members} value={selectedMember} onChange={setSelectedMember} placeholder="Üye seçiniz..." className="h-9"/>
                    <Button size="sm" disabled={!selectedMember || loadingAction} onClick={() => executeAction("unmute", { userId: selectedMember, reason: "Web Panel" })} className="w-full h-8 text-xs bg-green-600 hover:bg-green-700">{loadingAction === "unmute" ? "Uygulanıyor..." : "UNMUTE"}</Button>
                  </CardContent>
                </Card>
                {/* VOICE MUTE */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><VolumeX className="h-4 w-4 text-pink-400"/>Ses Sustur (Deafen/Mute)</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <MemberSelect members={members} value={selectedMember} onChange={setSelectedMember} placeholder="Üye seçiniz..." className="h-9"/>
                    <div className="flex items-center gap-3"><Switch checked={true} onCheckedChange={() => {}} /><Label className="text-xs">Mic Mute</Label></div>
                    <Button size="sm" disabled={!selectedMember || loadingAction} onClick={() => executeAction("vmute", { userId: selectedMember, mute: true, deaf: false, reason: "Voice mute" })} className="w-full h-8 text-xs bg-pink-600 hover:bg-pink-700">{loadingAction === "vmute" ? "Uygulanıyor..." : "VOICE MUTE"}</Button>
                  </CardContent>
                </Card>
                {/* VOICE UNMUTE */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Volume2 className="h-4 w-4 text-blue-400"/>Ses Mutesini Kaldır</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <MemberSelect members={members} value={selectedMember} onChange={setSelectedMember} placeholder="Üye seçiniz..." className="h-9"/>
                    <Button size="sm" disabled={!selectedMember || loadingAction} onClick={() => executeAction("vmute", { userId: selectedMember, mute: false, deaf: false, reason: "Voice unmute" })} className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700">{loadingAction === "vmute" ? "Uygulanıyor..." : "VOICE UNMUTE"}</Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ================= ROL & NİCK YÖNETİMİ ================= */}
            <TabsContent value="roles">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* ROL VER */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><UserPlus className="h-4 w-4 text-emerald-400"/>Rol Ver</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <MemberSelect members={members} value={selectedMember} onChange={setSelectedMember} placeholder="Üye seçiniz..." className="h-9"/>
                    <RoleSelect roles={roles} value={selectedRole} onChange={setSelectedRole} placeholder="Rol seçiniz..." className="h-9"/>
                    <Button size="sm" disabled={!selectedMember || !selectedRole || loadingAction} onClick={() => executeAction("role-give", { userId: selectedMember, roleId: selectedRole })} className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-700">{loadingAction === "role-give" ? "Uygulanıyor..." : "ROL VER"}</Button>
                  </CardContent>
                </Card>
                {/* ROL AL */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><UserMinus className="h-4 w-4 text-rose-400"/>Rol Al</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <MemberSelect members={members} value={selectedMember} onChange={setSelectedMember} placeholder="Üye seçiniz..." className="h-9"/>
                    <RoleSelect roles={roles} value={selectedRole} onChange={setSelectedRole} placeholder="Rol seçiniz..." className="h-9"/>
                    <Button size="sm" disabled={!selectedMember || !selectedRole || loadingAction} onClick={() => executeAction("role-remove", { userId: selectedMember, roleId: selectedRole })} className="w-full h-8 text-xs bg-rose-600 hover:bg-rose-700">{loadingAction === "role-remove" ? "Uygulanıyor..." : "ROL AL"}</Button>
                  </CardContent>
                </Card>
                {/* NİCK DEĞİŞTİR */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Pencil className="h-4 w-4 text-sky-400"/>Nick Değiştir</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <MemberSelect members={members} value={selectedMember} onChange={setSelectedMember} placeholder="Üye seçiniz..." className="h-9"/>
                    <Input className="h-9 text-xs" value={nickChange} onChange={(e) => setNickChange(e.target.value.slice(0, 32))} placeholder="Yeni nick... (max 32 karakter)"/>
                    <Button size="sm" disabled={!selectedMember || !nickChange || loadingAction} onClick={() => executeAction("nick", { userId: selectedMember, nick: nickChange })} className="w-full h-8 text-xs bg-sky-600 hover:bg-sky-700">{loadingAction === "nick" ? "Uygulanıyor..." : "NİCK DEĞİŞTİR"}</Button>
                  </CardContent>
                </Card>
                {/* TOPLU ROL */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-violet-400"/>Toplu Rol Ver/Al</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <RoleSelect roles={roles} value={selectedRole} onChange={setSelectedRole} placeholder="Etkilenecek rolü seçiniz..." className="h-9"/>
                    <div><Label className="text-xs">Verilecek Rol ID (toplu verecekse)</Label><Input className="h-8 text-xs mt-1" value={giveRoleInput} onChange={(e) => setGiveRoleInput(e.target.value)} placeholder="rol-id"/></div>
                    <Button size="sm" disabled={!selectedRole || loadingAction} onClick={() => executeAction("mass-role", { roleId: selectedRole, giveRole: !!giveRoleInput })} className="w-full h-8 text-xs bg-violet-600 hover:bg-violet-700">{loadingAction === "mass-role" ? "Uygulanıyor..." : "TOPLU ROL"}</Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ================= KANAL İŞLEMLERİ ================= */}
            <TabsContent value="channels">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* KANAL OLUŞTUR */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Plus className="h-4 w-4 text-emerald-400"/>Kanal Oluştur</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <Input className="h-9 text-xs" value={createChanName} onChange={(e) => setCreateChanName(e.target.value)} placeholder="Kanal adı (dash-based)..."/>
                    <CustomSelect value={createChanType} onChange={setCreateChanType} options={[{ value: "0", label: "Metin (#)" }, { value: "2", label: "Ses ()" }]} className="h-9"/>
                    <ChannelSelect channels={categoryChannels} value={createChanParent} onChange={setCreateChanParent} placeholder="Kategori seç (opsiyonel)" type="category" className="h-9"/>
                    <Button size="sm" disabled={!createChanName || loadingAction} onClick={() => executeAction("create-channel", { name: createChanName, type: parseInt(createChanType), parentCategoryId: createChanParent })} className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-700">{loadingAction === "create-channel" ? "Oluşturuluyor..." : "KANAL OLUŞTUR"}</Button>
                  </CardContent>
                </Card>
                {/* KANAL SİL */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Trash2 className="h-4 w-4 text-red-400"/>Kanal Sil</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <ChannelSelect channels={[...textChannels, ...voiceChannels]} value={selectedChannel} onChange={setSelectedChannel} placeholder="Silinacak kanalı seçiniz..." className="h-9"/>
                    <Button size="sm" disabled={!selectedChannel || loadingAction} onClick={() => executeAction("delete-channel", { channelId: selectedChannel })} className="w-full h-8 text-xs bg-red-600 hover:bg-red-700">{loadingAction === "delete-channel" ? "Siliniyor..." : "KANAL SİL"}</Button>
                  </CardContent>
                </Card>
                {/* KİLİT / KİLİDİ AÇ */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Lock className="h-4 w-4 text-amber-400"/>Kanal Kilitle/Kilidi Aç</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <ChannelSelect channels={textChannels} value={lockdownChan} onChange={setLockdownChan} placeholder="Kilitlecek kanalı seç..." className="h-9"/>
                    <div className="flex items-center gap-3"><Switch checked={lockdownState} onCheckedChange={setLockdownState} /><Label className="text-xs">{lockdownState ? "🔒 Kilit (Send Messages DENY)" : "🔓 Kilidi Aç"}</Label></div>
                    <Button size="sm" disabled={!lockdownChan || loadingAction} onClick={() => executeAction("lockdown", { channelId: lockdownChan, locked: lockdownState })} className="w-full h-8 text-xs bg-amber-600 hover:bg-amber-700">{loadingAction === "lockdown" ? "Uygulanıyor..." : lockdownState ? "KİLİTLE" : "KİLİDİ AÇ"}</Button>
                  </CardContent>
                </Card>
                {/* SLOWMODE */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Timer className="h-4 w-4 text-cyan-400"/>Slowmode Ayarla</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <ChannelSelect channels={textChannels} value={selectedChannel} onChange={setSelectedChannel} placeholder="Slowmode ayarlanacak kanal..." className="h-9"/>
                    <Input type="number" className="h-9 text-xs" value={slowmodeRate} onChange={(e) => setSlowmodeRate(Number(e.target.value))} placeholder="Saniye cinsinden (0-21600)"/>
                    <Button size="sm" disabled={!selectedChannel || loadingAction} onClick={() => executeAction("slowmode", { channelId: selectedChannel, rateLimit: slowmodeRate })} className="w-full h-8 text-xs bg-cyan-600 hover:bg-cyan-700">{loadingAction === "slowmode" ? "Ayarlanıyor..." : "SLOWMODE AYARLA"}</Button>
                  </CardContent>
                </Card>
                {/* NUKE CHANNEL */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Bomb className="h-4 w-4 text-red-600"/>Nuke (Kanalları Yeniden Oluştur)</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <ChannelSelect channels={textChannels} value={selectedChannel} onChange={setSelectedChannel} placeholder="Nuke edilecek kanal..." className="h-9"/>
                    <Button size="sm" disabled={!selectedChannel || loadingAction} onClick={() => executeAction("nuke", { channelId: selectedChannel })} className="w-full h-8 text-xs bg-red-700 hover:bg-red-800">{loadingAction === "nuke" ? "Nuke ediliyor..." : "NUKE!"}</Button>
                  </CardContent>
                </Card>
                {/* LOCKDOWN ALL */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Lock className="h-4 w-4 text-red-600"/>Tüm Kanalları Kilde (Global Lock)</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <p className="text-[10px] text-muted-foreground mb-2">Bu işlem tüm metin kanallarında mesaj gönderimi engelleyecektir.</p>
                    <Button size="sm" disabled={loadingAction} onClick={() => executeAction("lockdown-all", {})} className="w-full h-8 text-xs bg-red-800 hover:bg-red-900">{loadingAction === "lockdown-all" ? "Kilitleniyor..." : " TÜMÜNÜ KİLİTLE"}</Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ================= MESAJ & BİLET İŞLEMLERİ ================= */}
            <TabsContent value="messages">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* CLEAR / PURGE */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Eraser className="h-4 w-4 text-gray-400"/>Mesajları Sil (Clear/Purge)</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <ChannelSelect channels={textChannels} value={selectedChannel} onChange={setSelectedChannel} placeholder="Mesajların silineceği kanal..." className="h-9"/>
                    <Input type="number" className="h-8 text-xs" value={clearCount} onChange={(e) => setClearCount(Math.min(Math.max(Number(e.target.value)||10,1),100))} placeholder="Silme sayısı (1-100)"/>
                    <Button size="sm" disabled={!selectedChannel || loadingAction} onClick={() => executeAction("clear", { channelId: selectedChannel, count: clearCount })} className="w-full h-8 text-xs bg-gray-600 hover:bg-gray-700">{loadingAction === "clear" ? "Siliniyor..." : `${clearCount} MEJAS SİL`}</Button>
                  </CardContent>
                </Card>
                {/* DUYURU */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Megaphone className="h-4 w-4 text-yellow-400"/>Duyuru Gönder</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <ChannelSelect channels={textChannels} value={selectedChannel} onChange={setSelectedChannel} placeholder="Duyurunun gönderileceği kanal..." className="h-9"/>
                    <Textarea className="h-16 text-xs" value={announcementText} onChange={(e) => setAnnouncementText(e.target.value.slice(0, 2000))} placeholder="Duyuru içeriğini yazın..."/>
                    <Button size="sm" disabled={!selectedChannel || !announcementText || loadingAction} onClick={() => executeAction("announcement", { channelId: selectedChannel, content: announcementText })} className="w-full h-8 text-xs bg-yellow-600 hover:bg-yellow-700">{loadingAction === "announcement" ? "Gönderiliyor..." : "DUYURU GÖNDER"}</Button>
                  </CardContent>
                </Card>
                {/* BİLET OLUŞTUR */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Ticket className="h-4 w-4 text-indigo-400"/>Manuel Bilet Oluştur</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <MemberSelect members={members} value={selectedMember} onChange={setSelectedMember} placeholder="Bilet sahibi üye..." className="h-9"/>
                    <Input className="h-8 text-xs" value={ticketSubject} onChange={(e) => setTicketSubject(e.target.value)} placeholder="Konu (opsiyonel)"/>
                    <ChannelSelect channels={categoryChannels} value="" onChange={() => {}} placeholder="Kategori (opsiyonel)" type="category" className="h-9"/>
                    <Button size="sm" disabled={!selectedMember || loadingAction} onClick={() => executeAction("ticket-create", { ownerId: selectedMember, subject: ticketSubject, category_id: null, support_roles: configs?.ticketSetup?.support_roles, log_channel_id: configs?.ticketSetup?.log_channel_id })} className="w-full h-8 text-xs bg-indigo-600 hover:bg-indigo-700">{loadingAction === "ticket-create" ? "Oluşturuluyor..." : "BİLET OLUŞTUR"}</Button>
                  </CardContent>
                </Card>
                {/* ANKET */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-teal-400"/>Anket Oluştur</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <ChannelSelect channels={textChannels} value={selectedChannel} onChange={setSelectedChannel} placeholder="Anketin gönderileceği kanal..." className="h-9"/>
                    <Input className="h-8 text-xs" value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="Anket sorusu..."/>
                    {pollOptions.map((opt, i) => (
                      <div key={i} className="flex gap-1.5"><Input className="h-8 text-xs flex-1" value={opt} onChange={(e) => { const n = [...pollOptions]; n[i] = e.target.value; setPollOptions(n); }} placeholder={`Seçenek ${i+1}`}/>{pollOptions.length > 2 && <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))}><Trash2 className="h-3.5 w-3.5"/>}</Button>}</div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => setPollOptions([...pollOptions, ""])} className="w-full h-7 text-xs">+ Seçenek Ekle</Button>
                    <Button size="sm" disabled={!selectedChannel || !pollQuestion || pollOptions.some(o => !o) || loadingAction} onClick={() => executeAction("poll", { channelId: selectedChannel, question: pollQuestion, options: pollOptions.filter(Boolean).slice(0, 8) })} className="w-full h-8 text-xs bg-teal-600 hover:bg-teal-700">{loadingAction === "poll" ? "Gönderiliyor..." : "ANKET OLUŞTUR"}</Button>
                  </CardContent>
                </Card>
                {/* YAPIŞKAN MESAJ */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Pin className="h-4 w-4 text-rose-400"/>Yapışkan Mesaj (Sticky)</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <ChannelSelect channels={textChannels} value={selectedChannel} onChange={setSelectedChannel} placeholder="Yapışkan mesajın gönderileceği kanal..." className="h-9"/>
                    <Textarea className="h-16 text-xs" value={announcementText} onChange={(e) => setAnnouncementText(e.target.value.slice(0, 2000))} placeholder="Yapışkan mesaj içeriği..."/>
                    <Button size="sm" disabled={!selectedChannel || !announcementText || loadingAction} onClick={() => executeAction("sticky", { channelId: selectedChannel, content: announcementText })} className="w-full h-8 text-xs bg-rose-600 hover:bg-rose-700">{loadingAction === "sticky" ? "Kaydediliyor..." : "YAPIŞKAN MESAJ"}</Button>
                  </CardContent>
                </Card>
                {/* REACTION ROLE PANEL */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Hand className="h-4 w-4 text-lime-400"/>Reaction-Role Paneli Oluştur</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <ChannelSelect channels={textChannels} value={selectedChannel} onChange={setSelectedChannel} placeholder="Panelin gönderileceği kanal..." className="h-9"/>
                    <Input className="h-8 text-xs" value={announcementText} onChange={(e) => setAnnouncementText(e.target.value.slice(0, 80))} placeholder="Panel başlığı / rol adı"/>
                    <RoleSelect roles={roles} value={selectedRole} onChange={setSelectedRole} placeholder="Verilecek rol..." className="h-9"/>
                    <Input className="h-8 text-xs" value="👍" readOnly placeholder="Emoji (varsayılan: 👍)"/>
                    <Button size="sm" disabled={!selectedChannel || !announcementText || !selectedRole || loadingAction} onClick={() => executeAction("reaction-role", { channelId: selectedChannel, title: announcementText, emoji: "👍", roleId: selectedRole })} className="w-full h-8 text-xs bg-lime-600 hover:bg-lime-700">{loadingAction === "reaction-role" ? "Oluşturuluyor..." : "REACTION-ROL PANELİ"}</Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ================= MÜZİK KONTROLLERİ ================= */}
            <TabsContent value="music">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* PLAY */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><PlayIcon className="h-4 w-4 text-emerald-400"/>Şarkı Çal</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <Input className="h-9 text-xs" value={musicQuery} onChange={(e) => setMusicQuery(e.target.value)} placeholder="YouTube/Spotify arama veya URL..."/>
                    <VoiceChannelSelect channels={voiceChannels} value="" onChange={() => {}} placeholder="Bağlanılacak ses kanalı (opsiyonel)" className="h-9"/>
                    <Button size="sm" disabled={!musicQuery || loadingAction} onClick={() => executeAction("music-play", { query: musicQuery, voiceChannelId: "" })} className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-700">{loadingAction === "music-play" ? "Ekleniyor..." : "ÇAL"}</Button>
                  </CardContent>
                </Card>
                {/* SKIP */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><SkipForward className="h-4 w-4 text-blue-400"/>Atla (Skip)</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0"><Button size="sm" disabled={loadingAction} onClick={() => executeAction("music-skip", {})} className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700">{loadingAction === "music-skip" ? "Atlanıyor..." : "SKIP"}</Button></CardContent>
                </Card>
                {/* PAUSE / RESUME */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><PauseIcon className="h-4 w-4 text-orange-400"/>Duraklat / Devam Et</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0"><div className="flex gap-2"><Button size="sm" disabled={loadingAction} onClick={() => executeAction("music-pause", {})} className="flex-1 h-8 text-xs bg-orange-600">{loadingAction === "music-pause" ? "Duraklatılıyor..." : "PAUSE"}</Button><Button size="sm" disabled={loadingAction} onClick={() => executeAction("music-resume", {})} className="flex-1 h-8 text-xs bg-green-600">{loadingAction === "music-resume" ? "Devam Ediliyor..." : "RESUME"}</Button></div></CardContent>
                </Card>
                {/* STOP */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><StopIcon className="h-4 w-4 text-red-400"/>Durdur & Kes</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0"><Button size="sm" disabled={loadingAction} onClick={() => executeAction("music-stop", {})} className="w-full h-8 text-xs bg-red-600">{loadingAction === "music-stop" ? "Durduruluyor..." : "STOP"}</Button></CardContent>
                </Card>
                {/* VOLUME */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Speaker className="h-4 w-4 text-cyan-400"/>Ses Seviyesi</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <Input type="range" min="0" max="100" value={musicVolume} onChange={(e) => setMusicVolume(Number(e.target.value))} className="accent-primary"/>
                    <div className="text-center text-xs text-muted-foreground">{musicVolume}%</div>
                    <Button size="sm" disabled={loadingAction} onClick={() => executeAction("music-volume", { volume: musicVolume })} className="w-full h-8 text-xs bg-cyan-600">{loadingAction === "music-volume" ? "Ayarlanıyor..." : "SES SEVİYESİ"}</Button>
                  </CardContent>
                </Card>
                {/* QUEUE */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><List className="h-4 w-4 text-purple-400"/>Karo Listesi (Queue)</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <Button size="sm" variant="outline" onClick={() => executeAction("music-queue", {}, "")} className="w-full h-8 text-xs">KARO LİSTESİNİ GETİR</Button>
                    {actionResult?.queue?.length > 0 && (
                      <div className="max-h-32 overflow-y-auto space-y-1 rounded-lg bg-background/40 p-2">
                        {actionResult.queue.slice(0, 10).map((q, i) => (
                          <div key={q.id} className="text-[10px] flex items-center gap-2"><span className="text-primary font-bold">{i+1}.</span><span className="truncate">{q.query}</span></div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                {/* LOOP & SHUFFLE */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><RepeatIcon className="h-4 w-4 text-teal-400"/>Loop & Shuffle</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => executeAction("music-loop", { mode: "song" })} className="flex-1 h-8 text-xs">SONG LOOP</Button><Button size="sm" variant="outline" onClick={() => executeAction("music-loop", { mode: "queue" })} className="flex-1 h-8 text-xs">QUEUE LOOP</Button><Button size="sm" variant="outline" onClick={() => executeAction("music-loop", { mode: "none" })} className="flex-1 h-8 text-xs">LOOP OFF</Button></div>
                    <Button size="sm" variant="outline" onClick={() => executeAction("music-shuffle", {})} className="w-full h-8 text-xs">SHUFFLE</Button>
                    <Button size="sm" variant="outline" onClick={() => executeAction("music-autoplay", { enabled: !(configs?.music?.autoplay_enabled) })} className="w-full h-8 text-xs">AUTOPLAY: {configs?.music?.autoplay_enabled ? "KAPALI -> AÇ" : "AÇIK -> KAPAT"}</Button>
                  </CardContent>
                </Card>
                {/* NOW PLAYING */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MusicIcon className="h-4 w-4 text-fuchsia-400"/>Şimdi Çalan</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <Button size="sm" variant="outline" onClick={() => executeAction("music-nowplaying", {}, "")} className="w-full h-8 text-xs">BİLGİ GETİR</Button>
                    {actionResult?.nowPlaying && (
                      <div className="rounded-lg bg-background/40 p-3 text-xs space-y-1"><div className="font-bold">{actionResult.nowPlaying.title}</div><div className="text-muted-foreground">{actionResult.nowPlaying.artist || ""}</div><div className="text-muted-foreground">Süre: {actionResult.nowPlaying.duration || "?"}</div></div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ================= OYUNLAR & EKONOMİ ================= */}
            <TabsContent value="games">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* ZAR ATMA */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Dice5 className="h-4 w-4 text-amber-400"/>Zar At</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <Input type="number" className="h-8 text-xs" value={diceSides} onChange={(e) => setDiceSides(Math.max(Math.min(Number(e.target.value), 100), 2))} placeholder="Yüzey sayısı (2-100)"/>
                    <Button size="sm" disabled={loadingAction} onClick={() => executeAction("dice", { sides: diceSides, count: 1, userId: "" })} className="w-full h-8 text-xs bg-amber-600">{loadingAction === "dice" ? "Atılıyor..." : "ZAR ATI"}</Button>
                    {actionResult?.results && (<div className="text-xs font-mono text-center bg-background/40 py-2 rounded-lg">{actionResult.results.join(", ")}</div>)}
                  </CardContent>
                </Card>
                {/* BOZA ATA / COIN FLIP */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Coins className="h-4 w-4 text-yellow-400"/>Boza Ata (Coin Flip)</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="flex gap-2">
                      <Button size="sm" variant={actionResult?.chosen === "heads" ? "default" : "outline"} onClick={() => { setActionResult({...actionResult, chosen: "heads"}); }} className="flex-1 h-8 text-xs">Heads</Button>
                      <Button size="sm" variant={actionResult?.chosen === "tails" ? "default" : "outline"} onClick={() => { setActionResult({...actionResult, chosen: "tails"}); }} className="flex-1 h-8 text-xs">Tails</Button>
                    </div>
                    <Button size="sm" disabled={loadingAction} onClick={() => executeAction("coinflip", { choice: (actionResult?.chosen || "heads").toLowerCase() })} className="w-full h-8 text-xs bg-yellow-600">{loadingAction === "coinflip" ? "Atılıyor..." : "ATA"}</Button>
                    {actionResult?.result && (<div className="text-xs font-bold text-center bg-background/40 py-2 rounded-lg">{actionResult.result}</div>)}
                  </CardContent>
                </Card>
                {/* SAYI TAHMİN */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-violet-400"/>Sayı Tahmin</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <Input type="number" className="h-8 text-xs" value={guessMax} onChange={(e) => setGuessMax(Number(e.target.value))} placeholder="Max sayı"/>
                    <Input className="h-8 text-xs" value={guessNum} onChange={(e) => setGuessNum(e.target.value)} placeholder="Tahmin ettiğiniz sayı"/>
                    <Button size="sm" disabled={!guessNum || loadingAction} onClick={() => executeAction("guess-number", { guess: Number(guessNum), maxNum: guessMax })} className="w-full h-8 text-xs bg-violet-600">{loadingAction === "guess-number" ? "Tahmin Ediliyor..." : "TAHMİN ET"}</Button>
                    {actionResult?.hint && (<div className="text-xs text-center bg-background/40 py-2 rounded-lg">{actionResult.hint}</div>)}
                  </CardContent>
                </Card>
                {/* BLACKJACK */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><PartyPopper className="h-4 w-4 text-pink-400"/>Blackjack</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <Input type="number" className="h-8 text-xs" value={betAmount} onChange={(e) => setBetAmount(Number(e.target.value))} placeholder="Bahis miktarı"/>
                    <Button size="sm" disabled={loadingAction} onClick={() => executeAction("blackjack", { userId: "", betAmount: betAmount })} className="w-full h-8 text-xs bg-pink-600">{loadingAction === "blackjack" ? "Oynanıyor..." : "BLACKJACK OYNA"}</Button>
                    {actionResult?.won !== undefined && (<div className="text-xs text-center bg-background/40 py-2 rounded-lg">{actionResult.won ? `Kazandınız! Payout: ${actionResult.payout}` : `Kaybettiniz.`}</div>)}
                  </CardContent>
                </Card>
                {/* SLOTS */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><SlotMachine className="h-4 w-4 text-purple-400"/>Slots Makinesi</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <Input type="number" className="h-8 text-xs" value={betAmount} onChange={(e) => setBetAmount(Number(e.target.value))} placeholder="Bahis miktarı"/>
                    <Button size="sm" disabled={loadingAction} onClick={() => executeAction("slots", { betAmount: betAmount })} className="w-full h-8 text-xs bg-purple-600">{loadingAction === "slots" ? "Dönüyor..." : "SLOTS OYNA"}</Button>
                    {actionResult?.reels && (<div className="text-2xl text-center bg-background/40 py-2 rounded-letter-spacing tracking-widest">{actionResult.reels.join(" | ")}</div>)}
                  </CardContent>
                </Card>
                {/* ROULETTE */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wheel className="h-4 w-4 text-red-400"/>Rulet</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <Input type="number" className="h-8 text-xs" value={betAmount} onChange={(e) => setBetAmount(Number(e.target.value))} placeholder="Bahis miktarı"/>
                    <div className="flex gap-1"><Button size="sm" variant="outline" className="h-7 flex-1 text-xs bg-red-600 text-white">Red</Button><Button size="sm" variant="outline" className="h-7 flex-1 text-xs bg-black text-white border-gray-500">Black</Button><Button size="sm" variant="outline" className="h-7 flex-1 text-xs bg-green-600 text-white">Even/Odd</Button></div>
                    <Button size="sm" disabled={loadingAction} onClick={() => executeAction("roulette", { userId: "", betAmount: betAmount, betType: "red", betNumber: "" })} className="w-full h-8 text-xs bg-red-700">{loadingAction === "roulette" ? "Dönüyor..." : "RULET OYNA"}</Button>
                  </CardContent>
                </Card>
                {/* DUEELLO */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Swords className="h-4 w-4 text-orange-400"/>Duello</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <MemberSelect members={members} value={selectedMember} onChange={setSelectedMember} placeholder="Challenge eden üye..." className="h-9"/>
                    <Input className="h-8 text-xs" value="" onChange={() => {}} placeholder="Challenge edilen üye ID"/>
                    <Button size="sm" disabled={loadingAction || !selectedMember} onClick={() => executeAction("duello", { challengerId: selectedMember, defenderId: "", wager: betAmount })} className="w-full h-8 text-xs bg-orange-600">{loadingAction === "duello" ? "Dövülüyor..." : "DUEOLO"}</Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ================= BİLGİ & ARAÇLAR ================= */}
            <TabsContent value="info">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* KULLANICI BİLGİSİ */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><UserSearch className="h-4 w-4 text-indigo-400"/>Kullanıcı Bilgisi</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <MemberSelect members={members} value={selectedMember} onChange={setSelectedMember} placeholder="Bilgisi alınacak üye..." className="h-9"/>
                    <Button size="sm" disabled={!selectedMember || loadingAction} onClick={() => fetchUserInfo(selectedMember)} className="w-full h-8 text-xs bg-indigo-600">{loadingAction === `user-info-${selectedMember}` ? "Getiriliyor..." : "BİLGİ GETİR"}</Button>
                    {actionResult?.type === "userInfo" && (
                      <div className="rounded-lg bg-background/40 p-3 text-xs space-y-1">
                        <div className="flex items-center gap-2"><img src={actionResult.avatar_url} alt="" className="w-8 h-8 rounded-full"/><div><div className="font-bold">{actionResult.global_name || actionResult.username}#{actionResult.discriminator}</div><div className="text-muted-foreground font-mono text-[10px]">ID: {actionResult.id}</div></div></div>
                        <div className="text-muted-foreground">Bot: {actionResult.bot ? "Evet" : "Hayır"} | Oluşturma: {new Date(actionResult.created_at).toLocaleDateString("tr-TR")}</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                {/* SUNUCU BİLGİSİ */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Server className="h-4 w-4 text-emerald-400"/>Sunucu Bilgisi</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <Button size="sm" disabled={loadingAction} onClick={() => fetchServerInfo()} className="w-full h-8 text-xs bg-emerald-600">{loadingAction === "server-info" ? "Getiriliyor..." : "SUNUCU BİLGİLERİ"}</Button>
                    {actionResult?.type === "serverInfo" && (
                      <div className="rounded-lg bg-background/40 p-3 text-xs space-y-1">
                        <div className="font-bold">{actionResult.name}</div>
                        <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                          <span>Üye: {actionResult.member_count_exact}</span><span>Online: {actionResult.presence_count}</span>
                          <span>Boost: Tier {actionResult.boost_tier}</span><span>Kanallar: {actionResult.total_channels}</span>
                          <span>Doğrulama: {["","Yok","Düşük","Orta","Yüksek","Çok Yüksek"][actionResult.verification_level]}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                {/* AVATAR */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Eye className="h-4 w-4 text-cyan-400"/>Avatar Görüntüle</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <MemberSelect members={members} value={selectedMember} onChange={setSelectedMember} placeholder="Avatar'ı görüntülenecek üye..." className="h-9"/>
                    <Button size="sm" disabled={!selectedMember || loadingAction} onClick={() => executeAction("avatar", { userId: selectedMember }, "")} className="w-full h-8 text-xs bg-cyan-600">{loadingAction === `avatar-${selectedMember}` ? "Getiriliyor..." : "AVATAR GETİR"}</Button>
                  </CardContent>
                </Card>
                {/* DAĞET */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Link2 className="h-4 w-4 text-pink-400"/>Davetler</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <Button size="sm" disabled={loadingAction} onClick={() => executeAction("server-invites", {}, "")} className="w-full h-8 text-xs bg-pink-600">{loadingAction === "server-invites" ? "Getiriliyor..." : "DAVET BİLGİLERİ"}</Button>
                  </CardContent>
                </Card>
                {/* AFK AYARLA */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Zzz className="h-4 w-4 text-slate-400"/>AFK Durumu</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <MemberSelect members={members} value={selectedMember} onChange={setSelectedMember} placeholder="AFK olacak üye..." className="h-9"/>
                    <Input className="h-8 text-xs" value={warnReason} onChange={(e) => setWarnReason(e.target.value)} placeholder="AFK nedeni"/>
                    <Button size="sm" disabled={!selectedMember || loadingAction} onClick={() => executeAction("afk-set", { userId: selectedMember, reason: warnReason, durationMinutes: 0 })} className="w-full h-8 text-xs bg-slate-600">{loadingAction === "afk-set" ? "Ayarlanıyor..." : "AFK KUR"}</Button>
                  </CardContent>
                </Card>
                {/* CACHE TEMİZLE */}
                <Card className="border-border/60 bg-card/40 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><RefreshCw className="h-4 w-4 text-gray-400"/>Cache Temizle</CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <Button size="sm" variant="outline" onClick={() => executeAction("reset-cache", {}, "Cache temizlendi.")} className="w-full h-8 text-xs">CACHE TEMİZLE</Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>
    </>
  );
}
