import { Link } from "react-router-dom";
import { siteConfig } from "@/config/site";
import { useState, useEffect } from "react";

export const Footer = () => {
  const [botAvatar, setBotAvatar] = useState<string>("/favicon.png");

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data?.bot?.avatar) setBotAvatar(data.bot.avatar);
      })
      .catch(() => {});
  }, []);

  return (
    <footer className="relative w-full mt-24 overflow-hidden border-t border-border/30 bg-gradient-to-b from-card/10 via-card/30 to-background/80">
      {/* Soft Gradient Accent Line on Top (Yokluktan gelen soft gecis) */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className="container max-w-6xl py-12 md:py-16 px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-2.5 group w-fit">
              <img src={botAvatar} alt={siteConfig.bot.name} className="h-10 w-10 rounded-full object-cover transition-transform group-hover:scale-105" />
              <span className="font-display font-bold text-xl text-foreground">{siteConfig.bot.name}</span>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground max-w-sm leading-relaxed">
              {siteConfig.bot.description}
            </p>
            <div className="flex gap-2.5 pt-2">
              {siteConfig.socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="h-9 w-9 rounded-full bg-card/60 border border-border/50 grid place-items-center hover:scale-110 hover:border-primary/40 hover:text-primary transition-all text-muted-foreground"
                >
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-display font-semibold mb-4 text-foreground text-sm uppercase tracking-wider">Navigasyon</h4>
            <ul className="space-y-2.5">
              {siteConfig.nav.map((n) => (
                <li key={n.href}>
                  <Link to={n.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {n.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Gizlilik & Şartlar
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-semibold mb-4 text-foreground text-sm uppercase tracking-wider">Bağlantılar</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href={siteConfig.bot.inviteUrl} className="text-muted-foreground hover:text-foreground transition-colors">
                  Sunucuna Ekle
                </a>
              </li>
              <li>
                <a href={siteConfig.contact.discord} className="text-muted-foreground hover:text-foreground transition-colors">
                  Destek Sunucusu
                </a>
              </li>
              <li>
                <a href={`mailto:${siteConfig.contact.email}`} className="text-muted-foreground hover:text-foreground transition-colors">
                  İletişim
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border/30 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-muted-foreground">
          <p>
            © {new Date().getFullYear()} {siteConfig.bot.name}. Tüm hakları saklıdır.
          </p>
          <p>
            {siteConfig.bot.version} · {siteConfig.bot.uptime} uptime
          </p>
        </div>
      </div>
    </footer>
  );
};
