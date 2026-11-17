# Kare Kare

Chess.com için Türkçe satranç koçu uzantısının kaynakları. Kullanım ve kurulum: [uzantı kılavuzu](extension/README.md). Kapsam, aşamalar ve kabul ölçütleri: [geliştirme planı](extension/GELISTIRME-PLANI.md).

Hazır test sürümü: **0.13.1**. Türkçe konum yorumları, aday hamleler, on hamle derecesi, taktik uyarıları, konuşmayla eşleşen tahta çizimleri, yerel maç kayıtları ve gelişim karşılaştırmaları içerir. Uzantı analiz için yerel Stockfish.js, ses için Chrome TTS kullanır.

- Bot paketi: `npm run package`
- Yetkili inceleme paketi: gerekli hesap ve test dönemi değişkenleriyle `npm run package:review`
- Üretilen dosyalar yerel `release/` klasörüne yazılır; derleme ve paket çıktıları depoya eklenmez.
- Doğal ses deneyi: [kurulum ve ölçüm](diagnostics/NATURAL-VOICE-EXPERIMENT.md)

Varsayılan dağıtım bot oyunlarıyla sınırlıdır. İnceleme paketi yalnızca `hisaycheese` hesabı için 24 Ekim 2026 18.00–23 Kasım 2026 18.00 (Türkiye saati) arasında etkinleşir; proje sahibinin hesapları kapalıdır. Kurulum/test yönergesi ZIP içindedir. Chrome kurulumu bu sürüm hazırlanırken değiştirilmedi. Bu çalışma alanında önceki web sitesi bulunmaz.

Geliştirme: `npm ci`, `npm test`, `npm run build`. Ses deneyi testleri için ayrıca `npm run test:voice`; model indirmeden örnek doğrulama için `npm run voice:validate`. Yerel arayüz kontrolü, derlemeden sonra `python3 diagnostics/ui-smoke.py` ile ayrı geçici Chrome profilinde çalışır.
