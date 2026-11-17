# 0.13.1 — bağımsız hamle okları ve kesintisiz anlatım katmanı

- İki taraf aynı düz ok geometrisini kullanır. Her okta Sen/Rakip; örnek adımlarda Sen · 3/Rakip · 2 etiketi vardır. Yazı tipi, renk, arka plan ve 12 px boyut ortaktır. Mevcut üç aday rengi korunur.
- Boşluk ve ↗ yalnızca beklemedeki hamle oklarını açar/kapatır. A/S/D ve Q/W/E, adaylar kapalıyken de doğrulanmış anlatımlarını geçici çizer. Anlatım modunun kapalı/taktik/tümü ayarı bağımsızdır.
- Anlatım boyunca aday katmanı tamamen gizlenir; çizimsiz cümlelerde ve ses parçaları arasındaki aralıkta da görünmez. Doğal bitiş, C veya hata sonrasında güncel adaylar son açık/kapalı tercihine göre geri gelir. Konuşurken ok tercihini değiştirmek anlatımın yerini adaylarla değiştirmez.
- Aynı FEN'deki ilgisiz arama güncellemeleri artık geçerli çizimi silmez. İlgili adayın sırası, devam yolu veya taktik kanıtı değişirse eski çizim bastırılır. Yeni konum, geçmiş tekrar ve eşleşme kaybı korumaları sürer.
- Sayfanın aynı tahtayı yeniden oluşturup SVG'yi kaldırması otomatik toparlanır. Boyut değişiminde etiketler yeniden ölçülür. Doğrulanmış hamle/hedef bulunmayan cümleler için ok uydurulmaz.
- 164 Node ve 4 Python testi; geçici headless Chrome profilinde 12 kısayol/durum birleşimi, dinleme ortasında aç/kapat, doğal bitiş, durdurma, eski ses olayları, gizli ipuçları, tahta yeniden çizimi ve önceki kayıt/20 oyun akışı sınanır. Motor ve ses köprüsü test verisidir; gerçek sayfa ve duyulan ses için ekip teyidi gerekir.
- Hesap/tarih kapsamı, storage/tts izinleri ve ses altyapısı değişmez. Güncelleme: mevcut kurulu klasörde dosyaları değiştir → aynı uzantı kartında Yeniden yükle → oyun sekmesini yenile. Kayıtları korumak için uzantıyı kaldırmayın veya farklı klasörden ikinci kopya kurmayın.

# 0.13.0 — kenar paneli ve konuşmayla eşleşen çizimler

- Kullanılabilir sağ/sol boşluğa yerleşen 360 px panel; site sütunları, koordinat/saat payı, pencere/tahta değişimi ve kaydırma hesaba katılır. Yetersiz alanda tahtanın altında alternatif konum vardır; site sabit düzenine göre kaydırma veya daha geniş pencere gerekebilir.
- Yorum/Plan/Rakip sekmeleri, okunaklı adaylar, tek ayrıntı alanı, alt menü ve üstte kalıcı değerlendirme/son derece/uyarı/ses durumu. Bir özelliği veya kısayolu kaldırmadan sadeleşme.
- Yerel görünüm ayarları: 280–480 px genişlik, 14–20 px metin, açık/koyu/sistem tema, otomatik/sağ/sol kenar ve varsayılanlara dönme.
- Mevcut sarı/mavi/kırmızı-turuncu aday renkleri ve ana ok boyutları korunur. Aynı adayın devamı sıralama rengini değiştirmez. Rakip cevabı ve örnek devamlar kontrastlı, kesikli, etiketli ve numaralıdır. Okuma çizimleri daha incedir.
- Açıklama, plan, aday gerekçesi, konum değişimi ve taktik/tehdit için konuşma parçalarıyla eşleşen çizimler. Yalnızca gerçek başlangıç olayında gösterme; aynı doğrulanmış FEN, yasal varyant ve mevcut taktik kanıtını kullanma. Konuşma sırasında diğer adayları soluklaştırma.
- Yeni konum, durdurma, iptal, hata, geçmiş notu, aday sıralamasının değişmesi ve gecikmiş ses olayları için görsel korumalar. Yeniden deneme tamamlanan parçaları baştan okumaz. Eksik/uyuşmayan parça metniyle otomatik çizim yapılmaz.
- Konuşma çizimleri kapalı / yalnızca taktik ve tehdit / bütün açıklamalar. Boşlukla kapatılan bütün çizimler kullanıcı tekrar açana kadar yeni sözle geri gelmez. Hedef/fikir gizliliği ve özellikle istenen aday istisnası korunur.
- Aday sesinde kısa gerekçe kullanıldığında sonraki rakip cevabının yanlışlıkla atlanması giderildi. Hamle satırının kendi `data-piece` bilgisinin gözden kaçmasıyla İngilizce şahın Türkçe kale gibi okunması giderildi.
- Önceki ses toparlanması, dereceler/taktikler, efektler, kayıt, 10 maçlık gelişim, raporlar ve bütün tek tuşlar korunur. Kayıtlara anlatım yardımı ayarı/sayacı eklenir. Yeni izin veya servis yoktur; bot/inceleme kapsamı aynıdır.

Kapsamlı plan: ARAYUZ-VE-ANLATIM-PLANI.md. Kabul adımları: ACCEPTANCE-CHECKLIST.md. Yerel Chrome denemelerinde gerçek derlenmiş uzantı, sentetik tahta, taklit motor yanıtları ve taklit ses köprüsü kullanılır. Gerçek Stockfish regresyonları ayrıca çalışır. Fiziksel ses, akıcılık ve güncel Chess.com yerleşimleri ekipte tekrar sınanmalıdır.

Güncellerken veri için mevcut uzantı klasörünü yerinde güncelleyin ve Chrome’daki aynı karttan Yeniden yükle kullanın; başka klasör/uzantı kimliği farklı yerel depodur. Kayıtları önceden dışa aktarın.

Doğrulama: 160 Node regresyon testi, 4 Python ses aracı testi; ayrı Chrome profilinde panel/tercih denemesi, 20 sentetik maçın kayıt akışı ve yeni panel/konuşma çizimi denemesi başarılı. Gerçek cihaz/Chess.com teyidi ayrıca gereklidir.

# 0.12.1 — çalışma sırasında ses kesilmesine karşı toparlanma

- Mesaj gönderirken bozulan ses bağlantısı atılır; yeniden deneme yeni bir Chrome bağlantısı kurar. Konuşma sırasındaki heartbeat kopması da ses kuyruğuna bildirilir.
- Geçici başlangıç/bağlantı hatası, bütün sonraki hamleleri maç boyunca sessiz bırakamaz. Bir anlık tekrar sonrası hata sürerse bekleme uygulanır; yalnızca yeni güncel bilgiyle tekrar denenir. Boşta sonsuz yeniden deneme yapılmaz. İzin/hesap/eksik ses gibi kalıcı hatalar kendiliğinden aşılmaya çalışılmaz.
- **Sesi dene** eski isteği durdurup bağlantıyı sıfırlar; yalnızca aynı isteği tekrar göndermekle kalmaz. Önceki bağlantının gecikmiş olayları yeni isteği etkileyemez.
- Arka plandaki ses hizmeti başlangıç/bitiş olayı gelmeyen kendi isteğini zaman aşımında bırakır; diğer Kare Kare sekmelerinin kalıcı olarak meşgul sayılması önlenir. Başka sekmenin sesi zorla durdurulmaz.
- Başlangıç olayı gelmese de kelime/cümle ilerlemesi bildiriliyorsa konuşmanın başladığı anlaşılır. Uzun elle açıklamalar eski sabit 90 saniyelik sınırda zorla kesilmez; sınırlı süre denetimi korunur.
- Test notlarındaki `health.audio.transport` ve inceleme tanılamasındaki `speechTransport`, bağlantı sayısı, yerel sesler ve son 40 olayın zaman çizelgesini içerir. İsteğin alınması, seslerin bulunması, TTS'ye gönderilmesi ve başlangıç/bitiş ayrılır. Bu izde konuşma metni kaydedilmez; mevcut test notları maç bilgilerini ayrıca içermeye devam eder.
- Yeni izin, ses sağlayıcısı veya erişim genişletmesi yoktur. Chrome TTS korunur. Önceki yedi geliştirme bu pakette bulunur.

Bu değişiklikler kodda yeniden üretilen toparlanma hatalarını giderir. Hedef Mac/Chrome/Yelda hizmetinin neden tamamen yanıtsız kaldığı, cihazdan alınacak tanılama olmadan kesinleştirilmemiştir; otomatik olay testleri fiziksel sesin duyulduğunu kanıtlamaz.

Güncelleme: önce eski kopyayı kapatıp 0.12.1 klasörünü yükleyin, oyun sekmesini yenileyip **Sesi dene** kullanın. Sorun sürerse aynı oturumda **Test notlarını indir** dosyasını paylaşın. Sayfa yenilemeyle düzelmeyen Chrome/sistem konuşma takılması için maç bittikten sonra Chrome'u uygulamadan tamamen kapatıp tekrar açarak ayrı test yapın; kullanıcı adına çalışan Chrome kapatılmaz.

Resmî API davranışı: https://developer.chrome.com/docs/extensions/reference/api/tts ve https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle .

# 0.12.0 — plan hafızası, gelişim kaydı ve tek tuşla koç

- Konum değişimleri: yeni/giderilen kazançlı alış, koşullu tehdit, açık kale dikeyi, açarak/çifte şah. Olay yoksa yapay yorum yok.
- Çok hamleli plan: hedef ve aynı motor devamındaki adımlar; kısmi ilerleme, tamamlanma, değişme ve engellenme gerekçeleri. Aynı doğrulanmış maçta yerel geri yükleme.
- İki güçlü adayı aynı yasal devamlarla karşılaştırma; tek aday varsa seçenek uydurmama. Rakip baskısı/yerel kazançlı tehdit/koşullu cevabı ayırma ve karşı oyun seçimini açıklama.
- Maç içinde hedef → fikir → somut hamle; diğer sesli bölümlerden gizli hamle sızmasını önleme; açık aday isteğine izin. Ayrı alıştırmalar kaldırıldı.
- Yerel hesap bazlı maç günlüğü, sürekli son-10 özeti, her on maçta dönem bildirimi, 20'den itibaren birbirini izleyen iki onluk dönem karşılaştırması. Analiz kapsamı, 100 değerlendirilen kendi hamlesinde hata/büyük hata, güçlü seçim ve doğrulanmış fırsata güçlü yanıt, aşamalar ve koşul uyarıları.
- Aynı maçın yenilemede tekrar sayılmasını önleme, aynı hamleli yeni bot oyununu ayırma, iki sekmede Web Locks ile kayıt birleştirme; devam eden maçları dışlama, sonuç elle tamamlama, JSON ve iki adımlı silme. Hesap başına 100 bitmiş/8 aktif kayıt; eski sürüm maçları otomatik alınmaz.
- 15 özelleştirilebilir tek tuş. Varsayılan Boşluk/Q/W/E/A/S/D/R/V/C/H/F/G/T/B. X/Z site işlevlerine bırakıldı; eski Alt+O seçicisi yerini tek tuş ayarlarına bıraktı. Yazı alanı/IME/tekrar/değiştirici korumaları ve son elle isteğin önceliği; güncel zorunlu mat önceliği korunur.
- Doğrudan mat uyarısında motif etiketi bulunmamasının adayları temizleyebildiği hata giderildi.
- Chrome TTS, önceki dereceler/taktikler/efektler ve mevcut bot/inceleme erişim kapsamı korunur; yeni izin veya bulut servisi yok.

Ayrıntılı kontrol: ACCEPTANCE-CHECKLIST.md. Otomatik test ve gerçek derlenmiş panelle 20 sentetik oyun akışı doğrulanır. Yerel tarayıcı denemesinde motor cevapları ve ses köprüsü taklittir; gerçek Chess.com ve hoparlör saha testi ayrıca yapılmalıdır. İstatistikler koç desteğiyle oynanan oyunları ölçer, kesin bağımsız beceri ölçümü değildir. Taktikler ve planlar sınırlı arama/yerel takas hesabına dayanır.

# Kare Kare 0.11.0 — grading, speech variety, tactics and sound cues

## Delivered changes

- Add ten player move classifications with explicit rules: brilliant, great, book, best, excellent, good, inaccuracy, mistake, missed and blunder. Keep coach correction separate. Use a small authored reference of 20 short legal opening lines, including position-based transpositions, for book moves. This is not a complete opening database or Chess.com's grading model.
- Classify ordinary score loss with documented centipawn thresholds. Reserve missed for an evidenced tactical/winning opportunity. A concrete accepted piece offer, a non-losing result and a sufficiently evaluated alternative are necessary for brilliant. A lone forced legal move is not a discovery. Shallow or contradictory analysis remains ungraded.
- Freeze all available grading alternatives alongside the published strong suggestions. Inferior alternatives stay hidden from suggestions but remain available to recognize a critical choice. Published acceptable recommendations retain their protection from later score drift. Reports support every new class and retain old good/great records.
- Remove the repeated spoken player-label prefix. Grade phrases use player/opponent grammar; immutable actor/position metadata, the visual Ses line and explicit historical framing remain. A speech editor rotates equivalent phrases without changing the actual grade or inventing positional reasons. Only speech that starts enters repetition memory. Checkmate and coach corrections keep their special wording.
- Add Balanced / All grades / Important grades speech-density settings. Balanced suppresses the same routine grade/player within ten seconds; all mode keeps eligible grades. This setting controls grades; existing suggestion/tactic channel switches remain independent. Urgent current warnings are not suppressed by routine repetition memory.
- Add six motif recognizers: discovered attack, discovered check, double check, removing a defender, deflecting a defender and an intermediate check before a profitable capture. Material motifs require a legal demonstrated continuation and exchange evidence. A defender must legally recapture, not merely geometrically attack. New channels and explanations connect to the same candidate line and existing arrows. Other advanced motifs remain planned.
- Add original short synthesized tone cues using Web Audio: mate danger, direct tactic opportunity, blunder and board connection loss. Effects are off by default and independent from speech. Add category toggles, volume and explicit preview/start. Deduplicate events, prioritize batches, limit bursts and lower tone gain during speech. Old/conditional tactical alerts do not create a present-position alarm. Stop tones on position invalidation and dispose their audio context with the panel.
- Export effect health locally. No extra Chrome permissions or external services are added. Existing bot/reviewer account, date and route boundaries remain.

## Separate voice experiment

Provide a standard-library macOS Yelda benchmark, optional Chatterbox Multilingual benchmark, fixed Turkish chess samples and a self-contained listening comparison builder. Reject empty/silent/nonfinite generated audio. Record model/package/device information, model loading, full-utterance generation duration and waveform duration/energy. Listening scores remain user supplied. No extension integration with Chatterbox or cloud provider has been added. The model is not installed in the development Python environment, so no Chatterbox speed or quality result is claimed.

## Validation and acceptance

Regression tests cover all ten grades, legal opening references/transpositions, accepted and rejected piece offers, frozen inferior alternatives, new tactical examples and counterexamples, phrase rotation/suppression, urgent warnings, effect activation/categories/volume/cooldown and standalone comparison generation. Existing real Stockfish checks and previous screenshot/PGN regressions remain. Mocked speech/Web Audio tests cannot verify a physical speaker or perceived naturalness.

On the test computer, keep only 0.11.0 active, refresh the page, verify the footer and repeat quick move sequences with both player colors. Compare balanced/all/important grade speech, try the four effects with speech both on and off, and inspect the new grade/report details. Send test-notes JSON plus the move number and sentence heard for any mix-up. The detailed feature and acceptance plan is **GELISTIRME-PLANI.md**.

---

# Kare Kare 0.10.3 — speech perspective and position context

Reviewers confirmed audible output in 0.10.2, then reported that player/opponent commentary became confusing during rapid moves. Source inspection identified two relevant behaviors: critical speech continued after its original position changed, and conditional reply alerts did not speak their setup move. These changes address those paths without claiming the exact reported sequence has been reproduced on the test computer.

## Changes

- Build structured speech events with the recorded mover or tactical side, source position, half-move index, category and an explicit historical summary. A delayed assessment does not infer its player from the board's later turn. Grades begin with **Senin son hamlen** or **Rakibin son hamlesi**.
- Preserve the setup move for conditional tactical replies and keep distinct setup branches in alert keys. When coordinates are allowed, say **Sen X oynarsan, rakip Y…** or **Rakip X oynarsa, sen Y…**. With hidden moves or suggestions disabled, state the condition without reading coordinates.
- Stop current-position speech when its board position changes. Keep eligible critical information as a short past-tense **Geçmiş konum** summary, rather than continuing an obsolete warning or instruction. Written critical notes remain available independently of audio.
- Retain at most two queued historical summaries, from no more than two half-moves behind, waiting no more than 12 seconds. These are initial tuning limits. Late background analysis beyond these limits remains written only. Manual long readings are canceled on a position change and never converted to automatic advice.
- Sort batches before starting playback. Fresh critical events outrank historical summaries; a current mate warning can interrupt a lower-priority utterance. Ignore callbacks from canceled utterances and retain the existing one-retry and native-audio safeguards.
- Clear position-bound audio when board verification is lost and clear the previous perspective's queue when the player-color setting changes.
- Display a small **Ses:** context line below the evaluation area, including in the collapsed panel. The current role, historical flag, source context, category and half-move index are included in local test-note audio health while a request is starting or speaking.
- Include **GELISTIRME-PLANI.md**, a proposal for sound cues, staged hints, speech-density profiles and learning across games. Those proposed features are not implemented in this release.

## Validation and retest

Automated tests cover four rapid legal half-moves for both player colors, stale native callbacks, explicit historical summaries, expired/old notes, current mate priority, conditional actors and setup moves, hidden-move settings, manual summaries, missing-event retry limits and unverified boards. The native adapter/worker integration is exercised using a mocked Chrome TTS implementation. This is not an audible test on the reviewer's Mac.

Keep only 0.10.3 enabled, refresh Chess.com and check **v0.10.3** in the footer. Verify **Sesi dene**, then play a short controlled test with quick replies as each player color. Check that current warnings name the correct actor, old notes start with **Geçmiş konum**, hypothetical continuations remain conditional, and no expired advice is read as a current instruction. Check the **Ses:** line while collapsed as well. If a mix-up recurs, send the PGN/test-notes JSON, the move number and the sentence actually heard.

No changes to page permissions, speech backend, local voice selection, reviewer account allowlist or date window.

---

# Kare Kare 0.10.2 — busy-state correction

The reviewer reported the generic “another conversation is busy” message. In 0.10.1, that message could come from either the coach's internal ownership check or a preflight call to `chrome.tts.isSpeaking()`. The latter reports system-wide speech on macOS and is not evidence that this extension's own queue is occupied. The exact original branch has not been supplied in a diagnostic export; this release removes the overly broad preflight rejection and makes the remaining ownership cases distinguishable.

## Changes

- Remove the system-wide `isSpeaking()` gate. A valid request is submitted to Chrome with `enqueue: true`, relying on Chrome's speech queue rather than rejecting before submission.
- Retain a separate lock for active Kare Kare requests. `coach-audio-busy` specifically names another coach tab, while `speech-request-busy` names an overlapping request in the same connection. These no longer share the generic “another conversation” error.
- Ignore late utterance errors if their request ID no longer matches the active utterance. Continue reporting non-utterance control errors. Ignore callbacks from disposed or replaced native connections.
- Display the running extension version in the panel footer to help detect outdated or duplicate installations.
- No permission, native voice-selection, account, date-window or board-recovery changes.

## Validation and acceptance

Regression tests set the system busy flag and verify that the actual worker handler still calls `tts.speak` with `enqueue: true` without issuing a stop first. They also verify that a canceled/older request's late error cannot mark the replacement as failed, and that genuine concurrent coach tabs remain separate. These use a mocked Chrome TTS implementation; audible output on the reviewer machine still needs confirmation.

Keep only the 0.10.2 Kare Kare copy enabled, refresh the game tab and verify **v0.10.2** in the footer. Use **Koç menüsü → Ses ve görünüm seçenekleri → Sesi dene**. If sound is still absent, share the new exact message and test-notes JSON. A “different Kare Kare tab” message now identifies a real internal owner rather than a global system flag.

API behavior: https://developer.chrome.com/docs/extensions/reference/api/tts

---

## Retained changes from 0.10.1

Manual **Sesi dene** also failed in 0.10.0, so the symptom is not limited to automatic coaching channels. The reviewer's precise 0.10.0 error code/OS/Chrome version has not yet been supplied. This release changes the speech backend rather than claiming a confirmed cause for that machine.

## Changes

- Speech is now produced by Chrome's extension-native `chrome.tts` API in a dedicated background worker, not by the website/content script's Web Speech synthesis object. The existing critical-priority queue, cancellation rules, brief Turkish pronunciation and category choices are retained.
- The manifest adds the **tts** permission, a packaged module service worker and Chrome 101 as the minimum version. It retains **storage** and the same exact bot/reviewer page-access boundaries. It does not add microphone, `ttsEngine`, broad host or external-message permissions.
- Only local Turkish platform voices are selectable. Remote voices and voices supplied by other extensions are excluded, so there is no automatic transmission to a cloud/third-party speech provider. If none is found, `no-turkish-voice` explains that a Turkish system speech voice is required.
- The bridge propagates actual start/end/error events to the existing queue. A heartbeat keeps the worker alive during long playback only and stops when the request ends or is cancelled. A disconnect is reported and a fresh explicit playback can reconnect. Selected native voice and `chrome-tts` backend are included in diagnostics. Missing voice, blocked access, busy audio service and startup failure get distinct readable messages.
- Background requests require an internal top-frame content-script sender on supported Chess.com pages; live requests also retain the designated-account and date checks. A second coach tab cannot cancel another coach tab's active speech. The host checks for existing system speech before starting and does not deliberately replace it.

## Validation and retest

Automated tests exercise the real proxy and worker handler together with a mocked Chrome TTS implementation, including start/end, missing local voice, account/date/route restrictions, audio ownership and reconnects. This is not an actual Chrome/hardware audio test. On the development Mac, the installed Turkish Yelda voice also generated a 2.91-second non-silent WAV through the OS synthesizer; that confirms system synthesis on that machine only.

Disable the old extension, load the new extracted folder and refresh Chess.com. Use **Koç menüsü → Ses ve görünüm seçenekleri → Sesi dene**. Verify audible output, selected voice and the `chrome-tts` backend on the target machine. If it still fails, include the full readable error, test-notes JSON (`health.audio`), reviewer diagnostic JSON and OS/Chrome version. Reload recovery from 0.10.0 is retained.

Official API reference: https://developer.chrome.com/docs/extensions/reference/api/tts

---

## Retained changes from 0.10.0

This build addresses the reported silent speech, failed midgame refresh and difficult-to-read commentary. It does not claim that the reviewer's actual Chrome/audio configuration has been reproduced. No permissions, account allowlist or test dates have changed. Optional sound effects remain a proposed follow-up, not part of this package.

## Changes

- **Mixed-language SAN fix:** explicit piece metadata takes precedence over the page language. An English Kg8 in a Turkish document can no longer silently become Rg8. This defect was reproduced directly; it is a possible cause of refresh failures, not proof of the specific screenshot's cause.
- **Focus-view recovery:** on game URLs with a numeric game identity, verified legal history is stored locally under the game/account identity. A reload can replay that history and compare it with the visible pieces, retaining the turn, castling rights and en-passant state derived from play. A unique legal continuation of up to two half-moves can be followed if play progressed during reload. A contradictory visible history, expired/tampered record, different game/account or ambiguous resulting FEN is rejected. Lobby and bot URLs do not provide this stable identity and are not used as checkpoint keys. Keep at most 8 records, expire at 12 hours. The snapshot must have been captured by this version before reload; first-ever focus-mode opens still need visible history. The panel now explains how to expose that history instead of implying it can always reconstruct an unseen game.
- **Speech lifecycle:** the active utterance is retained until completion. The queue detects a missing start after 5 seconds, makes at most one fallback attempt and surfaces an error if that fails. Missing completion is also bounded. Permission/hardware errors do not loop. After cancel, the next request is deferred briefly to avoid mixing it with stale cancellation callbacks. User-triggered playback resumes a suspended synthesis service. Enabling speech speaks a short confirmation independently of selected coaching channels.
- **Observable audio:** the menu reports starting/speaking/recovering/error states from speech events. These events cannot measure physical speaker volume or whether an OS/tab is muted. **Sesi dene** explicitly resets the queue for a manual test. `speechState`, `speechError` and selected voice information are recorded in local reviewer diagnostics. The test-notes export works even with zero assessments and includes local audio/sync health, page path and browser user agent.
- **Brief main comment:** the main panel gives the primary idea and short reply, while **Planın ayrıntısı** retains the full explanation. Real material warnings and the distinction between defense and counterplay stay visible. Manual full reading still reads the complete explanation; automatic summary uses the brief text. The detail is also hidden by **Önce ben bulayım**.

## Acceptance checks

Repeat a refresh in both normal and focused layouts, with both colors and a Turkish UI containing English SAN. Confirm the same game's actual turn and castling rights after restore. Open a different game and verify that no old history is reused. Test a short opponent reply during reload. The checkpoint is a recovery aid, not an alternative to initial board/history verification.

On each target Chrome/OS combination, enable sound, use **Sesi dene**, and listen. Repeat with a missing selected voice and a suspended synthesis service where applicable. Inspect the visible audio status and downloaded `health.audio` fields. Automated mock tests cover queue behavior and timeouts; they do not prove hardware audio is audible. Send the new test-notes JSON and reviewer diagnostics if the problem persists.

---

## Retained changes from 0.9.0

This release combines the previous 0.8.0 revisions with the five newly supplied feedback items. Both supplied test-note exports identify themselves as 0.7.0; their PGNs are retained only as anonymous regression fixtures. No account or date restriction has changed.

## New revisions

1. **Threats require a legal, profitable capture.** Move commentary no longer treats every attacked square as a material danger. Legal captures, king safety and a bounded exchange calculation distinguish a real material threat from an attack such as Bxf2+ followed by Kxf2. The hypothetical next-turn calculation is only an internal test of a threat, is skipped when ignoring check would be illegal, and is never offered as a playable extra turn. A suggested check or counterattack is identified explicitly when it takes priority over direct defense. Commentary and candidate cards use the same primary candidate.
2. **Exchange order and delayed recaptures.** Capture explanations show the calculated capture sequence when present, including intervening captures that clear a file before a delayed recapture. Otherwise a legal same-square recapture sequence is conditional, never described as forced. Material accounting identifies which side gives and receives which pieces, including promotion value. Alternatives that capture the same target with different pieces can produce an exchange lesson in the report. In the supplied position, 19.Nxe6 Bxe6 20.Rxe6+ gains about a pawn in local material, while 19.Rxe6+ Bxe6 20.Nxe6 loses about a pawn. A real Stockfish regression also prefers Nxe6. In the earlier move-18 position, the e5 pawn blocks Rxe6: its calculated line instead includes Nxe6 Bxe6 exf6 Nxf6 Rxe6+. These positions must not be merged.
3. **Reports retain position context.** Alternative lines are replayed legally from the original pre-move FEN and displayed with full move numbers, such as 18.Nxe6 Bxe6 19.exf6 Nxf6 20.Rxe6+. A useful exchange example can be retained alongside the principal strengths/mistakes. A coach correction is not presented as a missed player response in the opportunity note.
4. **Pins need an exploitation.** Geometric pins can still be discovered internally for an engine search, but a pin is promoted to coaching/alerts only when the computed continuation shows a profitable capture of the pinned target while that pin is still present. Merely sliding on the same line, moving the king away or capturing a different piece later does not establish that evidence. Optional tactical-search results without a supported motif do not displace the main candidates. The filter is intentionally conservative: it can omit useful positional pins and longer plans outside the available variation.
5. **Mate speech context.** Speech-only normalization expands an isolated “mat” to “şah matı” and adjusts verb forms so a system voice is less likely to expand it as an abbreviation for mathematics. SAN checkmates use the same normalization. Screen text remains unchanged. Actual voice quality and pronunciation depend on installed/browser voices and must be checked on the target machine.

## Scope and limits

The local exchange estimate examines captures on the target square to bounded depth. It does not replace the engine's positional evaluation, account for every tactical sacrifice or prove a best defense. A displayed variation is conditional on its replies; a material balance describes those shown captures, not a guarantee of final game advantage. The engine still searches to depth 16 or 1.8 seconds per job. Neither limited search nor the conservative pin filter guarantees exhaustive tactical coverage.

Please repeat the five new scenarios in the installation/test guide, with both colors and the reviewer's actual Chrome voices. Automated regressions and engine checks are not a substitute for a final test on Chess.com's real live/daily layouts.

---

## Retained changes from 0.8.0

This build addresses the eight latest coaching, speech, grading and interface feedback items. The designated account, date window and bot/reviewer package separation are unchanged.

## Changes to verify

1. **Critical information survives a reply.** Mate, fork, pin and skewer messages and significant move assessments use a separate speech queue. A new move cancels an obsolete ordinary suggestion without canceling an active critical warning. Queued warnings about an earlier position name that move's context. **Kritik notlar** retains the latest notes even with speech off. Explicit mute, preference changes and starting another game stop speech. Historical analysis can finish in the background without replacing current suggestions.
2. **Voice controls.** **Koç menüsü → Ses ve görünüm seçenekleri** offers installed Turkish voices, a speed slider and **Sesi dene**. SAN is pronounced as Turkish piece and square names. Automatic selection prefers an available enhanced/natural voice. This uses browser speech synthesis; it adds no external voice service and cannot guarantee a human-sounding voice on every machine.
3. **Simpler panel.** Main commentary, urgent current warnings and compact candidates are the primary view. Each candidate has expandable **Gerekçe ve devam**. Detailed tactics/grades and historical critical notes expand separately. Color, voice, settings, feedback, arrows, playback and downloads are in the bottom **Koç menüsü**. **Yeni oyun** was removed. The header arrow button and Alt+O remain usable while collapsed.
4. **Concrete recapture warnings.** Capture explanations mention a recapture only when a legal reply captures on that square, consistent with the calculated reply when available. They name the actual move instead of always warning about a recapture.
5. **Clearer Turkish.** Explanations identify concrete attacks, support and controlled squares. Continuations explicitly distinguish **Rakip ... oynarsa, sen ...** from **Sen ...; ardından rakip ...**. Generic claims about improving placement are replaced with supported actions. Opening/middlegame detection uses the FEN move number rather than empty reconstructed history.
6. **Consistent grading.** Published candidates are frozen with the pre-move position. Strong suggestions stay within 55 centipawns of the best evaluated move, so fewer than three may be shown. A later score change does not turn a published recommendation into the player's missed move. If a later search refutes a published recommendation with forced mate, **Koç düzeltmesi** acknowledges the coach error and excludes it from player mistakes. Open reports refresh when background grades arrive.
7. **False fork filtering.** The reported Bg4-e2+ position is a regression fixture: White can play Kxe2, so it is not advertised as a useful fork. Legal captures and a bounded local exchange calculation filter attackers that can be neutralized without material loss. Pins and skewers also use this filter.
8. **More relevant tactical searches.** Additional searches prioritize distinct mate/fork/pin/skewer ideas, up to four per position, instead of spending this budget on generic checks or captures. A pin already present is not advertised as new when the attacker simply slides along the same line. Trivial pawn pins are suppressed in direct alerts unless the computed continuation exploits that target. The supplied PGN preserves the useful 16.Nc7+ fork and Qa5 absolute-pin motif in regression tests.

## Evaluation and grading

The evaluation bar is always from White's perspective: positive favors White. It is neither an account rating nor a win probability. Forced mates are announced for either side up to five moves when found; longer scores are not shortened to five. Opponent reply motifs are explicitly conditional on the suggested first move.

The four player grades remain **Harika**, **Güzel**, **Kaçırılan hamle**, and **Büyük hata**, using Kare Kare's heuristics rather than Chess.com's proprietary classification. Scores are compared from the mover's perspective, preferring evaluations of alternatives from the same pre-move position. At least depth 10 is required for the comparable evaluations. Up to 55 centipawns lost is good; larger losses are missed continuations; losses of 200 or more may be blunders, excluding still decisively won/lost positions. Great moves require a concrete tactical idea and additional evidence; an only legal response is not praised as a discovery. Search inconsistencies may leave moves ungraded. **Koç düzeltmesi** is an assessment of a coach recommendation, not a fifth player-performance grade.

## Diagnostics and limits

**Koç menüsü → Test notlarını indir** includes PGN, move grades, recent analysis snapshots and critical notes, as well as marked feedback. These records stay local until the user downloads and shares them. The separate extension-icon diagnostics remains available in the reviewer build. The ZIP contains corresponding source and tests, including a minimal anonymous fixture derived from the supplied game.

Searches remain bounded to depth 16 or 1.8 seconds per job. The exchange filter examines captures on a target square to bounded depth; it is not an exhaustive tactical proof and may exclude some valid sacrifices. Neither the tactical scan nor the additional search budget guarantees every fork or pin will be found. Fast play can delay historical assessments. Very long speech queues are bounded; the written critical history remains available independently.

Repeat both colors, rapid replies, muted speech categories, installed voice selection, collapsed arrow shortcuts, midgame refresh and end-of-game report completion. Automated and isolated local checks do not establish compatibility with every real Chess.com live/daily layout. Final acceptance requires the designated reviewers to repeat these scenarios in Chrome.

Doğrulama sonucu (0.12.0): 127 Node testi ve 4 Python ses aracı testi geçti. Yerel Chrome panel/tercih/yerleşim denemesi ve 20 sentetik oyunlu entegrasyon denemesi geçti. Raporlar kaynak çalışma alanında `release/ui-smoke-v0.12.0/result.json` ve `release/integration-smoke-v0.12.0/result.json` altında.
