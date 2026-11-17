# Bağımsız ses denemesi

`release/kare-kare-bagimsiz-ses-denemesi-v2.html`, uzantı güncellemeden hedef Chrome'da açılabilen, tek dosyalık bir tanılama aracıdır. Uzantıya ve Chess.com'a bağlanmaz. İçine gömülen kayıt Yelda sistem sesiyle önceden üretilmiştir; canlı denemeler yalnızca yerel Web Speech seslerini kullanır.

1. Dosyayı sorunun yaşandığı Chrome ile aç.
2. Kayıtlı Türkçe sesi çal ve gerçekten duyup duymadığını işaretle.
3. Yelda/Türkçe canlı sesi dene. Takılırsa sayfadaki Konuşmayı durdur düğmesini kullan.
4. Yelda'dan farklı yerel sesi dene ve duyma yanıtını işaretle. Sayfa önce Samantha/Daniel gibi bir İngilizce ses seçer; Türkçe ses ve Yelda bu denemeden hariç tutulur.
5. Ses adı seçmeden otomatik Türkçe denemesini yap. Bu çağrıda ses nesnesi atanmaz; yalnızca `tr-TR` dili verilir.
6. Ses raporunu indir. Rapor kendiliğinden gönderilmez.

İlk raporda kayıtlı ses duyulmuş, Yelda başlangıç olayı gelmeden 20 saniye beklemiştir. V1'de varsayılan ses de Yelda olduğundan iki ayrı ses sınanmamıştı. V2 bu seçimi düzelterek farklı ses ve otomatik dil seçimini ayrı raporlar. İlk rapor bu nedenle bütün Chrome seslerinin bozuk olduğunu kanıtlamaz.

Ses olayının gelmesi, fiziksel sesin duyulduğunu kanıtlamaz; bu nedenle duyma yanıtları ayrı tutulur. Kayıt çalışırken canlı seslerin çalışmaması sorunu genel ses çıkışından konuşma hizmetine doğru daraltır. Her iki yolun çalışması ise uzantı içindeki akışın ayrıca incelenmesini gerektirir. Bu sonuçlar tek başına kesin kök neden değildir.

Kaynağı yeniden hazırlamak için gerçek, sessiz olmayan bir WAV örneğiyle:

```sh
node scripts/build-audio-probe.mjs /absolute/path/to/turkish-sample.wav
```

Kaynak HTML içindeki yer tutucu bu komutla gömülü ses verisine çevrilir. Üretilen dosyanın JavaScript sözdizimi, gömülü WAV verisi ve dış kaynak içermemesi yerel olarak doğrulanmıştır; hedef Chrome 155/Yelda üzerinde ses çıktısı henüz doğrulanmamıştır.
