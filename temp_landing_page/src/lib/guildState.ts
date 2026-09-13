import type { GuildItem } from "@/context/AuthContext";

export function normalizeGuildState(guild: Partial<GuildItem>): GuildItem {
  const rawPermissions = guild.permissions ?? "0";
  const permissionBits = typeof rawPermissions === "string" ? BigInt(rawPermissions) : BigInt(Number(rawPermissions) || 0);
  const isAdmin = (permissionBits & 0x8n) === 0x8n;
  const isManager = (permissionBits & 0x20n) === 0x20n;

  return {
    id: String(guild.id ?? ""),
    name: guild.name || "Sunucu",
    icon: guild.icon ?? null,
    owner: Boolean(guild.owner),
    permissions: String(rawPermissions),
    canManage: Boolean(guild.owner || isAdmin || isManager),
    botJoined: Boolean(guild.botJoined),
    inviteUrl: guild.inviteUrl || "https://discord.com/invite",
  };
}

export function normalizeGuildList(guilds: Array<Partial<GuildItem>> = []): GuildItem[] {
  return guilds.map((guild) => normalizeGuildState(guild));
}
