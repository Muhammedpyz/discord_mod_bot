import { Link, NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Menu, 
  X, 
  LogIn, 
  LogOut, 
  LayoutDashboard, 
  ChevronRight, 
  ArrowLeft, 
  Shield, 
  ExternalLink 
} from "lucide-react";
import { useState, useEffect } from "react";
import { siteConfig } from "@/config/site";
import { ThemeToggle } from "./ThemeToggle";
import { InviteModal } from "./InviteModal";
import { Button } from "./ui/button";
import { useAuth } from "@/context/AuthContext";

export const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [botAvatar, setBotAvatar] = useState<string>("/favicon.png");
  const location = useLocation();
  const { user, login, logout } = useAuth();
  const isDashboard = location.pathname.startsWith("/dashboard");

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data?.bot?.avatar) setBotAvatar(data.bot.avatar);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <InviteModal open={inviteOpen} onOpenChange={setInviteOpen} />
      <motion.header
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="fixed top-4 left-0 right-0 z-50 px-3 sm:px-4"
      >
        <div className={`mx-auto ${isDashboard ? "max-w-7xl" : "max-w-6xl"}`}>
          <nav className="liquid-glass rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between border border-border/60 shadow-xl backdrop-blur-xl">
            {/* Left Section */}
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              <Link to={isDashboard ? "/dashboard" : "/"} className="flex items-center gap-2 group">
                <div className="relative h-8 w-8 sm:h-9 sm:w-9">
                  <img
                    src={botAvatar}
                    alt={siteConfig.bot.name}
                    className="h-full w-full object-contain rounded-full group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-primary/40 blur-xl -z-10 group-hover:bg-primary/60 transition-colors" />
                </div>
                <span className="font-display font-bold text-base sm:text-lg tracking-tight">
                  {siteConfig.bot.name}
                </span>
              </Link>

              {/* Dashboard Specific Breadcrumb / Badge */}
              {isDashboard && (
                <>
                  <div className="h-4 w-[1px] bg-border/70 hidden sm:block" />
                  <div className="flex items-center gap-1.5 text-xs">
                    {location.pathname === "/dashboard" ? (
                      <span className="hidden sm:inline-flex items-center gap-1.5 font-medium text-foreground bg-primary/10 border border-primary/25 px-2.5 py-1 rounded-lg">
                        <LayoutDashboard className="h-3.5 w-3.5 text-primary" />
                        <span>Sunucu Listesi</span>
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Link
                          to="/dashboard"
                          className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-card/60 text-xs font-medium"
                        >
                          <LayoutDashboard className="h-3.5 w-3.5 text-primary" />
                          <span className="hidden sm:inline">Sunucular</span>
                        </Link>
                        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                        <span className="font-semibold text-primary flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 border border-primary/20">
                          <Shield className="h-3.5 w-3.5" />
                          <span className="truncate max-w-[110px] sm:max-w-[180px]">Yönetim</span>
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Center Section: Links */}
            {isDashboard ? (
              <div className="hidden lg:flex items-center gap-1">
                <NavLink
                  to="/"
                  className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-card/60 rounded-full transition-colors"
                >
                  Ana Sayfa
                </NavLink>
                <NavLink
                  to="/commands"
                  className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-card/60 rounded-full transition-colors"
                >
                  Komutlar
                </NavLink>
                <NavLink
                  to="/docs"
                  className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-card/60 rounded-full transition-colors"
                >
                  Rehber
                </NavLink>
                <a
                  href={siteConfig.bot.supportUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-card/60 rounded-full transition-colors flex items-center gap-1"
                >
                  Destek
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-1">
                {siteConfig.nav.map((item) => (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    className={({ isActive }) =>
                      `relative px-3.5 py-1.5 text-xs lg:text-sm font-medium rounded-full transition-colors ${
                        isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <motion.span
                            layoutId="nav-pill"
                            className="absolute inset-0 rounded-full bg-primary/15 border border-primary/30"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                        <span className="relative">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            )}

            {/* Right Section */}
            <div className="flex items-center gap-2 shrink-0">
              <ThemeToggle />

              {isDashboard ? (
                /* In Dashboard: Clean User Profile + Logout */
                user ? (
                  <div className="flex items-center gap-2 bg-card/60 border border-border/70 rounded-xl p-1 pl-2">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.username}
                        className="h-6 w-6 rounded-full object-cover border border-primary/50 shrink-0"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-primary/30 text-[10px] font-bold grid place-items-center text-primary shrink-0">
                        {user.username.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs font-medium text-foreground max-w-[90px] sm:max-w-[130px] truncate hidden sm:inline">
                      {user.globalName || user.username}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={logout}
                      title="Çıkış Yap"
                      className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={login}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-border/80 hover:border-primary/50 text-foreground px-3 rounded-xl"
                  >
                    <LogIn className="h-3.5 w-3.5 mr-1.5 text-primary" />
                    Giriş
                  </Button>
                )
              ) : (
                /* In Public Landing Pages: Panel Button or Login + Sunucuna Ekle */
                <>
                  {user ? (
                    <Link to="/dashboard">
                      <Button
                        variant="outline"
                        size="sm"
                        className="hidden sm:inline-flex items-center gap-2 text-xs border-primary/40 bg-primary/10 hover:bg-primary/20 text-foreground px-3 h-9 rounded-xl transition-all"
                      >
                        {user.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user.username}
                            className="h-5 w-5 rounded-full object-cover border border-primary/60"
                          />
                        ) : (
                          <div className="h-5 w-5 rounded-full bg-primary/30 text-[10px] font-bold grid place-items-center text-primary">
                            {user.username.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span className="max-w-[100px] truncate font-medium">
                          {user.globalName || user.username}
                        </span>
                        <span className="text-[10px] font-semibold text-primary bg-primary/20 px-1.5 py-0.5 rounded-md">
                          Panel
                        </span>
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      onClick={login}
                      variant="outline"
                      size="sm"
                      className="hidden sm:inline-flex items-center gap-1.5 text-xs border-border/80 hover:border-primary/40 text-foreground px-3.5 h-9 rounded-xl"
                    >
                      <LogIn className="h-3.5 w-3.5 text-primary" />
                      Giriş Yap
                    </Button>
                  )}

                  <Button
                    onClick={() => setInviteOpen(true)}
                    variant="hero"
                    size="sm"
                    className="hidden sm:inline-flex text-xs px-4 h-9 rounded-xl font-semibold shadow-md shadow-primary/20"
                  >
                    Sunucuna Ekle
                  </Button>
                </>
              )}

              {/* Mobile Hamburger Button */}
              <button
                onClick={() => setOpen(!open)}
                className="md:hidden liquid-glass h-9 w-9 rounded-xl grid place-items-center text-foreground"
                aria-label="Menu"
              >
                {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          </nav>

          {/* Mobile Drawer */}
          {open && (
            <>
              <div
                className="fixed inset-0 bg-background/70 backdrop-blur-sm -z-10 md:hidden"
                onClick={() => setOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="md:hidden mt-2 liquid-glass rounded-2xl p-3 flex flex-col gap-1 shadow-2xl border border-border/60"
              >
                {isDashboard ? (
                  <>
                    <Link
                      to="/dashboard"
                      onClick={() => setOpen(false)}
                      className="px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 bg-primary/10 text-primary border border-primary/20"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Sunucu Listesi
                    </Link>
                    <Link
                      to="/"
                      onClick={() => setOpen(false)}
                      className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:bg-muted/50"
                    >
                      Ana Sayfa
                    </Link>
                    <Link
                      to="/commands"
                      onClick={() => setOpen(false)}
                      className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:bg-muted/50"
                    >
                      Komutlar
                    </Link>
                    <Link
                      to="/docs"
                      onClick={() => setOpen(false)}
                      className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:bg-muted/50"
                    >
                      Rehber
                    </Link>
                    <a
                      href={siteConfig.bot.supportUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setOpen(false)}
                      className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:bg-muted/50 flex items-center gap-1.5"
                    >
                      Destek Sunucusu
                      <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                    </a>
                    {user && (
                      <button
                        onClick={() => {
                          setOpen(false);
                          logout();
                        }}
                        className="px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 text-destructive hover:bg-destructive/10 mt-1 border border-destructive/20"
                      >
                        <LogOut className="h-4 w-4" />
                        Çıkış Yap ({user.username})
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {siteConfig.nav.map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        onClick={() => setOpen(false)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                          location.pathname === item.href
                            ? "bg-primary/15 text-foreground font-semibold"
                            : "text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}

                    <Link
                      to="/dashboard"
                      onClick={() => setOpen(false)}
                      className="px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 mt-1"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      {user ? `Yönetim Paneli (${user.username})` : "Yönetim Paneline Giriş"}
                    </Link>

                    <Button
                      onClick={() => {
                        setOpen(false);
                        setInviteOpen(true);
                      }}
                      variant="hero"
                      size="sm"
                      className="mt-2 py-5"
                    >
                      Sunucuna Ekle
                    </Button>
                  </>
                )}
              </motion.div>
            </>
          )}
        </div>
      </motion.header>
    </>
  );
};
