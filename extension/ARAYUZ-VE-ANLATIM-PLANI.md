# Kare Kare 0.13.1 — kenar paneli ve konuşmayı izleyen çizimler

## Kapsam

Önceki sürümün bütün analiz, ses toparlanması, on hamle derecesi, taktik, kayıt, gelişim, kademeli ipucu, rapor ve 15 tek tuş özelliği korunur. Kullanıcının seçtiği kenar paneli uygulanır. Ayrı odak şeridi ve bulmaca eklenmez. Bot ve inceleme paketlerinin hesap/tarih/izin kapsamı genişletilmez.

## Uygulanan geliştirmeler

1. **Yerleşim:** tahtanın, koordinatların/saatlerin ve görünür site sütunlarının çevresindeki boşluğu ölç. Önce sağa, gerekirse sola yerleş; yeterli boşluk yoksa tahtanın altında ayrı bir alana geç. Site tahtasını küçültme veya hamle yapma. Odak görünümü, pencere boyutu, kaydırma ve tahta değişiminde yeniden konumlandır. Boş tahta durumunda panel görünür kalsın.
2. **Görünüm tercihleri:** başlangıç genişliği 360 px; 280–480 px ayarı, 14–20 px metin, otomatik/açık/koyu tema, otomatik/sağ/sol yerleşim tercihi ve varsayılanlara dönme. Tercihleri yerel kaydet ve eski kayıtları güvenli varsayılanlarla taşı.
3. **Bilgi düzeni:** üstte eşleşme/değerlendirme/son derece, kritik uyarı ve sürekli ses durumu; ana alanda Yorum/Plan/Rakip sekmeleri, okunaklı adaylar ve açılan gerekçe; aşağıda tek koç menüsü ve mevcut bütün işlemler. Küçültülmüş görünümde kritik bilgiler ve bütün kısayollar çalışsın.
4. **Aday okları:** mevcut sarı/mavi/kırmızı-turuncu sıralama renklerini ve ince geometriyi koru. Bir adayın kendi devamında renk sıralama anlamını değiştirmesin. İki taraf aynı düz ok geometrisini kullansın. Her ok Sen/Rakip etiketi taşısın; örnek adımlarda aynı 12 px font/renk/düzenle Sen · 3 veya Rakip · 2 yazsın.
5. **Anlatım verisi:** yalnızca aynı doğrulanmış FEN, motorun yasal varyantı, kanıtlı taktik hedefleri ve yerel kazançlı tehditlerden çizim üret. Açıklamadaki hamle, hedef ve rakip cevabını ayrı konuşma parçalarına bağla. Aynı FEN'de yalnızca ilgili kanıtı/sıralamayı doğrula; ilgisiz arama güncellemesi geçerli çizimi silmesin. Tahta aynı konumda yeniden çizildiğinde kaybolan katmanı geri oluştur. Yeni taktik uydurmak veya her kare adına otomatik ok üretmek yok.
6. **Ses eşleşmesi:** çizimi ilgili konuşma parçasının gerçek başlangıcında göster; bitiş, durdurma, hata, yeni konum ve eşleşme kaybında temizle. Eski konuşmanın gecikmiş olayları ve geçmiş notları güncel tahtaya çizim yapamasın. Mevcut ses yeniden bağlanma ve öncelik davranışı korunsun.
7. **Kontrol:** konuşmayı oklarla takip et: kapalı / yalnızca taktik ve tehdit / bütün açıklamalar. Anlatım boyunca aday katmanı tamamen gizlensin. Adaylar kapalıyken de doğrulanmış anlatım çizimleri geçici açılsın. Boşluk yalnızca beklemedeki aday oklarının tercihini değiştirsin; konuşmayı bölmesin. Bitişte güncel adaylar son açık/kapalı tercihine göre geri gelsin. Hedef/fikir düzeyinde hamle sızmasın; özellikle istenen aday kendi oklarını gösterebilsin.
8. **Doğrulama ve teslim:** geometrik yerleşim ve konuşma/çizim regresyonları; iki yönlü tahta, hızlı hamleler, iptal, yeniden bağlanma ve geçmiş notları; ayrı Chrome profiliyle dar/geniş, odak/normal benzeri düzenler, tercihler, bütün eski işlemler ve 20 maçlık kayıt akışı. İki paket, kaynak eşleşmesi ve ayrıntılı kabul listesi. Fiziksel ses ve gerçek Chess.com sayfası için ekip teyidi ayrı tutulur.

## Kabul ölçütleri

- Panel tahtanın/saatlerin üstüne gelmez; boşluk yetmediğinde aşağı yerleşimin gerektirdiği kaydırma açık belirtilir.
- Sekmeler ve menü bir özelliği silmez; eski tek tuşlar aynı görevleri yapar.
- Aday rengi sıralamayı, Sen/Rakip etiketi tarafı, adım numarası koşullu/örnek devamı anlatır. Çizim yalnızca o anda duyulan açıklamayı izler.
- Koç durduğunda veya tahta değiştiğinde eski otomatik ok kalmaz. Anlatım bittiğinde aday oklarının son açık/kapalı tercihi uygulanır.
- Sesin fiziksel duyulması ve güncel Chess.com DOM uyumluluğu otomatik test geçti diye tamamlanmış sayılmaz.

## Gerçekleştirilen doğrulama

- 164 Node regresyon testi ve 4 Python ses aracı testi geçti.
- Ayrı, geçici Chrome profilinde derlenmiş panel: sağ/sol/alt yerleşim, site sütunu engeli, kaydırma, ters tahta, sekmeler, kaydedilen görünüm ayarları, özgün Nc5+ örneğinin adımları, aynı konumda tekrar, bağımsız aday oku tercihi ve 12 A/S/D/Q/W/E × açık/kapalı durumu, gizli ipuçları ve üç anlatım modu sınandı.
- Önceki 20 sentetik oyunlu kayıt/kısayol/yenileme denemesi ile panel/ses/efekt tercih denemesi ayrıca çalıştırılır. Test motoru ve Chrome ses köprüsü taklittir; işletim sisteminin fiziksel ses çıkışı ölçülmez.
- Dağıtımlar aynı izin/hesap/tarih kapsamıyla hazırlanır; gerçek Chess.com ve duyulan ses akıcılığı ekipte ayrıca teyit edilir.
