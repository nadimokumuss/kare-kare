# Yerel doğal ses denemesi

Bu deney uzantıdan ayrıdır. Chatterbox henüz uzantının ses motoru değildir; çalışan Chrome TTS yolu korunur. Aşağıdaki komutların hiçbiri Chess.com'a veya maçlara erişmez. Modeli ilk kez kullanmak internetten bağımlılık ve model indirilmesini gerektirir; model üretimi yereldir. API anahtarı gerekmez.

## 1. Yelda karşılaştırma kaydı (macOS)

Kaynak paketinden çalışıyorsan önce `source` klasörüne gir. Proje kökünde:

```sh
python3 diagnostics/benchmark-voices.py --backend system
```

Ses adı sistemde farklıysa `say -v '?'` ile bakıp `--voice 'ses adı'` ver. Sesler hoparlörde çalınmaz; WAV dosyalarına yazılır. Boş veya sessize yakın kayıt başarısız sayılır. İlk cümle sonda tekrar üretilerek soğuk/sıcak farkı ayrılır.

## 2. Chatterbox Multilingual (isteğe bağlı, ayrı ortam)

Bu adım büyük bağımlılıklar ve model dosyaları indirebilir. Önce gerekli disk alanını ayır. Projenin npm bağımlılıklarına eklenmez:

```sh
python3.11 -m venv .venv-voice
.venv-voice/bin/python -m pip install chatterbox-tts
.venv-voice/bin/python diagnostics/benchmark-voices.py --backend chatterbox --device cpu
```

Python 3.11, projenin resmî geliştirme ortamıdır. macOS/M4 için kurulum ve hız ayrıca doğrulanmalıdır. CPU taşınabilir başlangıçtır. Kurulum çalışıyorsa MPS desteğini ayrı klasörde denemek için:

```sh
.venv-voice/bin/python diagnostics/benchmark-voices.py --backend chatterbox --device mps --output release/voice-comparison-mps
```

MPS seçimi hız garantisi değildir; hata raporlanır, gizlice başka arka uca geçilmez. `--validate-only` model indirmeden örnekleri ve argümanları kontrol eder. Hatalı kaydın dosyası silinir ve JSON raporuna hata yazılır. Kullanılan paket sürümü, cihaz seçimi ve model yükleme süresi kaydedilir. Cihazda model yoksa ilk yükleme süresine indirme de dahildir.

## 3. Dinleme sayfasını oluşturma

```sh
node scripts/build-voice-comparison.mjs release/voice-comparison/report-system.json release/voice-comparison/report-chatterbox.json
```

`release/kare-kare-ses-karsilastirma.html` dosyasını Chrome'da aç. Aynı cümleyi iki sesten dinleyip doğallık/telaffuz puanlarını ve eksik/fazla sözcükleri kaydet. JSON'u indir; otomatik gönderim yoktur. Yalnızca sistem kaydı hazırsa komuta sadece o raporu ver; eksik alternatif açıkça belirtilir. Sayfa ses dosyalarını içine gömer ve dış kaynağa bağlanmaz.

Üretim süresi bütün WAV'ın hazırlanma süresidir; Chrome'da ilk sesin duyulma gecikmesini veya canlı hamlede iptal başarısını ölçmez. Bu ikinci aşama, ses seçildikten sonra yapılmalıdır. Modelin ürettiği sözler kullanıcı dinlemesiyle doğrulanır; RMS ölçümü doğru telaffuz edildiğini göstermez.

## Kaynaklar ve kapsam

- Model ve Türkçe desteği: https://huggingface.co/ResembleAI/chatterbox
- Kurulum, kaynak ve MIT lisansı: https://github.com/resemble-ai/chatterbox
- Piper ses modellerinin koşulları ayrı incelenir: https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/VOICES.md

Bu deneyde başka bir kişinin sesini klonlama veya uzaktan ses servisi kullanma eklenmemiştir.
