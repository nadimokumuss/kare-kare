# Kare Kare 0.12.0 — kapsamlı geliştirme ve doğrulama

27 Ekim 2026. Kullanıcının onayladığı yedi başlık bu sürümde uygulandı. Ayrı bulmaca/alıştırma kapsam dışıdır; yardım maçın içinde kalır. Mevcut ses, on hamle derecesi, taktikler, efektler, oklar ve erişim sınırları korunur.

0.13.0 arayüz ve sesli çizim planı: [ARAYUZ-VE-ANLATIM-PLANI.md](ARAYUZ-VE-ANLATIM-PLANI.md). Aşağıdaki önceki işlevler yeni pakette korunur.

## 1. Konum değişimini anlatma — uygulandı

Son hamlenin öncesi/sonrası karşılaştırılır. Yeni kazançlı alış, giderilen tehdit, yeni koşullu tehdit, kalenin dikeyinin açılması ve açarak/çifte şah anlatılır. Değişim yoksa yapay bir sebep eklenmez. Son hamle mevcut FEN ile eşleşmiyorsa eski değişim kullanılmaz. B ile ayrıca dinlenir.

## 2. Çok hamleli plan hafızası — uygulandı

Doğrulanmış ana adayın hedefi, ilk adımı ve aynı taraftan en fazla iki somut adımı saklanır. Gerçek hamlelerle karşılaştırılarak yeni/devam ediyor/kısmen gerçekleşti/tamamlandı/değişti/engellendi durumları üretilir. Rakibin cevabı eski adımı yasadışı yaptığında veya güçlü adaylardan çıkardığında neden ayrıştırılır. Ana aday değişirse plan ve oklar ona göre güncellenir; rakibin cevabı kesinmiş gibi anlatılmaz. Plan yerel maç kaydına bağlanır, doğrulanmış geçmişle geri yüklenir. W ile dinlenir.

## 3. İki güçlü adayın farkı — uygulandı

Aynı güçlü aday aralığında, yeterli derinlikte, yasal devamı olan iki hamle karşılaştırılır. Şah, alış, tek yasal cevap veya somut gerekçe farkı anlatılır. Değerlendirme yakınsa bu belirtilir; tek güçlü aday varsa ikinci iyi hamle uydurulmaz. F ile karşılaştırma; A/S/D ile ayrı gerekçe ve devam dinlenir.

## 4. Rakibin baskı ve tehditlerini ayırma — uygulandı

Gerçek şah yükümlülüğü ve yerel takas hesabında kazançlı alış ayrı anlatılır. Gelecek sıra için tehdit koşulludur. Önerilen ilk hamleye verilen motor cevabı “Sen X oynarsan rakip Y…” biçimindedir. Ana aday tehdidi doğrudan gidermiyorsa karşı oyunun seçildiği açıklanır. Rakibin zihni okunmaz; bir taşa bakması kazançlı tehdit olduğunun kanıtı sayılmaz. E ile dinlenir.

## 5. Maç içinde hedef → fikir → hamle — uygulandı

İsteğe bağlı kademeli yardım her konumda hedef düzeyinden başlar. H ile fikir, sonra somut hamle açılır. Diğer bölümlerin konuşmaları gizli hamleleri açıklamaz. Kullanıcı A/S/D ile özellikle bir aday isterse o aday okunabilir; genel yardım düzeyi değişmez. Ok gösterme izni yalnızca mevcut konuma aittir. Ayrı egzersiz, bulmaca veya çalışma konumu arayüzü kaldırıldı.

## 6. Maç kaydı ve on maçlık karşılaştırma — uygulandı

Hesap bazında yerel hamle günlüğü; tamamlanma sırası; kendi hamle dereceleri; renk, sonuç, mevcutsa süre/rakip seviyesi; koç sürümü, analiz yöntemi, yardım ayarları ve kullanım sayaçları tutulur. Aynı bot oyunu yenilemede kimliğini korur; yeni bot oyunu farklı kimlik alır. Online maçlarda sayısal oyun kimliği kullanılır. Web Locks ile aynı kaynağın sekmeleri kayıtları sırayla birleştirir. Yarım maçlar istatistiğe katılmaz. Geri/ileri hamle incelemesi kayıt yazımını duraklatır.

Son on maç sürekli kayan özet verir. İlk onluk dönem 10'da, ilk karşılaştırma 20'de oluşur. 20'de 11–20/1–10, 30'da 21–30/11–20 karşılaştırılır. Tamamlanan her onluk dönem için bildirim vardır. Hata/büyük hata sıklığı, güçlü seçim oranı ve doğrulanmış fırsata güçlü yanıt oranı kendi değerlendirilen hamleleri üzerinden hesaplanır. Koç düzeltmesi hata sayılmaz. Analiz kapsamı, aşamalar ve koşul farkları açıklanır. Düşük kapsamta kesin gelişim yargısı yoktur.

Hesap başına son 100 tamamlanmış ve 8 aktif oyun saklanır; ömür boyu tamamlanma sayacı korunur. Kayıt kapatılabilir, hamlelerle JSON dışa aktarılır, iki adımlı onayla hesap verisi silinir. Eski sürümlerde oynanan maçlar kendiliğinden eklenmez. Chrome profilinden veya farklı uzantı kimliklerinden kayıtlar otomatik taşınmaz.

## 7. Özelleştirilebilir tek tuşlar — uygulandı

15 işlev atanabilir; her biri tek harf/rakam/Boşluk. Varsayılanlar kabul kontrol listesindedir. X/Z siteye bırakılır. Çakışan atama reddedilir; atama kaldırılabilir ve varsayılanlara dönülebilir. Panel küçültülmüşken çalışır. Yazı alanlarında, form kontrollerinde, IME sırasında, tuş tekrarında ve değiştirici tuş birleşimlerinde çalışmaz. Son elle istek önceki elle isteğin yerini alır; güncel zorunlu mat önceliği korunur. Eski konumun elle okuması yeni konumda iptal edilir. Son duyulan açıklama açık geçmiş bağlamıyla tekrar istenebilir.

## Doğrulama ve sınırlar

- Ayrıntılı adımlar: [ACCEPTANCE-CHECKLIST.md](ACCEPTANCE-CHECKLIST.md).
- Birim/regresyon testleri: plan geçişleri, konum değişimleri, gizli hamlelerin korunması, bağlam, kısayollar, manuel ses önceliği, dönem hesapları, aynı maçın tekrar sayılmaması, eşzamanlı kayıt, saklama, silme ve önceki motor/ses testleri.
- Ayrı Chrome profiliyle gerçek derlenmiş panel üzerinde 20 sentetik oyun: tek tuşlar, küçültme, oklar, özel atama, ipucu, dönemler, yenileme, JSON ve silme. Yerel tahta, motor cevapları ve ses köprüsü taklittir; gerçek Chess.com veya işitsel test değildir.
- Gerçek motor örnekleri Node testlerinde ayrıca çalışır. Mat uyarısının etiketsiz geldiğinde açıklamayı bozduğu regresyon giderildi.
- Taktik taraması ve açıklamalar sınırlı motor devamı ve yerel takas hesabına dayanır; tüm uzun planları ve motifleri bulma garantisi vermez. Plan hafızası bir stratejik arama motorunun yerine geçmez.
- Canlı/günlük sayfa davranışı, iki renk ve gerçek ses çıkışı ekip tarafından ayrıca sınanmalıdır. Alternatif doğal ses modeli hâlâ ayrı denemedir; çalışan Chrome TTS değiştirilmedi.

Doğrulama sonucu (0.12.0): 127 Node testi ve 4 Python ses aracı testi geçti. Yerel Chrome panel/tercih/yerleşim denemesi ve 20 sentetik oyunlu entegrasyon denemesi geçti. Raporlar kaynak çalışma alanında `release/ui-smoke-v0.12.0/result.json` ve `release/integration-smoke-v0.12.0/result.json` altında.
