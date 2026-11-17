# Kare Kare 0.13.1 — özellik ve kabul kontrol listesi

Bu liste, üzerinde anlaşılan yedi geliştirme başlığını ayrı ayrı denemek içindir. Güncellemeden sonra eski kopyayı kapatıp yeni klasörü yükleyin ve oyun sekmesini yenileyin. Erişim kapsamı pakete göre korunur. Otomatik testlerin tamamlanması gerçek Chess.com sayfasında ve hoparlörde saha testinin yerine geçmez.

## 1. Konumda ne değişti?

- [ ] Kendi hamlenizden ve rakibin hamlesinden sonra **Değişim, plan ve aday karşılaştırması** bölümünü açın; B ile değişimi dinleyin.
- [ ] Yeni kazançlı alış, giderilen doğrudan tehdit, açılan kale dikeyi, açarak şah veya çifte şah varsa somut değişim anlatılsın.
- [ ] Sıradan bir hamlede yapay bir kritik olay üretilmesin. Savunulan bir piyona bakmak tek başına kazançlı tehdit sayılmasın.
- [ ] Henüz sırası olmayan tarafın alış imkânı koşullu anlatılsın; oyuncuya arka arkaya iki hamle verilmesin.

## 2. Hamleler boyunca plan

- [ ] W ile planı dinleyin; ilk adım ve hesaplanan rakip cevabına bağlı devam açıklansın.
- [ ] İlk adımı oynayın: planın kısmen uygulandığı belirtilsin; rakip cevabından sonra yeniden değerlendirilsin.
- [ ] Hedef tamamlanınca tamamlandı; başka devam seçilince değişti; önceki somut adım artık yasal değilse engellendi açıklaması gelsin.
- [ ] Önceki devam yasal ama güçlü aday değilse sebep bu şekilde ayrı anlatılsın. Eski plan hâlâ güçlü ikinci adayken ana aday değişirse değişim açık söylensin.
- [ ] Güncel ilk adım, ana aday ve varsayılan oklar tutarlı olsun. Gelecekteki rakip hamlesi kesinmiş gibi anlatılmasın.
- [ ] Aynı konum tekrar hesaplanınca ilerleme uyarısı durmadan tekrarlanmasın. Aynı doğrulanmış maç yenilenince kayıtlı plan geri yüklenebilsin.

## 3. İki güçlü adayı karşılaştırma

- [ ] F ile ilk iki güçlü adayın farkını dinleyin: şah çekiş, alış, zorunlu cevap veya somut gerekçe.
- [ ] Açıklamalar aynı yasal motor devamlarına bağlı olsun; fark küçükse bu söylensin.
- [ ] Güçlü aday toleransında yalnızca bir seçenek varsa ikinci bir iyi hamle uydurulmasın.
- [ ] A/S/D her adayın ayrı gerekçe ve devamını okusun; rakibin sırasıysa adayın rakibe ait olduğu anlaşılsın.

## 4. Rakibin fikrini dikkatli yorumlama

- [ ] E ile rakip açıklamasını dinleyin. Gerçek şah tehdidi, yerel kazançlı alış ve önerilen ilk hamleye bağlı cevap ayrışsın.
- [ ] Rakibin savunulan f2 piyonunu fil ile alıp fil kaybetmesi kazançlı tehdit sayılmasın.
- [ ] Ana aday doğrudan savunma yerine karşı oyun seçiyorsa bu açıkça söylensin; aynı anda hem “bunu mutlaka koru” hem “bırak” denmesin.
- [ ] Henüz sırası olmayan rakibin gelecekteki hamlesi koşullu anlatılsın. Yerel kazançlı alış bulunmaması “hiç tehdit yok” diye sunulmasın.

## 5. Maç içinde kademeli yardım

- [ ] Menüde **Kademeli ipucu** seçeneğini açın: ilk düzey hedef, H ile fikir, tekrar H ile somut hamle.
- [ ] Hedef/fikir düzeyinde adaylar ve ayrıntılı devamlar gizlensin; Q/W/E/F/G/B/R okumaları gizli hamleyi açığa çıkarmasın.
- [ ] Özellikle A/S/D istenirse yalnızca o aday okunabilsin; genel ipucu düzeyi kendiliğinden ilerlemesin.
- [ ] Boşluk okları o konum için açıp kapatsın; sonraki konumda önceki gösterme izni taşınmasın.
- [ ] Yeni hamlede hedef düzeyine dönülsün. Hiçbir bölümde ayrı bulmaca/alıştırma verilmesin.

## 6. Yerel maç geçmişi ve gelişim

- [ ] **Koç menüsü → Maç kayıtları** içinde kayıt açık/kapalı çalışsın. Veri proje sunucusuna gönderilmesin.
- [ ] Hamle geçmişi, kendi hamle dereceleri, renk, sonuç, analiz kapsamı, mevcutsa rakip ve süre, koç sürümü ve yardım koşulları kaydedilsin. Bilinmeyen bilgi uydurulmasın.
- [ ] Mat/beraberlik veya sitede görünen sonuç maçı tamamlasın. Sonuç algılanmazsa menüden doğru sonucu seçip **Maçı sonuçlandır** kullanın.
- [ ] Devam eden/yarım kalan oyun tamamlanmış maç sayısını artırmasın. Aynı oyun yenilenince iki kere sayılmasın; aynı hamlelerle oynanan yeni bot maçı ayrı sayılsın.
- [ ] Hamle geçmişinde geri/ileri gezinme ve iki sekmeden eşzamanlı kayıt mevcut maçı bozmasın.
- [ ] **Son 10 maç / gelişim** sürekli son on tamamlanan maçı göstersin. İlk on tamamlanmadan mevcut örnek sayısı açık olsun.
- [ ] 10. maçta ilk dönem özeti, 20. maçta 11–20 ile 1–10 karşılaştırması; 30. maçta 21–30 ile 11–20 karşılaştırması verilsin. Dönemler çakışmasın.
- [ ] Hata ve büyük hata sıklığı 100 **değerlendirilen kendi hamlesi** üzerinden hesaplansın; güçlü seçim ve doğrulanmış fırsata güçlü yanıt oranları gösterilsin. Koç düzeltmesi oyuncu hatası sayılmasın.
- [ ] Açılış/oyun ortası/oyun sonu kapsamı ayrı görünsün. Az veri, değişen analiz kapsamı, yöntem, süre, rakip veya yardım ayarları varsa karşılaştırma sınırlaması açıklansın.
- [ ] Dönemlerin farkı kesin beceri artışı/azalışı diye sunulmasın. Koç desteğiyle oynanan maçlar bağımsız beceri ölçümü değildir.
- [ ] JSON dışa aktarımı bütün saklanan hamleleri içersin. Silme iki adım istesin; vazgeç korunmasını, onay silinmesini sağlasın. Silme sonrası kayıt kapansın; başka hesap etkilenmesin.
- [ ] Hesap başına son 100 tamamlanan ve 8 aktif oyun sınırı açıklansın. Sayaç daha eski oyunlar saklamadan çıkarıldığında da doğru kalsın.

## 7. Tek tuşla dinleme ve kontrol

| Varsayılan tuş | İşlev |
| --- | --- |
| Boşluk | Okları aç/kapat |
| Q | Konum yorumu |
| W | Plan/hedef |
| E | Rakibin tehdidi/cevabı |
| A / S / D | 1. / 2. / 3. aday ve gerekçesi |
| R | Taktikler |
| V | Son dinlenmiş açıklamayı tekrarla |
| C | Konuşmayı durdur |
| H | Sonraki ipucu düzeyi |
| F | İlk iki adayı karşılaştır |
| G | Tam açıklama |
| T | Son hamle dereceleri |
| B | Tahtadaki değişim |

- [ ] Her görev **Tek tuşlu kısayollar** içinde tek harf/rakam/Boşluk ile değiştirilsin. Backspace atamayı kaldırsın; kaydet ve varsayılana dön çalışsın.
- [ ] Aynı tuş iki göreve atanamasın. X/Z, Chess.com'un tahta çevirme/odak işlevlerine ayrılsın.
- [ ] Panel küçültülmüşken kısayollar çalışsın. Yazı/form alanı, site sohbeti, IME, tuş tekrarı ve Ctrl/Alt/Command/Shift birleşimlerinde tetiklenmesin.
- [ ] Yeni elle istenen okuma eski elle isteğin yerini alsın; güncel zorunlu mat uyarısı önceliğini korusun.
- [ ] Yeni konum gelince eski elle okuma güncel talimat gibi sürmesin. V ile geçmiş açıklama istenirse geçmiş olduğu belirtilsin.
- [ ] C sesi durdursun; sonraki elle istek yeniden okunabilsin. Boş aday veya hazır olmayan hesap açıkça belirtilsin.

## Otomatik kanıt ve saha testi kaydı

`npm test`, `npm run test:voice`, `python3 diagnostics/ui-smoke.py` ve `python3 diagnostics/ui-smoke.py --integration` komutları kullanılır. Entegrasyon denemesi gerçek derlenmiş paneli ayrı Chrome profilinde çalıştırır; yerel test tahtası/motor yanıtları/ses köprüsü kullanır. Yirmi sentetik oyunla dönemler, aynı hamleli yeni oyunlar, yenileme, dışa aktarım ve silme sınanır. Gerçek motor regresyonları Node testlerinde ayrıca vardır.

Saha geri bildirimi: sürüm, işletim sistemi/Chrome, paket türü, renk, oyun türü/süresi, beklenen ve görülen davranış, hamle numarası ve test notları JSON'unu ekleyin. Fiziksel ses ve güncel Chess.com DOM uyumluluğu gerçek cihazda teyit edilmelidir.

## 0.12.1 — ses kesilmesi regresyonları

- [ ] Sesi dene eski bağlantıyı bırakıp yeni deneme başlatsın.
- [ ] Bozulan port ve heartbeat geçici hatası sonrası yeni bağlantı kurulabilsin; eski hata yeni okumayı etkileyemesin.
- [ ] Hata sürerse sonsuz deneme olmasın; sonraki güncel bilgi bekleme aralığından sonra tekrar denenebilsin.
- [ ] Eksik Türkçe ses, izin veya hesap kısıtı otomatik aşılmaya çalışılmasın.
- [ ] Başlamayan istek diğer sekmeleri sonsuza kadar meşgul tutmasın; çalışan başka sekmenin konuşması korunabilsin.
- [ ] Test notlarında ses bağlantı izi bulunsun; fiziksel duyma ayrıca teyit edilsin.

## 0.13.1 — kenar paneli ve sesle eşleşen çizimler

### Yerleşim ve okunabilirlik

- [ ] Odak görünümünde boş sağ alan varsa panel tahtanın sağında yerleşsin. İlk genişlik 360 px olsun.
- [ ] Normal görünümde tanınan site sütunu veya saat alanı panelin altında kalmasın. Sağda yer yoksa sol boşluk değerlendirilsin.
- [ ] İki kenar da dar olduğunda panel tahtanın altında ayrı konuma geçsin. Kaydırma/pencere genişletme ihtiyacı açıklansın. Sitenin sabit düzeninde erişimi gerçek cihazda teyit edin.
- [ ] Pencere boyutu, odak görünümü, tahta boyutu veya yönü değişince yerleşim/oklar yeniden hesaplansın. Tahta küçültülmesin ve hamle yapılmasın.
- [ ] Genişlik 280–480 px, yazı 14–20 px arasında değişsin. Alan yetersizken genişlik esneyebilsin; yazı kendiliğinden küçülmesin.
- [ ] Sistem/açık/koyu tema ve otomatik/sağ/sol kenar tercihi çalışsın. Yerleşim tercihi güvenli boşluğa öncelik versin.
- [ ] Ayarlar sayfa yenilemede korunsun. Varsayılanlara dönme yalnızca bu görünüm/anlatım ayarlarını değiştirsin; kayıtları ve ses kategorilerini silmesin.
- [ ] Örnek 21.Nc5+ konumunda ana yorum ve birinci aday panelde ilk bakışta okunabilsin. Ayrıntılar tek açılır alanda, ayarlar tek alt menüde olsun.

### İçerik ve korunan özellikler

- [ ] Yorum / Plan / Rakip sekmelerinin seçimi ve klavyeyle gezinmesi çalışsın. Q/W/E aynı bölümleri dinletsin; panel kendiliğinden büyümesin.
- [ ] Adaylar 1–3 sırası, kısa nedenleri, gerekçe/devamları ve tek adayın plan oklarıyla erişilebilir kalsın.
- [ ] Konum değişimi B, karşılaştırma F, tam açıklama G, dereceler T, taktik R ve ipucu H görevleri korunsun. V son duyulan açıklamayı tekrarlasın; C durdursun.
- [ ] Küçültülünce değerlendirme, son derecenin hamle numarası, kritik uyarı ve ses durumu görünsün; bütün tek tuşlar çalışsın.
- [ ] Menüde tüm konuşma/efekt kategorileri, ses denemesi/hızı/seçimi, kısayollar, geri bildirim, test notları, maç raporu, son-10 gelişim, sonuç kaydetme ve kayıt yönetimi bulunsun.
- [ ] Paneldeki bir düğmeye bastıktan sonra tahtaya tıklamak kısayolların tekrar çalışmasını sağlasın. Yazı/form alanlarında kısayol tetiklenmesin.
- [ ] Geçici ses hatasında yeniden bağlantı, başka sekmenin sesini koruma ve açık hata tanılaması 0.12.1 davranışını korusun.

### Renk ve çizgi dili

- [ ] Aday okları eski renklerde kalsın: 1 sarı `#d6f263`, 2 mavi `#68d4e9`, 3 kırmızı/turuncu `#ffa96a`.
- [ ] Ana aday okları önceki boyutunu korusun. Konuşma okları ve devam adımları daha ince olsun.
- [ ] Bir adayın kendi sonraki hamlesi mavi/kırmızıya dönüşerek sıralama anlamını bozmasın; aynı aday rengini kullansın.
- [ ] İki tarafın ok şekli aynı olsun. Tüm oklarda Sen/Rakip yazsın; örnek adımlar Sen · 3/Rakip · 2 olarak aynı font, aynı renk ve 12 px boyutta gösterilsin.
- [ ] Tahta ters çevrilince ok başlangıç/hedefleri doğru karelere dönsün. Geçersiz/eksik kare bilgisi çizim veya `charCodeAt` hatası üretmesin.

### Konuşmayla eşleşme

- [ ] Oklar söz sıraya girdiğinde değil, ilgili parça gerçekten başladığında görünsün. Aynı görseli anlatan komşu cümleler gereksiz yere ayrı seslere bölünmesin.
- [ ] Özgün örnekte A: Nc5+ hamle oku → b7/d7 hedefleri → Kc7 koşullu rakip cevabı → Nxd7 üçüncü adımı doğru sırayla gösterilsin.
- [ ] W planı, E rakibi, Q yorumu, B gerçek konum değişimini, R taktiği ve G ayrıntıyı kendi yasal devam/hedefleriyle gösterebilsin. Çizilecek doğrulanmış veri yoksa ok uydurulmasın.
- [ ] Anlatım boyunca aday okları tamamen gizlensin; çizimsiz cümlelerde/parçalar arasında da geri gelmesin. Bitişte güncel adaylar son açık/kapalı tercihine göre dönsün.
- [ ] Yeni tahta, eşleşme kaybı, durdurma, hata ve yeni elle istek eski konuşmanın çizimini kaldırsın. İptal edilen sözün gecikmiş başlangıç/bitişi bunu geri getirmesin.
- [ ] Aynı konumda aday sırası veya hesaplanan devam değişince eski konuşmanın çizimi yeni sıraya mal edilmesin.
- [ ] Aynı FEN'de başka adayın hesabı değişince hâlâ doğrulanmış anlatım çizimi silinmesin. İlgili adayın sırası/okunan yolu/taktik kanıtı değişirse eski çizim gizlensin.
- [ ] Tahta aynı konumla yeniden çizilip SVG kaldırıldığında anlatım çizimi kendiliğinden geri gelsin; C ile durdurulmuş veya eski konuma ait çizim geri gelmesin.
- [ ] Geçmiş notu veya geçmiş FEN'e ait V tekrarı güncel tahtaya çizim yapmasın. Aynı güncel konumdaki V uygun çizimleri tekrar gösterebilsin.
- [ ] Geçici hatada ikinci parça yeniden deneniyorsa tamamlanmış birinci parçadan başlamasın. Bir konuşmanın tekrara karşı hafızası her parçada tekrar yazılmasın.

### Kullanıcı denetimi ve gizlilik

- [ ] Kapalı modda otomatik çizim olmasın; elle aday okları çalışsın.
- [ ] Yalnızca taktik/tehdit modunda sıradan e4 önerisi çizilmesin; doğrulanmış çatal/mat/alış tehdidi çizilebilsin.
- [ ] Bütün açıklamalar modunda doğrulanmış konumsal hamleler de izlenebilsin.
- [ ] Aday okları kapalıyken A/S/D/Q/W/E kendi doğrulanmış çizimlerini geçici göstersin; konuşma bitince kaybolsun. Aynı altı tuş adaylar açıkken de denensin; konuşma bittiğinde güncel adaylar dönsün.
- [ ] Konuşurken Boşluk veya ↗ kullanmak anlatım çizimlerini değiştirmesin; aday katmanını göstermesin. Yalnızca konuşma sonrasındaki açık/kapalı tercih değişsin.
- [ ] Hedef/fikir düzeyinde görünmeyen hamleler otomatik oklarla açığa çıkmasın. A/S/D ile özellikle istenen aday istisnası yalnızca o okumaya uygulansın.
- [ ] Çizimler bittiğinde seçili ipucu düzeyi kendiliğinden ilerlemesin. Adaylar, oyuncu taşlarını tıklayana kadar otomatik hamle yapmasın.
- [ ] Tanılama dışa aktarımında `health.panel`, `health.narration` ve mevcut ses/tahta bilgileri bulunsun. Veriler kendiliğinden dışarı gönderilmesin.
- [ ] Önceki maç kayıtları/gelişim/kısayollar korunsun. Yeni görünüm için uzantıyı kaldırmayın; kurulu klasörü yerinde güncelleyip Yeniden yükle kullanın.

Yerel doğrulama komutları: `npm test`, `npm run test:voice`, `python3 diagnostics/ui-smoke.py`, `python3 diagnostics/ui-smoke.py --integration`, `python3 diagnostics/ui-smoke.py --panel`. Son komut gerçek derlenmiş panelde sağ/sol/alt yerleşim, yön, ayar kalıcılığı, üç renk ve konuşma çizimi sırasını sınar; motor ve ses köprüsü test verisidir. Gerçek Chess.com, macOS/Chrome sesinin duyulması ve akıcılık ayrıca teyit edilir.
