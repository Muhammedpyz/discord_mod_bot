import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Shield, Settings, BookOpen, Layers, Lock, Music, Radio, Ticket, Gift, Award, Zap, HeartHandshake, Search, Sparkles, Coins, Heart, Gamepad2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { siteConfig } from "@/config/site";
import { SplitTextReveal } from "@/components/reactbits/SplitTextReveal";

const Docs = () => {
  const [search, setSearch] = useState("");

  useEffect(() => {
    document.title = `Kullanım Rehberi — ${siteConfig.bot.name}`;
  }, []);

  const guideModules = [
    {
      title: "Gelişmiş Moderasyon & Rol Hafızası (Role Memory)",
      icon: Shield,
      cmd: "/mute, /vmute, /ban, /warn",
      desc: "Üyelere uygulanan metin ve ses susturmaları otomatik takip edilir. Üye ceza aldığında üzerindeki VIP ve özel roller hafızaya alınır, ceza bitiminde roller eksiksiz iade edilir."
    },
    {
      title: "14 Kategorili Sunucu Loglama Sistemi",
      icon: Settings,
      cmd: "/log",
      desc: "Sunucudaki 51 farklı olayı (Rol değişimleri, ses kanalları hareketleri, silinen/düzenlenen mesajlar, ban ve ceza kayıtları) dilediğiniz kanallara kategorize ederek canlı olarak kaydedin."
    },
    {
      title: "Geçici Özel Ses & Metin Odaları",
      icon: Radio,
      cmd: "/ozel-oda & /odapanel",
      desc: "Kullanıcılar belirlediğiniz odaya girdiğinde otomatik olarak kendi kişisel oda ve metin kanalına sahip olur. Odaya giren kişi `/odapanel` yazarak kişi limiti, isim ve oda kilidi ayarlayabilir."
    },
    {
      title: "Destek Bilet (Ticket) Sistemi",
      icon: Ticket,
      cmd: "/ticket",
      desc: "Sunucu üyeleriniz için kategorilere ayrılmış butonlu destek bilet paneli oluşturun. Bilet kapatıldığında tüm sohbet dökümü HTML transcript formatında log kanalına iletilir."
    },
    {
      title: "Yüksek Kaliteli Müzik & Ses Efektleri",
      icon: Music,
      cmd: "/play, /filter, /247, /queue",
      desc: "Spotify, YouTube ve SoundCloud üzerinden kesintisiz müzik çalın. `/filter` ile Bassboost, 8D, Nightcore ses efektleri uygulayın ve botun 7/24 ses kanalında kalmasını sağlayın."
    },
    {
      title: "Çekiliş & Otomatik Rol Sistemleri",
      icon: Gift,
      cmd: "/giveaway, /otorol, /vanity",
      desc: "Sunucunuzda süre ve kazanana göre otomatik çekilişler düzenleyin. Sunucuya yeni katılan üyelere otomatik rol verin ve durumuna sunucu davet linki ekleyenlere özel ayrıcalık tanımlayın."
    },
    {
      title: "Seviye (XP), İtibar & Minecraft Araçları",
      icon: Award,
      cmd: "/rank, /top, /itibar, /mc",
      desc: "Üyelerinizin sohbet ve ses aktifliğine göre seviye atlamasını sağlayın. Liderlik tablosunu inceleyin, üyeler arası güven puanı verin ve Minecraft oyuncularının 3D skin modelini görüntüleyin."
    },
    {
      title: "AutoMod & Raid Koruma Merkezi",
      icon: Lock,
      cmd: "/automod, /lockdown, /backup",
      desc: "Küfür, reklam, spam ve capslock ihlallerini anlık tespit edip otomatik engelleyin. Acil durumlarda `/lockdown` ile kanalları kilitleyin ve `/backup` ile sunucu ayarlarınızı yedekleyin."
    },
    {
      title: "Kayıt, Doğrulama & Üye Sayaç",
      icon: HeartHandshake,
      cmd: "/kayıt-ayar, /doğrulama, /sayaç",
      desc: "Kayıtsız/erkek/kız rolleri, matematik doğrulama paneli ve ses kanalı üye sayacı. Tümünü web panelindeki Ekstra Sistemler sekmesinden de yönetebilirsiniz."
    },
    {
      title: "Starboard, Doğum Günü & Buton Rol",
      icon: Zap,
      cmd: "/starboard, /dogumgunu, /buton-rol",
      desc: "Yıldız panosu, otomatik doğum günü kutlaması ve butonla rol alma panelleri. Dashboard üzerinden kanal/rol seçip kaydedebilir, panelleri Discord’a yayınlayabilirsiniz."
    },
    {
      title: "Ekonomi Marketi & Yapışkan Mesaj",
      icon: Layers,
      cmd: "/ekonomi, /market-yonet, /yapiskan",
      desc: "Sunucu marketine rol ürünü ekleyin; seçtiğiniz kanala yapışkan duyuru mesajı tanımlayın. Günlük jeton ödülü global streak sistemine bağlıdır."
    },
    {
      title: "Prefix, Autobump & Medya Kanalları",
      icon: Settings,
      cmd: "/prefix, medya kanalları, autobump",
      desc: "Mesaj komut prefix’ini değiştirin, bump hatırlatmalarını ayarlayın ve yalnızca medya kabul eden kanallar tanımlayın. Hepsi web panelinden yönetilir."
    },
    {
      title: "Seviye Ödülleri, Warn Oto-Ceza & Anket",
      icon: BookOpen,
      cmd: "/level, /warn, /anket",
      desc: "Seviye atlayınca rol verin, X. uyarıda otomatik mute/kick/ban tanımlayın ve Discord’a canlı anket yayınlayın. Sosyal medya (YouTube/Twitch/Kick) bildirim aboneliklerini de panelden ekleyebilirsiniz."
    },
    {
      title: "Eğlence & Mini Oyunlar",
      icon: Sparkles,
      cmd: "/kelime-oyunu, /adam-asmaca, /düello, /xox, /sayı-tahmin, /espri",
      desc: "Üyelerin sunucuda vakit geçirebileceği sıra tabanlı düellolar, ödüllü kelime oyunları, adam asmaca ve XOX gibi interaktif oyunlar."
    },
    {
      title: "Casino & Şans Oyunları",
      icon: Coins,
      cmd: "/rulet, /crash, /blackjack, /slots, /balık-tut, /çalış, /suç-işle",
      desc: "Global ekonomi bakiyenizle krupiyeye karşı blackjack, slot makineleri, rulet ve crash oynayın; balık tutup çalışarak jeton kazanın."
    },
    {
      title: "Sosyal, Evlilik & Aile Ağacı",
      icon: Heart,
      cmd: "/evlen, /boşan, /ailem, /evlat-edin, /profil, /hakkımda, /notlarım",
      desc: "Sunucudaki üyelerle evlenin, evlat edinin ve aile ağacınızı görüntüleyin. Kişisel rozetler, not defteri ve biyografi kartınızı özelleştirin."
    },
    {
      title: "Oyun Entegrasyonları & Günlük Araçlar",
      icon: Gamepad2,
      cmd: "/mc, /mc-sunucu, /steam, /roblox, /hava-durumu, /döviz, /kripto",
      desc: "Minecraft 3D oyuncu modeli ve sunucu durumu sorgulama, Steam ve Roblox profil bilgileri ile canlı döviz, kripto ve hava durumu araçları."
    }
  ];

  const filteredModules = guideModules.filter(
    (m) =>
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.desc.toLowerCase().includes(search.toLowerCase()) ||
      m.cmd.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="container max-w-5xl pt-6 pb-20">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-2xl mx-auto">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">Kullanım Rehberi</span>
        <SplitTextReveal
          as="h1"
          text="Detaylı Kullanım Kılavuzu"
          className="mt-3 font-display font-bold text-4xl md:text-5xl tracking-tight text-gradient bg-aurora bg-clip-text"
        />
        <p className="mt-4 text-muted-foreground leading-relaxed">
          Sunucunuzda bot özelliklerinden maksimum verim alabilmeniz için sistemlerin ve komutların detaylı kullanım rehberi.
        </p>

        {/* Quick Search */}
        <div className="mt-8 max-w-md mx-auto relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Modül veya komut ara (örn. rol, oda, bilet)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="liquid-glass border-0 pl-11 h-12 rounded-2xl text-sm"
          />
        </div>
      </motion.div>

      {/* Guide Modules List */}
      <div className="mt-14 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-2xl flex items-center gap-2 text-foreground text-left">
            <Layers className="h-6 w-6 text-primary" /> Modüller ve Özellik Kullanımı
          </h2>
          <span className="text-xs text-muted-foreground font-mono">
            {filteredModules.length} modül listelendi
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-5 text-left">
          {filteredModules.map((mod, idx) => {
            const Icon = mod.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                className="liquid-glass rounded-3xl p-6 hover:scale-[1.01] transition-transform border border-primary/20 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="h-11 w-11 rounded-xl bg-aurora grid place-items-center text-primary-foreground shadow-[var(--shadow-glow)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/30">
                      {mod.cmd}
                    </span>
                  </div>

                  <h3 className="font-display font-bold text-lg mb-2 text-foreground">{mod.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{mod.desc}</p>
                </div>
              </motion.div>
            );
          })}
          {filteredModules.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground py-12 liquid-glass rounded-3xl">
              Aramanızla eşleşen rehber konusu veya komut bulunamadı.
            </div>
          )}
        </div>
      </div>

      {/* Tip Banner */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mt-16 liquid-glass rounded-3xl p-8 border border-primary/30 flex items-center gap-4 text-left flex-wrap md:flex-nowrap"
      >
        <div className="h-12 w-12 rounded-2xl bg-aurora grid place-items-center text-primary-foreground flex-shrink-0 shadow-[var(--shadow-glow)]">
          <HeartHandshake className="h-6 w-6" />
        </div>
        <div>
          <h4 className="font-display font-bold text-lg text-foreground">Yardıma mı ihtiyacınız var?</h4>
          <p className="text-sm text-muted-foreground mt-1">
            Sunucunuzda herhangi bir modülü yapılandırırken yardıma ihtiyacınız olursa Discord sunucumuz üzerinden 7/24 destek alabilir veya sohbet kanalında <code className="text-primary font-mono">/yardım</code> komutunu çalıştırabilirsiniz.
          </p>
        </div>
      </motion.div>
    </section>
  );
};

export default Docs;
