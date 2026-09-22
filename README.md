# 🌪️ Envelope Storm

**Sınıf içi İngilizce zarf oyunu** — akıllı tahta + öğretmen telefonu, gerçek zamanlı.

Ortaokul İngilizce dersi için sınıf içi, gerçek zamanlı bir oyun. Sınıf iki gruba ayrılır;
akıllı tahtada kapalı zarflar vardır. Öğrenci bir zarf seçer, içindeki görsele göre İngilizce
cümle kurar. Öğretmen cümleyi telefonundan "doğru / yanlış" olarak değerlendirir; grup puan
kazanır veya kaybeder. Zarflardan birinin içinden **🌪️ tornado** çıkarsa o grubun tüm puanları silinir.

## Mimari (tamamen ücretsiz)

| Katman | Servis | Not |
|---|---|---|
| Hosting + API | **Vercel** (serverless) | Statik arayüz + sunucusuz fonksiyonlar |
| Veri + görseller | **MongoDB Atlas** (M0) | Oyunlar, oda durumu ve görseller (base64) |
| Senkron | **Polling** (~1.2 sn) | Tahta/telefon sunucuyu yoklar; ekstra servis yok |

> Not: Vercel sürekli çalışan bir WebSocket sunucusu (Socket.io) barındıramaz. Bu yüzden
> senkron, sınıf oyunu için fazlasıyla yeterli olan kısa aralıklı polling ile yapılır.

## Akış

1. Öğretmen yönetim panelinde **yeni oyun** oluşturur → görselleri yükler → her zarf için görsel/tornado + puan atar → kaydeder → **kod** alır.
2. Tahtada `/board/KOD`, telefonda `/moderate/KOD` açılır (veya `/join` sayfasından kod + rol seçilir).
3. Sıradaki öğrenci tahtada bir zarfa dokunur → görsel açılır.
4. Öğrenci cümle kurar; öğretmen telefonda **Doğru ✓ / Yanlış ✗** der.
   - Doğru → gruba zarfın puanı eklenir. Yanlış → düşülür (0'ın altına inmez).
   - Zarftan tornado çıkarsa o grubun puanı **sıfırlanır**.
5. Sıra otomatik olarak diğer gruba geçer. "Oyunu bitir" ile kazanan ilan edilir.

## 1. MongoDB Atlas (ücretsiz M0)

1. [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) → ücretsiz hesap aç.
2. **Build a Database** → **M0 Free** kümesi oluştur (en yakın bölge: `eu-west` / Frankfurt).
3. Kullanıcı adı + parola belirle (parolayı bir yere not et).
4. **Database Access** → kullanıcını oluşturduğuna emin ol.
5. **Network Access** → **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`).
   *(Vercel fonksiyonlarının IP'si değişkendir; bu yüzden herkese açmak gerekir.)*
6. **Connect → Drivers** → bağlantı dizesini kopyala:
   `mongodb+srv://kullanici:parola@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
   — içindeki `<parola>`yı kendi parolanla değiştir.

## 2. Vercel'e deploy

1. Bu klasörü bir **GitHub deposuna** push et:
   ```bash
   git init && git add . && git commit -m "envelope storm"
   git remote add origin https://github.com/KULLANICI/envelope-storm.git
   git branch -M main && git push -u origin main
   ```
2. [vercel.com](https://vercel.com) → GitHub ile giriş → **Add New → Project** → bu repoyu seç.
   Vercel `api/` (fonksiyonlar) ve `public/` (statik) klasörlerini otomatik algılar.
3. **Environment Variables** bölümüne ekle:
   - `MONGODB_URI` = yukarıdaki Atlas bağlantı dizen
   - `MONGODB_DB` = `envelope-storm` (opsiyonel, varsayılan bu)
4. **Deploy**. Bittiğinde sana `https://envelope-storm-xxx.vercel.app` gibi kalıcı bir link verir.
   Tahta/telefon bu linkten erişir. (Settings → Domains ile kendi alt alanını da ekleyebilirsin.)

## 3. Yerelde deneme

Gereksinim: **Node.js 18+** ve bir MongoDB (yerel ya da Atlas).

```bash
npm install
MONGODB_URI="mongodb+srv://..." npm run dev   # → http://localhost:3000
```

Ya da Vercel'in resmî aracıyla (gerçek deploy ortamını taklit eder):
```bash
npx vercel dev
```

## Testler

```bash
npm test   # mongodb-memory-server ile uçtan uca (gerçek Mongo gerekmez)
```

## Ortam değişkenleri

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `MONGODB_URI` | — | MongoDB Atlas bağlantı dizesi (zorunlu) |
| `MONGODB_DB` | `envelope-storm` | Veritabanı adı |
| `PORT` | `3000` | Yalnızca yerel `dev.js` için |

## Dosya yapısı

```
envelope-storm/
├── api/                # Vercel serverless fonksiyonları
│   ├── games/          #   oyun CRUD
│   ├── images/         #   görsel yükleme/servis/silme
│   └── room/[code].js  #   oda durumu (polling) + aksiyonlar
├── lib/
│   ├── db.js           # MongoDB bağlantısı (önbellekli)
│   └── game.js         # oyun mantığı (saf fonksiyonlar)
├── public/             # statik arayüz (yönetim, katıl, tahta, moderatör)
├── test/               # uçtan uca testler
├── dev.js              # yerel geliştirme sunucusu
└── vercel.json         # tahta/moderatör adres yönlendirmeleri
```

## Notlar / küçük ayarlar

- **Yanlış cevapta puan sıfırın altına inmez** (`Math.max(0, …)`). Değiştirmek için `lib/game.js` → `judge()`.
- Zarf puanı zarfta görünür; içerik (görsel mi tornado mu) **açılana kadar gizlidir**.
- Görseller yüklenirken istemcide otomatik küçültülür (max 1400 px, JPEG) — hem Vercel'in gövde
  limitine hem de Atlas'ın 512 MB depolamasına takılmamak için.
- Görseller MongoDB'de saklanır ve `/api/images/:id` adresinden sunulur (kalıcı cache ile).
- Bir oyunu düzenledikten sonra aktif oturuma yansıması için moderatörde **"Oyunu sıfırla"** yeterlidir.
- Aynı kod tekrar kullanılabilir; "Oyunu sıfırla" puanları ve açılan zarfları temizler.
- Kod, odaya girmek için tek "şifre"dir; tahta ve moderatör aynı kodu kullanır (spesifikasyona uygun).
