# Kare Kare 0.13.1 — satranç koçu

## 0.13.1 — yeni kenar paneli ve anlatımı izleyen oklar

Koç, görünür tahta ile saat/koordinat alanlarını kapatmadan kullanılabilir kenara yerleşir. Odak görünümünde önce sağdaki boşluk kullanılır; normal görünümde tanınan site sütunları hesaba katılır. Yer yoksa diğer kenar, iki kenarda da alan yetersizse tahtanın altında ayrı konum seçilir. Bu durumda sayfayı kaydırmak veya pencereyi genişletmek gerekebilir; sayfanın sabit/taşan düzenleri gerçek Chess.com üzerinde ayrıca sınanmalıdır. Tahta küçültülmez.

Ana alanda **Yorum / Plan / Rakip** sekmeleri vardır. Önemli uyarı, değerlendirme, son derecenin hamle numarası ve ses durumu üstte kalır; küçültülünce de görünür. Adayların kısa gerekçeleri ve açılan devamları korunur. Tek bir ayrıntı bölümü tam yorumu ve aday karşılaştırmasını sunar. **Koç menüsü**, raporları, gelişimi, kayıtları, bütün ses/efekt seçeneklerini ve kısayolları içerir. Başlıktaki ☰ aynı menüye hızlı erişir.

**Koç menüsü → Ses ve görünüm seçenekleri → Panel ve anlatım okları**:

- Genişlik: 280–480 px (başlangıç 360); yorum yazısı: 14–20 px.
- Tema: sistemle aynı / açık / koyu; tercih edilen kenar: otomatik / sağ / sol. Alan yetersizse tercih güvenli yerleşim lehine esner.
- Konuşmayı oklarla takip et: kapalı / yalnızca taktik ve tehditler / bütün açıklamalar. Varsayılan bütün açıklamalardır. Ayarlar bu Chrome profilinde saklanır.

Adayların mevcut renkleri aynıdır: **1 sarı (`#d6f263`), 2 mavi (`#68d4e9`), 3 kırmızı/turuncu (`#ffa96a`)**. Boyutlar korunur; konuşma çizimleri ve sonraki adımlar daha incedir. Aynı adayın kendi devamı başka bir sıralama rengine dönmez. İki taraf da aynı düz ok şeklini kullanır. Her okta **Sen** veya **Rakip**, örnek devamda **Sen · 3** / **Rakip · 2** etiketi bulunur. Etiketlerin yazı tipi, rengi ve boyutu aynıdır (tahtada 12 px). Adım numarası koşullu bir örnek devamı gösterir; hamlenin gerçekleştiği anlamına gelmez.

Çizimler, aynı doğrulanmış konumun yasal devamı ve kanıtlı hedefleriyle üretilir. İlgili konuşma parçası gerçekten başladığında değişir: örneğin Nc5+ oku → şah ve vezir hedefleri → koşullu şah cevabı → veziri alma devamı. Sırada bekleyen söz çizilmez. Aday okları anlatım boyunca tamamen gizlenir; çizimsiz cümlelerde ve parçalar arasındaki beklemede de geri gelmez. Okuma tamamlandığında güncel konumun adayları, son açık/kapalı tercihin doğrultusunda geri gelir. Konuşma durursa, hata olursa veya tahta değişirse otomatik katman temizlenir. Geçmiş konum notları güncel tahtaya çizim yapmaz.

**Boşluk** ve başlıktaki ↗ yalnızca **Hamle okları: Açık/Kapalı** tercihini değiştirir. Aday okları kapalıyken de A/S/D veya Q/W/E ile dinlenen, doğrulanmış açıklamanın okları geçici görünür. Konuşurken Boşluk kullanmak anlatımın yerini adaylarla değiştirmez; konuşma bitince son tercih uygulanır. Anlatım çizimlerini tamamen kapatmak için ayrı **Konuşmayı oklarla takip et → Kapalı** ayarı vardır. Kademeli ipucunda hedef/fikir gizliliği sesli çizimler için de geçerlidir; A/S/D ile özellikle istenen aday kendi çizimini gösterebilir. C konuşmayı ve onun çizimini durdurur. Elle açık aday okları ayrı tutulur.

Plan ve ayrıntılı kabul: [ARAYUZ-VE-ANLATIM-PLANI.md](ARAYUZ-VE-ANLATIM-PLANI.md), [ACCEPTANCE-CHECKLIST.md](ACCEPTANCE-CHECKLIST.md). Eski analiz, ses toparlanması, kayıt, gelişim ve 15 tek tuş özelliği bu sürümdedir.

## Ses düzeltmesi (0.12.1)

Maç kayıtlarını ve ayarları korumak için önce kayıtları dışa aktarın; kurulu uzantıyı kaldırmak veya başka bir klasörden yeni kopya yüklemek yerine mevcut uzantı klasöründeki dosyaları bu pakettekilerle güncelleyip `chrome://extensions` üzerinden **Yeniden yükle** kullanın. Ardından oyun sekmesini yenileyin. Aynı Chrome profili ve aynı klasör yolu korunmalıdır.

**Sesi dene** ses bağlantısını sıfırlayıp yeniden kurar. Geçici bağlantı/başlatma hatası sonraki bütün hamleleri sessiz bırakamaz; yeni güncel bilgiyle, bekleme aralığına uyarak yeniden denenir. Otomatik sınırsız tekrar yoktur. Hata sürerse **Koç menüsü → Test notlarını indir** dosyasında `health.audio.transport` bölümünü paylaşın; hangi aşamada yanıt kesildiği görülebilir. Mac/Chrome'un konuşma hizmeti tamamen yanıtsızsa uzantı bunu her zaman onaramaz; maç bittikten sonra Chrome'u tamamen kapatıp yeniden açarak da sınayın. Fiziksel ses için ekip teyidi gerekir.

## Korunan koçluk ve gelişim özellikleri

Konumda değişenleri anlatma, hamleler boyunca plan hafızası, iki güçlü adayı karşılaştırma, koşullu rakip yorumları, maç içinde hedef → fikir → hamle yardımı, yerel son-10-maç gelişim raporu ve 15 özelleştirilebilir tek tuş eklendi. Ayrı alıştırma yoktur. Her özelliğin ayrıntılı denemesi: [kabul kontrol listesi](ACCEPTANCE-CHECKLIST.md).

**Boşluk** oklar; **Q** yorum; **W** plan; **E** rakip; **A/S/D** adaylar; **R** taktikler; **V** son açıklama; **C** durdur; **H** sonraki ipucu; **F** iki adayı karşılaştır; **G** tam açıklama; **T** dereceler; **B** değişim. Menüden değiştirilebilir. Kısayollar panel küçültülmüşken çalışır; yazı alanlarında çalışmaz. Chess.com'un X/Z işlevleri korunur.

**Koç menüsü → Son 10 maç / gelişim** ilk on maçtan itibaren dönem özeti, yirminci maçtan itibaren birbirini izleyen iki onluk dönemin karşılaştırmasını sunar. Son 10 özeti kayan penceredir; dönemler çakışmaz. Hata sıklığı değerlendirilen kendi hamlelerine göre hesaplanır; kapsam ve koşul farkları belirtilir. Önceki sürümlerdeki maçlar kendiliğinden eklenmez. Hesap başına son 100 tamamlanmış/8 aktif oyun yerel tutulur. **Maç kayıtları** bölümünden kayıt kapatılabilir, sonuç girilebilir, veriler indirilebilir veya onayla silinebilir. Chrome profilleri ve farklı uzantı kimlikleri kayıtlarını paylaşmaz.

## Bot maçında kullanma

Uzantı Chrome'a paketlenmemiş olarak yüklendiğinde Chess.com'un **Bilgisayara Karşı Oyna** sayfasında açılır. Hamlelerden sonra konumu, rakibin fikrini ve 2–3 aday devamı anlatır. **Hamle okları: Açık/Kapalı** ile devamları tahtada görebilirsin. Bir taşa tıklayıp hamle seçerek **Hamleyi incele** düğmesiyle alternatifini açıklatabilirsin. Ayarlar ve diğer işlemler panelin altındaki **Koç menüsü** içindedir. Ana alanda yorum ve adaylar görünür; her adayın **Gerekçe ve devam** kısmını istediğinde açabilirsin.

Analiz motoru yanıt vermezse koç bağlantıyı kendiliğinden yeniden kurup hesaplamayı bir kez daha dener. Yine sonuç alamazsa tahtadan okuyabildiği kısa yorumu gösterir; **Tekrar dene** düğmesiyle mevcut konumu yeniden hesaplatabilirsin.

Bir yorum faydalı, gereksiz veya hatalı geldiyse **Koç menüsü** içinden işaretle. **Test notlarını indir** düğmesi işaretlediğin konumları JSON dosyası olarak verir. Dışa aktarılan dosya hamleleri, değerlendirmeleri, son konum hesaplarını ve kritik notları da içerir. Bu kayıtlar yalnızca Chrome'un yerel uzantı deposunda tutulur; Kare Kare dışarı veri göndermez.

## Korunan analiz ve ses özellikleri

Bu sürüm on hamle derecesi, daha az tekrar eden konuşma ve kısa uyarı efektleri ekler. **Koç menüsü → Ses ve görünüm seçenekleri → Konuşma yoğunluğu** altında Dengeli / Tüm dereceleri oku / Yalnızca önemli dereceler seçilir. Dengeli modda aynı sıradan derece kısa aralıklarla tekrar okunmaz; bütün dereceler panelde kalır. Oyuncu kimliği içeride korunur; konuşma her cümleye “Senin son hamlen/Rakibin son hamlesi” eklemez. Geçmiş konum işareti korunur. Seçim hamle derecelerini etkiler; taktik ve öneri kanalları kendi kutularıyla yönetilir.

**Kısa uyarı efektleri**, konuşmadan bağımsız açılır ve varsayılan kapalıdır. Mat tehlikesi, doğrudan taktik fırsatı, büyük hata ve tahta bağlantısı için ayrı tonlar vardır. Efekt düzeyi ve kategoriler seçilir. **Efekti dene** ile sesi başlatıp dört tonu dinleyebilirsin. Yenilenen sayfada kayıtlı tercih açık olsa da ses çıkışını bu düğmeyle başlatmak gerekebilir. Aynı olay yeniden çalmaz; hızlı olaylar sınırlandırılır. Bağlantı sesi için kayıp iki saniye sürmelidir; kısa taş animasyonları sessiz kalır. Geçmiş ve koşullu taktikler için güncel alarm üretilmez. Konuşurken efekt daha düşük düzeyde çalar.

Yeni taktikler: **açarak saldırı, açarak şah, çifte şah, savunucuyu ortadan kaldırma, savunucuyu uzaklaştırma ve ara şah**. Kazanç gerektiren fikirlerde hesaplanan yasal devam ve alış bilançosu aranır. Bunlar sınırlı kanıt arayan tanıyıcılardır; uyarı çıkmaması bir taktiğin bulunmadığını kanıtlamaz. Aşırı yüklenme, araya girme ve zugzwang bu teslimde otomatik tanınmıyor.

On derece: **Harika, Çok iyi, Kitap, En iyi, Mükemmel, İyi, Yanlışlık, Hata, Kaçırılan hamle, Büyük hata**. Bunlar Kare Kare ölçütleridir. Koç düzeltmesi ayrı bir durumdur. Kitap, yerel referanstaki 20 kısa açılış örneğiyle sınırlıdır; tam açılış veritabanı değildir. Harika etiketi, hesaplanan devamda somut taş fedası ve yeterli değerlendirme/alternatif hesabı gerektirir; her feda harika sayılmaz. Sayısal kayıp eşikleri: en iyiye yakın seçenek için en fazla 15, iyi için en fazla 55; 55’ten fazla ve 100’den az kayıp yanlışlık, 100–199 kayıp hata, 200 ve üstü büyük hata temelidir. Somut taktik kaçması ve zaten çok üstün konum gibi durumlar ayrıca değerlendirilir. Birimler piyonun yüzde biridir; puan/kazanma yüzdesi değildir.

**Doğal ses denemesi:** Chatterbox karşılaştırması için ayrı yerel araç hazırlanmıştır; uzantıda henüz Chrome TTS kullanılır. Kurulum ve ölçüm: dağıtımın `NATURAL-VOICE-EXPERIMENT.md` dosyası veya kaynakta `diagnostics/NATURAL-VOICE-EXPERIMENT.md`. Bu ek, modelin test bilgisayarında çalıştığı veya daha doğal olduğunun kanıtı değildir.

**Hızlı hamlelerde konuşma bağlamı:** Olası taktik cevaplar, önerilen ilk hamle belirtilerek koşullu anlatılır. Konum değişince eski konuşma durur. Yakın geçmişteki önemli bilgiler, “Geçmiş konum” başlığıyla kısa ve geçmiş zamanlı bir nota dönüşebilir; eski öneri güncel talimat olarak okunmaz. Güncel kritik bilgiler geçmiş notlarından, güncel mat uyarısı diğer konuşmalardan önce gelir. Üstteki küçük **Ses:** satırı okunan bilginin bağlamını gösterir; küçültülmüş panelde de görünür.

Ses kuyruğunda en fazla iki geçmiş özeti tutulur. İki yarım hamleden fazla geride kalan veya 12 saniyeden uzun süredir bekleyen geçmiş notları otomatik okunmaz; yazılı **Kritik notlar** kaydı korunur. Bu ilk eşikler test geri bildirimleriyle ayarlanabilir. Elle başlatılan uzun okuma, konum değişince durur. Renk seçimi değişince önceki bakış açısındaki ses kuyruğu temizlenir. Sonraki geliştirme önerileri: [geliştirme planı](GELISTIRME-PLANI.md).

**Meşgul uyarısı düzeltmesi:** Sistemin genel “konuşma var” bilgisi artık koçu başlatmadan engellemiyor. İstek, Chrome'a sıraya alınarak gönderiliyor. Gerçekten başka bir Kare Kare sekmesi konuşuyorsa bu ayrı bir mesajla belirtiliyor. İptal edilen eski bir isteğin hatası yeni konuşmanın durumunu değiştirmiyor. Panelin altındaki sürüm numarasıyla hangi kopyanın çalıştığını kontrol edebilirsin.


Ses düzeltmesi: Konuşma artık sayfadaki Web Speech çağrıları yerine Chrome'un uzantı ses hizmetiyle üretilir. Paket **storage + tts** izinlerini kullanır; **tts** konuşma üretmek içindir, mikrofon erişimi değildir. Chrome 101 veya sonrası gerekir. Yalnızca yerel, başka uzantı tarafından sağlanmayan Türkçe sistem sesleri seçilir; harici ses servisine veya bulut sesine geçilmez. Türkçe sistem sesi yoksa bu açıkça gösterilir.

**Güncellemeden sonra:** Kayıtları dışa aktar; kurulu klasördeki dosyaları 0.13.1 paketiyle güncelleyip aynı uzantı kartında Yeniden yükle kullan. Ardından Chess.com sekmesini yenile. **Koç menüsü → Ses ve görünüm seçenekleri → Sesi dene** düğmesine bas. Hata sürerse aynı bölümdeki tam açıklamayı ve test notları JSON'unu paylaş. Ses tanılamasında motor `chrome-tts` görünmelidir. İşletim sistemi/ses çıkışı veya Türkçe sesin yüklü olup olmaması ayrıca kontrol gerektirebilir.


- Ana yorum kısadır. Ayrıntılı takas ve devam açıklamaları **Ayrıntılı açıklama ve karşılaştırma** içinde açılır. **Açıklamayı dinle**, tam açıklamayı okur.
- Sesi açınca kısa bir deneme cümlesi duyulur. Menüde **Ses başlatılıyor**, **Konuşuyor** veya **Ses başlayamadı** durumu görünür. Geçici başlatma hatasında bir kez yeniden deneme yapılır; Türkçe sesin eksikliği veya meşgul ses hizmeti gibi durumlar doğrudan bildirilir. **Sesi dene** ile yeniden deneme yapabilirsin. Bu durum, işletim sistemi hoparlörünün ses düzeyini ölçmez.
- Maç kimliği belli olan canlı/günlük oyunlarda doğrulanmış geçmiş yerel olarak saklanır. Aynı maç yenilenince görünür taşlarla eşleşiyorsa geri yüklenir. En fazla son 8 maç ve 12 saatlik kayıtlar kullanılır. Oyun, hesap ve geçmiş uyuşmazsa kayıt kullanılmaz. Bu özellik lobi/bot adreslerini maç kimliği saymaz ve canlı erişim kısıtlarını değiştirmez.
- İlk kez geçmiş görünmeden açılan bir maç veya yenileme sırasında ikiden fazla yarım hamle ilerleyen bir konum için odak görünümünü kapatıp hamle listesini açmak gerekebilir. Yeni sürüm, saklama yapabilmek için önce o maçı bir kez doğrulamış olmalıdır. Eski 0.9.0 sürümü böyle bir kayıt tutmuyordu.
- **Test notlarını indir**, henüz not veya hamle değerlendirmesi yokken de çalışır; ses durumu, sayfa yolu, eşleşme durumu ve Chrome/işletim sistemi bilgisi içeren tarayıcı tanıtıcısını dosyaya ekler. Veriler dışarı otomatik gönderilmez.


- Plan ile aday aynı hesaplanan devamdan üretilir. Bir taşın alınabilmesi tek başına kazançlı tehdit sayılmaz; yasal alışlar ve yerel takas hesabı kontrol edilir. Ana aday doğrudan savunma yerine karşı oyun seçiyorsa bu açıkça belirtilir.
- Alış açıklamaları, mümkün olduğunda verilen ve alınan taşları ve yerel maddi bilançoyu gösterir. Rapordaki devamlar hamle numaralıdır; aynı piyona bakan at ile kalenin alışları arasındaki fark ayrıca bir takas dersi olarak çıkabilir. Maddi bilanço konumsal değerlendirme değildir; motor bazı durumlarda fedayı tercih edebilir.
- Açmazın yalnızca geometrisini görmek yeterli sayılmaz. Koç, hesaplanan devamda açmaz sürerken kazançlı bir alışla kullanıldığını gösterebildiğinde onu açmaz fırsatı olarak sunar. Bu temkinli filtre bazı geçerli uzun planları göstermeyebilir.
- Üstteki değerlendirme barında puan **Beyaz açısından** gösterilir: artı Beyaz, eksi Siyah üstün demektir. Bu bir oyuncu puanı veya kazanma yüzdesi değildir.
- Motor bulduğunda en fazla **5 hamlede zorunlu mat** uyarısı çıkar. Çatal, açmaz ve şiş fikirleri iki taraf için gösterilir. Rakibin önerilen hamlene verebileceği taktik cevap, koşullu olduğu açıkça belirtilerek sunulur; henüz sırası olmayan tarafa fazladan hamle verilmez.
- İki tarafın son hamleleri yukarıdaki on sınıfla değerlendirilir. **Bu değerlendirme neden verildi?** ile gerekçeyi aç. Yeterli hesap yoksa etiket verilmez; her iyi hamle “Harika” olmaz.
- **Koç menüsü → Ses ve görünüm seçenekleri** içinde öneri, derecelendirme, mat, çatal, açmaz ve şiş seslerini ayrı ayrı seç. Mevcut yerel Türkçe sistem seslerinden birini seçebilir, konuşma hızını değiştirebilir ve **Sesi dene** ile dinleyebilirsin. Kalite, Chrome ve bilgisayarındaki seslere bağlıdır; harici bir ses servisi eklenmedi. Bazı seslerin “mat” kelimesini kısaltma sanmasını azaltmak için okunan metinde “şah matı” kullanılır; ekrandaki satranç metni değişmez. Tercihler kaydedilir; yeni sayfada otomatik konuşmayı **Ses kapalı** düğmesine basarak başlat.
- Kritik mat/taktik bilgileri ve önemli hamle değerlendirmeleri yazılı **Kritik notlar** bölümünde tutulur. Hızlı hamlelerde eski konuşma güncel uyarıya karışmaz; uygun yakın geçmiş notu kısa ve geçmiş zamanlı okunabilir. Sesin kapatılması okumayı durdurur.
- Yalnızca ana öneriye yakın güçteki hamleler güçlü seçenek olarak gösterilir; bazen üçten az aday çıkar. Koçun gösterdiği bir adayı oynadığında sonraki hesap farkı sana hata olarak yüklenmez. Yeni bir zorunlu mat önceki öneriyi çürütürse **Koç düzeltmesi** gösterilir.
- **Boşluk** koç küçültülmüşken de okları açıp kapatır. **Koç menüsü → Tek tuşlu kısayollar** bölümünden 15 görevin tuşlarını değiştirebilirsin. X/Z Chess.com işlevlerine bırakılır. Yazı ve form alanlarında kısayollar çalışmaz; başlıktaki ↗ düğmesi de okları yönetir.
- **Kademeli ipucu** önce hedefi gösterir. H ile fikir, tekrar H ile somut hamle açılır. Yeni konumda düzey sıfırlanır. Gizli hamleler otomatik konuşmada da açıklanmaz; A/S/D ile özellikle istediğin aday dinlenebilir. Boşluk ile yalnızca o konumun oklarını ayrıca gösterebilirsin.
- **Koç menüsü → Maç raporu**, değerlendirilen hamlelerinden somut örnekler, güçlü seçimler ve hataların nedenlerini verir. Raporu hamlelerle birlikte indirebilirsin. Ayrı bulmaca veya alıştırma yoktur. Terk ya da süre bitişi otomatik algılanmazsa bu düğmeyi kullan. Arkadaki hamle hesapları tamamlandıkça açık rapor güncellenir. **Yeni oyun** düğmesi kaldırıldı; yeni oyun Chess.com üzerinden başlatılır.

Tahta eşleşmesi bozulursa eski hamleler, oklar ve puan temizlenir. Hamleler sekmesini açık tut; koç yeniden eşleştirmeyi dener. Konum doğrulanmadan öneri üretmez. Motor araması sınırlı olduğu için uyarı çıkmaması konumda taktik veya mat bulunmadığını kanıtlamaz. Ayrıntılar: [sürüm notları](RELEASE-NOTES.md).

## Kurulum

1. `manifest.json` dosyasının bulunduğu klasörü bilgisayarında tut.
2. Chrome'da `chrome://extensions` sayfasında **Geliştirici modu**nu aç.
3. **Paketlenmemiş öğe yükle** ile bu klasörü seç. Önceki Kare Kare sürümü yüklüyse onu kapat; aynı sayfada iki koç çalışmasın.
4. Bot oyunu sayfasını yenile.

Bu standart paket yalnızca bot sayfalarına erişir. Canlı insan maçları için geliştirme altyapısı kaynak kodunda bulunur, fakat bu pakette kapalıdır. Standart satranç başlangıcından başlayan oyunlar desteklenir. Chess.com'un sayfa yapısı değişirse tahta okuma uyarlaması gerekebilir.

## Geliştirici notu

`npm ci && npm test && npm run build` ile kaynaklardan uzantı klasörü `extension/dist` altında oluşur. Derleme ve dağıtım, bot manifestinin izinlerini ve gerekli stil/motor ayarlarını doğrular. `KARE_LIVE_ENABLED=1` ile oluşturulacak ayrı test paketi, izinli hesap listesi ve bitiş tarihi olmadan derlenmez; varsayılan derleme bot sürümüdür. Canlı ve günlük oyun sayfaları için genel tahta okuma katmanı hazırdır; gerçek maçlarda etkinleştirilmeden önce her sayfa türünde doğrulanmalıdır.

Chess.com inceleme paketi `npm run package:review` ile oluşturulur. Bunun için `KARE_LIVE_ACCOUNTS` (virgülle ayrılmış test hesapları), `KARE_LIVE_FROM` ve `KARE_LIVE_UNTIL` (saat dilimli ISO tarihleri) ortam değişkenleri zorunludur. Paket `extension/dist-review` ve `release/kare-kare-chesscom-review-v0.13.1` altında oluşur; bot paketini değiştirmez. İnceleme paketinde uzantı simgesinden açılan tanılama ekranı bulunur; kurulum ve test yönergesi ZIP içindedir. Proje sahibinin üç hesabı derleme ve çalıştırma sırasında engellenir. Hesap listesi verilmeden canlı/günlük maçlarda çalışan paket üretilmez.

Proje lisansı GPL-3.0. Stockfish.js 19.0.1 kaynakları: https://github.com/nmrugg/stockfish.js/tree/19.0.1. chess.js lisansı BSD-2-Clause.
