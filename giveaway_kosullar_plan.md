# 📋 Çekiliş "Koşullar/Muafiyetler" Modalı — Geliştirme Planı (Kodlama yok, onay bekliyor)

> Hedef: `buildManageGiveawayPayload` panelindeki **Muafiyetler** butonunu **Koşullar** olarak yeniden düzenlemek, modalı Components V2 ile genişletmek ve buton basıldığında paneli **mesajı yerinde edit**leştirmek.
> Kural kaynağı: `/root/discord_mod_bot/GEMINI.md` (STRICT SYSTEM RULES).

---

## 1. Şu anda varolanlar (baseline)

| Katman | Dosya | Durum |
|---|---|---|
| Panel | `utils/giveawayManager.js:57` (`buildManageGiveawayPayload`) | `gw_conditions:<msgId>` butonu "Muafiyetler", `ButtonStyle.Primary`, `MONO_EMOJIS.shield` |
| Buton aç | `utils/giveawayManager.js:543` (`gw_conditions`) | `deferUpdate()` → `showModal(gw_cond_modal)` ✓ (KURAL 4 uyumlu) |
| Modal | `utils/giveawayManager.js:546-551` | `ModalBuilder` + `addLabelComponents` (Components V2) |
| Modal alanları | - | `gw_cond_required` (RoleSelect, max 1), `gw_cond_exempt` (RoleSelect, max 10) |
| Submit | `utils/giveawayManager.js:329` (`gw_cond_modal`) | `deferReply({ephemeral})` → `db.updateGiveawayExemptRoles` → `editReply` (ayrı mesaj gönderiyor — istenmeyen) |
| DB | `db.js:1854` (`updateGiveawayExemptRoles`) | `exempt_roles TEXT` kolonu **zaten** `guild_giveaways` ek (db.js:765) — yeni kolon gerekmez |
| Katılım | `utils/giveawayManager.js:685` (`gw_join`) | **Sadece** `required_role_id` kontrol ediliyor; **exempt rollerin bypass'ı TAMAMEN yapılmamış** ✗ |

**NOT:** GEMINI.md KURAL 2'ye göre "modal yalnızca TextInputBuilder kabul eder" deniyor, ama mevcut `gw_cond_modal` **zaten** `LabelBuilder`+`RoleSelectMenuComponent` ile modal içinde role seçim menüsü kullanıyor. Bu, discord.js v14.27.0'un `addLabelComponents` Components V2 desteğiyle çalışıyor. Yani **kod tabanı bu patterni zaten kabul ediyor**; biz de aynı patterni takip edeceğiz.

---

## 2. Talep edilen yeni koşullar (senin ifadelerinle eşleştirerek)

| # | Alan (TR) | Tipler | customId | DB kolonu / kaynak | Zorunlu? |
|---|---|---|---|---|---|
| 1 | Gerekli Roller | RoleSelect, max 1 | `gw_cond_required` | `guild_giveaways.required_role_id` (mevcut) | Hayır (boş = herkes katılabilir) |
| 2 | Engeli/Muaf Roller | RoleSelect, max 10 | `gw_cond_exempt` | `guild_giveaways.exempt_roles` (mevcut) | Hayır |
| 3 | **En az Hesap Yaşı** (gün) | TextInput (sayı) | `gw_cond_acc_age` | **YENİ** `min_account_age_days` | Hayır |
| 4 | **En az Sunucu Üyeliği** (gün) | TextInput (sayı) | `gw_cond_membership` | **YENİ** `min_membership_days` | Hayır |
| 5 | **En az Sunucu Boost** | StringSelect (dropdown) | `gw_cond_boost` | **YENİ** `min_boost_tier` (0/1/2/3) | Hayır |
| 6 | **İptal (Cancel)** butonu | Button (panelde) | `gw_cond_cancel` | — | — |

> "orda sira kullaniliyor" ifadesi → #5 Boost için **dropdown (StringSelect)**.
> "sayı belirleniyor" ifadesi → #3/#4 için **TextInput (Short, numeric placeholder)**.
> ✅ **LEVEL sistemi yok — "en az seviye" alanı TAMAMEN ÇIKARILDI.** (kodlama gerektirmez)

---

## 3. Katılım koşulları mantığı (gw_join'de uygulanacak)

```
KATILIM KURALI (önem sırasıyla — ENGELİ kontrolü HER ZAMAN ÖNCEDEN):

1) ENGELİ/MUAF ROL KONTROLÜ  →  (öncelikli; hiçbir şeye göre geçmez)
   Eğer user `exempt_roles` listesindeki rollerden HERHANGİ BİRİNİ ha ediyorsa:
      → ANLIK DENYALANDIR (katılamaz). Diğer rollere / şartlara bakılmaz,
        gerekli rol bile olsa KATILAMAZ.
        ("o rola biri sahipse ve diğer rollere bakmadan o kişi katılamıyor")
   → ephemeral "Bu rolde olduğunuz için katılamazsınız" mesajı.

2) GEREKLİ ROL KONTROLÜ:
   required_role_id boşsa → herkes (engel kontrolünden geçen) geçer.
   required_role_id doluysa → user onu ha (veya birini) taşımalı; yoksa DENYAL.

3) EK ŞARTLAR (isteğe bağlı; sadece set edilmişse uygulanır):
   • min_account_age_days → (now - user.createdAt) gün ≥ değer
   • min_membership_days  → (now - member.joinedTimestamp) gün ≥ değer
   • min_boost_tier       → user boost tier ≥ değer
   Herhangi biri kalmazsa DENYAL. (gerekli rol sahibi olmak bunları geçmez;
   "roolu olanlar için bu seçenekler de geçer" anlamı.)

4) Hiçbiri engellemezse → toggleGiveawayParticipant (katılım/çıkma).
```

**Discord API kaynakları (okunacak):**
- Hesap yaşı: `interaction.user.createdTimestamp` (ms) → `days = (Date.now() - created) / 86400000`
- Sunucu üyeliği: `interaction.member.joinedTimestamp` (ms), aynı dönüştür.
- Boost: `interaction.member.premiumSince !== null` → tier ≥ 1; guild tier üst sınır `guild.premiumTier` (maks 3).
- Level: **ALAN ÇIKARILDI** — kodlama gerektirmez.

**⚠️ Düzeltme:** raporun 1. taslağındaki "muaf rol = katılabilir / bypass" yorumu **yanlıştı**. Kullanıcı netleştirdi: **"muaf/engeli roller" = ENGELLEME LİSTESİ** (rolü olan katılamaz). `exempt_roles` sütun adı korunabilir; mantık tamamen **engelleme/yasa** yönde. (Dilersen sütunu `excluded_roles`/`blocked_roles` olarak yeniden adlandırabiliriz; sadece DB sütun adı değişir.)

---

## 4. DB şeması değişiklikleri (db.js `initDB`)

`guild_giveaways` tablosuna 3 ALTER (mevcut çalışan DB'ye geriye dönük `try/catch`):

```js
try { await conn.query('ALTER TABLE guild_giveaways ADD COLUMN min_account_age_days INT DEFAULT NULL'); } catch(e){}
try { await conn.query('ALTER TABLE guild_giveaways ADD COLUMN min_membership_days INT DEFAULT NULL'); } catch(e){}
try { await conn.query('ALTER TABLE guild_giveaways ADD COLUMN min_boost_tier INT DEFAULT NULL'); } catch(e){}
```
(✅ `min_level` yok — level sistemi yok.)

Yeni DB fonksiyonları (db.js):
- `setGiveawayConditions(messageId, { required_role_id, exempt_roles, min_account_age_days, min_membership_days, min_boost_tier })` — tek UPDATE + `exempt_roles` JSON.stringify.
- `getGiveaway(messageId)` zaten `SELECT *` yapıyor → yeni kolonlar otomatik gelir. (PARSE: şu an `exempt_roles` JSON parse edilmiyor → `getGiveaway` içinde `JSON.parse` eklenecek.)

---

## 5. Modal yapısı (gw_cond_modal yenilemesi)

```
ModalBuilder().setCustomId('gw_cond_modal').setTitle('Çekiliş Koşulları')
  .addLabelComponents(
    LabelBuilder('Katılım Koşulu').setRoleSelectMenuComponent(RoleSelect gw_cond_required, max 1),
    LabelBuilder('Engeli/Muaf Roller').setRoleSelectMenuComponent(RoleSelect gw_cond_exempt, max 10),
    LabelBuilder('En az Hesap Yaşı (gün)').setTextInputComponent(TextInput gw_cond_acc_age, Short, placeholder 'örn: 30', required false),
    LabelBuilder('En az Sunucu Üyeliği (gün)').setTextInputComponent(TextInput gw_cond_membership, Short, placeholder 'örn: 7', required false),
    LabelBuilder('En az Sunucu Boost').setStringSelectMenuComponent(StringSelect gw_cond_boost, options: ['0 - Yok','1','2','3'], required false)
  )
  ✅ (En az Seviye yok — level sistemi yok.)
```

KURAL 1 UYUMU: hiçbir yerde ⚙️📁🛡️💬✅ gibi **klavye emojisi** yok; hep `<:mono:${MONO_EMOJIS.xxx}>` veya butonlar `.setEmoji(MONO_EMOJIS.xxx)`.

---

## 6. Buton davranışları (handleGiveawayButton'e eklenecek)

| Eylem (action) | customId | Davranış | Mesaj stratejisi |
|---|---|---|---|
| `gw_conditions` (aç) | mevcut | `deferUpdate()` → `showModal(gw_cond_modal)` | panel yerinde, yeni mesaj YOK ✓ |
| `gw_cond_modal` (kaydet) | submit | parse alanlar → `setGiveawayConditions` → `getGiveaway` → `interaction.message.edit(buildManageGiveawayPayload(gw))` → `deferUpdate()` | **panel edit lenir, ayrı ephemeral mesaj YOK** ✓ |
| `gw_cond_cancel` (iptal) | buton | modalı kapat / değişiklikleri iade et → `interaction.message.edit(...)` paneli eski haline getir | **edit in-place, yeni mesaj YOK** ✓ |

> "o butona basınca ayrı mesaj atma, düzelt o mesajı editlesin" → tüm flow'larda `interaction.message.edit(...)` + `deferUpdate()`. `interaction.editReply` (ephemeral) **kaldırılacak**.

### Paneldeki `descText` güncellemesi (görünüm)
`buildManageGiveawayPayload`'in `descText`'ine (alt kısım) koşulları özet olarak ekle:
```
<:mono:${MONO_EMOJIS.shield}> **Katılım Koşulları:**
• Gerekli rol: <@&x> (yok)
• Engeli roller: yok
• Hesap yaşı ≥ 30g
• Sunucu üyeliği ≥ 7g
• Boost ≥ 1
```
(Boş = "herkes"/"yok" şeklinde. ✅ Seviye yok.)

### İptal (Cancel) butonu — PANELDE
`gw_cond_cancel` butonu **`gw_conditions` butonunun yanına / panel row'una** eklenir (gw_conditions açıldıktan sonra görünmez; paneldeki mevcut koşulları temizler):
- `deferUpdate()` → `db.setGiveawayConditions(msgId, { defaults })` → `interaction.message.edit(buildManageGiveawayPayload(freshGw))`.
- Ayrıca ephemeral "sıfırlandı" mesajı **yok**, panel fiili olarak güncellenir.

---

## 7. Güvenlik / yetki

- `gw_conditions` butonu `buildManageGiveawayPayload`de sadece **guild owner / bot yönetici** gönderdiğinden yetki kontrolü panelde zaten var; modal açılır açılmaz `interaction.message` panelini tutuyoruz → guild güvenli.
- `setShowParts`/`updateGiveawayStatus` gibi diğer `gw_*` butonlarıyla akış tutarlı kalacak.
- KURAL 4: modal submit/buton ilk satırda `deferUpdate()` veya `deferReply({ephemeral})` (KURAL uyumu). Edit-in-place için `deferUpdate()` + `message.edit()`.

---

## 8. Sipmler / eksikler (kodlarken dikkat)

1. **Level sistemi yok — alan tamamen çıkarıldı.** Kodlama gerektirmez. (✅)
2. **Muaf/Engeli rol = BLOCKLİST.** `gw_join` şu anda exempt kontrolü **hiç yapmıyor** → mutlaka ilk kontrol olarak eklenecek (katılan kişiye göre geçmez).
3. **`gw_cond_modal` submit** şu anda `editReply` (ayrı ephemeral mesaj) gönderiyor → `interaction.message.edit(buildManageGiveawayPayload(gw))` + `deferUpdate()` şeklinde **paneli yerinde** güncelle.
4. Boost tier: `interaction.member.premiumSince !== null` → ≥1; alt sınır guild `premiumTier` (max 3). Basit tut: `premiumSince ? 1 : 0` ≥ `min_boost_tier` karşılaştırması.
5. **StringSelectMenuComponent / RoleSelectMenuComponent** `LabelBuilder` içinde `addLabelComponents` ile mevcut kod zaten destekliyor (discord.js v14.27), KURAL 2 riski yok.
6. `exempt_roles` şu anda `getGiveaway`da JSON parse edilmiyor → eklenecek (join'de diziye çevir).
7. `gw_cond_cancel` butonu **panel** `buildManageGiveawayPayload`'e eklenecek; `gw_home` satırına komşu yeni bir row, `ButtonStyle.Secondary` + `MONO_EMOJIS.octagon`.

---

## 9. Uygulanacak dosyalar

| Dosya | Değişiklik |
|---|---|
| `utils/giveawayManager.js` | `buildManageGiveawayPayload` descText genişlet; `gw_conditions` modalını yeni 4 alanla genişlet; `gw_cond_modal` submit handlerını `message.edit`+`deferUpdate` yap; `gw_cond_cancel` butonu ekle; `gw_join`e koşul kontrol blokları ekle. |
| `db.js` | `initDB`: 4 ALTER COLUMN; `setGiveawayConditions` fonksiyonu; `getGiveaway`da `exempt_roles` JSON parse. |
| `utils/giveawayLogger.js` | (varsa) event logları (`conditions_saved`, `conditions_cancelled`). |

---

## ✅ Onay / Bilgi

- [x] Level alanı kaldırıldı, kodlama yok. ✅
- [ ] Boost dropdown: `['0 - Yok', '1', '2', '3']` — onaylıyorsan devam eder.
- [ ] "Engeli/Muaf rol" = **rol sahibi KATILAMAZ** (gerekli rolün varlığı geçmez) — bu semantikle kodlayacağım.
- [ ] Cancel butonu **panel** `buildManageGiveawayPayload`'e, `gw_home` rowuna komşu.
- [ ] `gw_cond_modal` kaydet → panel `message.edit` + `deferUpdate` (ephemeral mesaj **yok**).
