# Teklif Masası

Teklif Masası, sigorta brokerlarının teklifleri ve bunlara bağlı evrakları
tek bir çalışma alanında takip etmesi için geliştirilmiş bir Vinext/Next.js
uygulamasıdır. Arayüz dili Türkçedir.

## Mimari

- `app/`: Sayfalar, layout ve HTTP API route'ları.
- `components/`: Uygulamaya özel React bileşenleri.
- `components/ui/`: Paylaşılan, üretim aracından gelen UI bileşenleri.
- `lib/`: Uygulama kuralları, doğrulama, OCR ve kimlik yardımcıları.
- `database/`: Drizzle şeması ve D1 istemcisi. Bu alan teklif/evrak operasyon
  verisini tanımlar; bağımsız müşteri CRM veritabanı henüz yoktur.
- `drizzle/`: Uygulanabilir D1 migration dosyaları ve Drizzle meta verisi.
  Uygulanmış migration dosyalarını değiştirmeyin; şema değişikliğinde yeni bir
  migration ekleyin.
- `tests/`: Otomatik testlerin tek konumu. API/integration testleri
  `tests/api/`, UI testleri `tests/ui/` altında olmalıdır. Gerçek müşteri veya
  üretim belgesi fixture olarak eklenmemelidir.
- `public/document-assets/`: PDF/OCR için üretilen üçüncü taraf varlıklar.
  Bunları elle düzenlemeyin ve lint kapsamı dışında tutun.

## Veri ve güvenlik

- Teklifler ve onlara bağlı evraklar D1 ve R2 üzerinde tutulur; her teklifin
  `owner_id` alanı, Sites platformundan gelen kararlı ChatGPT kullanıcı
  kimliğidir.
- Yeni veya değişen API endpoint'leri `requireApiUser()` ile oturum denetimi
  yapmalı ve tüm veri sorgularını `owner_id` kapsamında sınırlandırmalıdır.
- Bir belgeye erişirken yalnızca belge ID'siyle yetinmeyin; belgenin bağlı
  teklifinin sahibini de SQL sorgusunda doğrulayın.
- Durum değiştiren browser istekleri aynı-origin kontrolünden geçmelidir.
- Dosya yükleme sınırları, magic-byte MIME doğrulaması, `attachment` indirme
  davranışı ve `nosniff` başlığı korunmalıdır.
- OCR istemci tarafında çalışır; OCR sonucu karar veya belge gerçekliği kanıtı
  değildir. İstemciden gelen OCR metnini kullanacak yeni akışlar ayrıca
  yetkilendirilmelidir.
- Uygulama, Sites platformunun güvenilir şekilde eklediği
  `oai-authenticated-user-*` başlıklarına dayanır. Canlı ortamda platform
  erişim politikasını devre dışı bırakmayın.

## Geliştirme kuralları

- Sunucu tarafındaki kimlik kodu `app/chatgpt-auth.ts` ve `lib/api-auth.ts`
  içinde kalmalıdır; bunları Client Component'lere aktarmayın.
- API girişlerini boyut, tip, izinli değer ve sahiplik açısından doğrulayın.
  Parametreli D1 sorguları kullanın.
- Yeni tablolarda sahiplik, denetim zamanı ve gerekli indeks ihtiyacını
  tasarım aşamasında değerlendirin.
- Yeni testler sentetik veri kullanmalı; dosya fixture'ları küçük ve zararsız
  olmalıdır.
- Üretilen `dist/`, `.wrangler/`, `.sites-runtime/` ve document assetlerini
  commit etmeyin.

## Komutlar

```sh
npm run dev
npm run build
npm run lint
npm run db:generate
```

Yerel D1 migration'ları README'deki sırayla uygulanır. Canlı veritabanına
migration uygulamak ayrı bir yayın işlemidir; yerel komutlarla yanlışlıkla
üretim ortamını değiştirmeyin.
