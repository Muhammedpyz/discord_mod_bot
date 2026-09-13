import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { siteConfig } from "@/config/site";
import { Hero } from "@/components/sections/Hero";
import DashboardHub from "@/pages/DashboardHub";
import { normalizeGuildList } from "@/lib/guildState";

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "1",
      username: "tester",
      globalName: "Tester User",
      avatar: "https://example.com/avatar.png",
      guilds: [
        { id: "a", name: "Alpha", owner: true, permissions: "8", canManage: true, botJoined: true, inviteUrl: "https://example.com/a" },
        { id: "b", name: "Beta", owner: false, permissions: "8", canManage: false, botJoined: false, inviteUrl: "https://example.com/b" },
      ],
    },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe("Nyx branding and dashboard", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({
        bot: {
          username: "Nyx",
          tag: "Nyx#0001",
          avatar: "https://example.com/logo.png",
          banner: "https://example.com/banner.png",
          bio: "Nyx bot description",
          inviteUrl: "https://discord.com/oauth2/authorize?client_id=123"
        },
        stats: { servers: 4, users: 150, ping: 42 },
      }),
    }));
  });

  it("uses the Nyx domain and branded support contact", () => {
    expect(siteConfig.bot.name).toBe("Nyx");
    expect(siteConfig.contact.email).toBe("destek@nyx.bot");
    expect(JSON.stringify(siteConfig)).not.toContain("turklionbot.com");
    expect(JSON.stringify(siteConfig)).not.toContain("mc.turklion.net");
  });

  it("renders dynamic hero branding and bot banner fallback data", async () => {
    render(<Hero />);

    expect(await screen.findByRole("img", { name: "Nyx" })).toBeInTheDocument();
    expect(screen.getAllByText(/Sunucular/i).length).toBeGreaterThan(0);
  });

  it("recalculates each guild's own manage and join state instead of carrying stale shared values", () => {
    const guilds = [
      { id: "alpha", name: "Alpha", owner: false, permissions: "0", canManage: true, botJoined: false, inviteUrl: "https://example.com/a" },
      { id: "beta", name: "Beta", owner: false, permissions: "8", canManage: false, botJoined: false, inviteUrl: "https://example.com/b" },
      { id: "gamma", name: "Gamma", owner: true, permissions: "0", canManage: false, botJoined: true, inviteUrl: "https://example.com/c" },
    ];

    const normalized = normalizeGuildList(guilds);

    expect(normalized[0].canManage).toBe(false);
    expect(normalized[1].canManage).toBe(true);
    expect(normalized[2].botJoined).toBe(true);
    expect(normalized[2].canManage).toBe(true);
  });

  it("renders dashboard summary cards for joined and missing guilds", () => {
    render(
      <MemoryRouter>
        <DashboardHub />
      </MemoryRouter>
    );

    expect(screen.getByText(/Yönetilebilir Sunucular/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Bot Sunucuda Aktif/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
  });
});
