# Kare Kare 0.13.1 — Installation and Test Guide

**Audience:** Chess.com reviewers using the designated `hisaycheese` account.  
**Purpose:** Controlled evaluation of the Chess.com live and daily page adapters. The new logic has automated regression coverage; Chrome voice quality and live/daily page behavior must be verified by the review team.

## New interface and narrated overlays in 0.13.1

The panel uses free space beside the board (right preferred), recognizes visible sidebar/clock regions and falls back to the other edge or a separate position below the board. It does not resize the chessboard. Check focus mode, normal play, resized windows, scrolling and board flips on your actual page. In constrained/fixed site layouts, below-board access may require scrolling or a wider window; this is not a claim of universal DOM compatibility.

Use **Yorum / Plan / Rakip** tabs. Critical alerts, evaluation, latest grade with move number and speech state remain visible when collapsed. Candidate reasons, every report, journal action and voice/effect setting remain accessible. The header menu shortcut opens the single lower coach menu. **Panel ve anlatım okları** configures width (280–480 px), text (14–20 px), system/light/dark theme, edge preference and off/tactics/all narrated visuals. Defaults: 360 px, 15 px, system, automatic edge, all narrated explanations.

Read A/S/D, W, E, Q, B, R or G. Visual segments start with actual TTS start events rather than estimated timing. The same verified FEN and legal calculated line drive the speech and marks. Candidate colors remain yellow `#d6f263`, blue `#68d4e9`, warm red/orange `#ffa96a`; a candidate’s own continuation retains its rank. Both actors use identical solid arrow geometry. Every arrow carries a Sen/Rakip badge; hypothetical steps add a number in the same font, size and color. Throughout narration, including cue-free sentences and inter-segment gaps, the idle candidate layer is completely hidden. Completion, C, speech failure or a new position clears the speech layer. Historical replay must not draw on the current board.

Space changes only the idle candidate-arrow preference. A/S/D and Q/W/E can temporarily draw their verified explanation even when idle arrows are off. Toggling Space during speech must preserve the current narration; completion restores the latest on/off preference using current candidates. Use the separate narration mode to disable narrated drawings. Hidden target/idea hints must not leak moves through drawings; explicit A/S/D requests may reveal their requested candidate only. Changing off/tactics/all cancels the current reading and applies the new mode. The voice backend and recovery behavior are unchanged.

Repeat **ACCEPTANCE-CHECKLIST.md → 0.13.1** on the reviewer machine. The local panel fixture uses mock engine answers and a mock Chrome speech bridge; it is not an audible hardware test. Local layout measurements cannot guarantee compatibility with every Chess.com deployment.

## Audio recovery check in 0.12.1

To preserve local match records/settings, export them first, replace the files inside the currently installed extension folder with this package, and use **Reload** on its existing `chrome://extensions` card. Keep the Chrome profile and folder path unchanged; do not uninstall. Refresh the game tab afterward. Loading a different folder creates a separate extension identity with separate storage.

Press **Sesi dene** after updating: it rebuilds the speech port. Test an interruption followed by a new current-position announcement and a new manual request. The service releases its own stalled request; another tab's active speech must remain protected. A temporary failure cannot permanently mute later moves; permission/account/voice-availability failures remain explicit.

If silent, export **Koç menüsü → Test notlarını indir** immediately. Inspect `health.audio.transport.trace` (request/received/voices-ready/submitted/start/end/error) and the popup's separate speech status/error/connection fields. No utterance text is stored in this transport trace. A received/start event is not proof of audible output. If a page reload also fails, test a full Chrome app quit/reopen **after the game ends**; this is a diagnostic step, not a claim that the OS fault is fixed.

## 1. Package contents and scope

Extract the supplied ZIP into a dedicated folder named `kare-kare-chesscom-review-v0.13.1`. Some ZIP tools create that folder automatically; if yours places loose files in the chosen location, create the folder first and extract into it. Its top level must contain `manifest.json`, `content.js`, `speech-worker.js`, `engine.html`, `review-config.json`, and this guide. The `source` subfolder is provided for code review; **do not select `source` when installing**.

The extension runs locally in desktop Google Chrome. It reads the board and move list, calculates candidate lines using the bundled Stockfish engine, and displays Turkish coaching. It can draw optional arrows and speak optional summaries. It does not submit moves or contact a project server. Diagnostic and feedback records remain in Chrome local extension storage until the reviewer chooses to download them.

The current review configuration is:

| Item | Value |
| --- | --- |
| Designated test account | `hisaycheese` |
| Start | 24 October 2026, 18:00 Türkiye time (UTC+03:00) |
| End | 23 November 2026, 18:00 Türkiye time (UTC+03:00) |
| Game types | Standard chess: bot, live online, and daily pages; all time controls on those pages |
| Excluded | Chess960 and other variants, analysis and puzzle pages, project-owner accounts |

The exact compiled account and dates are also visible in `review-config.json` and in the extension's diagnostics popup. Please use a test account and match type that your team has approved. Start with controlled unrated games against a consenting test partner. Rated games, if any, should follow your own review procedure.

The current build recognizes the numeric game route (for example `/game/185883631442`) reached after clicking **Start Game**. It also keeps the panel active during a brief site-header replacement. Please repeat the lobby-to-game transition that failed in 0.6.1; this behavior still needs confirmation on your test machine.

## 2. Install in Chrome

**Retained speech backend:** The package now declares **storage** and **tts** and includes a background speech worker. `tts` enables speech output, not microphone access; no `ttsEngine`, recording, cloud-voice or broader page-access permission is added. Desktop Chrome 101+ is required. The worker uses Chrome's native TTS API and restricts selection to local Turkish system voices supplied by the platform. Install/enable an appropriate Turkish system voice if Chrome reports none. Use the new version's extracted folder, disable older copies and refresh the Chess.com tab before testing.


1. Save the ZIP locally and extract it. Keep the extracted folder in place for the duration of the test; Chrome loads files from that folder.
2. In **desktop Google Chrome**, enter `chrome://extensions` in the address bar.
3. Switch on **Developer mode** (top right), then click **Load unpacked**.
4. Select the extracted **`kare-kare-chesscom-review-v0.13.1`** folder. Check that `manifest.json` is directly inside the selected folder. Do not select the ZIP, its parent folder, or `source`.
5. Confirm Chrome shows **Kare Kare — Chess.com İnceleme Sürümü**, version **0.13.1**, with no red error badge. If another Kare Kare copy is enabled in this Chrome profile, disable that copy to avoid duplicate panels.
6. From Chrome's Extensions menu (puzzle icon), pin Kare Kare. Clicking its icon opens **Review diagnostics**.
7. Sign in to Chess.com with `hisaycheese`, open a supported game page, and **refresh the game tab once**. Keep the extension installed in the same Chrome profile as that sign-in.

If Chrome is managed by an organization and Developer mode or Load unpacked is unavailable, ask your Chrome administrator to enable the approved test workflow. No browser security setting needs to be bypassed.

Chrome's official unpacked-extension instructions: https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked

## 3. First-run check

1. Open a standard chess game using a supported Chess.com live or daily route.
2. Confirm the Kare Kare panel appears on the game page. It should show the current side to move and, after a short calculation, a positional explanation and candidate moves.
3. Click the pinned Kare Kare icon. In **Review diagnostics**, verify **Access: allowed**, **Board: read**, a plausible piece count (up to 32), a move count that matches the visible game, and **Engine: ready**. The most recent stage should normally progress through `analysis_ready` to `coach_ready`.
4. Compare the position shown in the downloaded diagnostic report (`fen`) and the coach's candidate moves against the visible game. A correct piece count alone does not prove the position is correct.
5. If the panel or suggestions do not appear, use the troubleshooting section below; do not change the account restriction.

The popup shows the **last observed page**, which can be from another tab. Refresh the game tab and reopen the popup before drawing conclusions.

## 4. Suggested test matrix

### Retained coaching acceptance checks

Use [ACCEPTANCE-CHECKLIST.md](ACCEPTANCE-CHECKLIST.md) for every individual feature and edge case. The seven additions are:

1. **Position changes:** B reads a verified new profitable capture, ended threat, open rook file or discovered/double check. Ordinary moves need not produce a special change.
2. **Plan memory:** W explains the goal and current first step. Test partial progress, completion, different player choices and an opponent reply that blocks the old line. Plans restore only against verified matching move history.
3. **Candidate comparison:** F compares two legal strong lines. A/S/D read each candidate and its continuation. Fewer than two strong options must not produce an invented alternative.
4. **Opponent reasoning:** E separates check obligations, locally profitable captures and conditional replies. Check counterplay versus direct defense and defended-pawn counterexamples.
5. **Guided help:** Enable Kademeli ipucu. H advances target → idea → move; a new position resets it. Other speech must not reveal hidden moves. Explicit A/S/D requests can read a chosen candidate without advancing the general hint level.
6. **Match journal:** Enable local recording under Maç kayıtları. Finished games only contribute; refresh must not duplicate a match. Son 10 maç / gelişim shows the rolling last ten and fixed consecutive blocks: at 20 games compare 11–20 with 1–10, at 30 compare 21–30 with 11–20. Test coverage, per-100-assessed-own-move rates, phase breakdowns, settings/time/rating warnings, JSON export and two-step deletion. Records begin with this release; retention is 100 finished plus 8 active per account. Unknown metadata remains unknown. Chrome profiles/extension IDs do not share records.
7. **Keys and audio:** Space arrows; Q comment; W plan; E opponent; A/S/D candidates; R tactics; V replay; C stop; H hint; F compare; G full explanation; T grades; B change. All 15 are editable under Tek tuşlu kısayollar. X/Z remain native site keys. Check collapsed operation, editable-field suppression, duplicate-key rejection, unassignment and reset. The latest manual request replaces prior manual playback, while an urgent current mate alert has priority. New positions cancel stale manual playback.

No exercises are included. The isolated Chrome fixture verifies 20 synthetic games, not actual Chess.com DOM or audible system TTS. Repeat the real-site, two-color and physical-audio tests after updating. Existing access scope and permissions are unchanged.

### Retained behavior from 0.11.0

- **Ten grades:** Harika / Çok iyi / Kitap / En iyi / Mükemmel / İyi / Yanlışlık / Hata / Kaçırılan hamle / Büyük hata. These are Kare Kare's published rules, not a reproduction of Chess.com's proprietary grading model. Coach corrections are separate. Book coverage is limited to 20 short authored opening reference lines; no match does not mean a move is outside all opening theory. Brilliant requires a concrete piece offer, a sufficiently strong calculated result and a relevant alternative. A forced single legal response is not praised as a discovery.
- **Less repetitive speech:** Under **Koç menüsü → Ses ve görünüm seçenekleri → Konuşma yoğunluğu**, test Dengeli / Tüm dereceleri oku / Yalnızca önemli dereceler. Balanced suppresses a repeated routine grade for 10 seconds per grade/player. All mode retains every eligible grade with phrase rotation. Important grades and current mate alerts remain eligible. Identity remains in structured events and the visual Ses line; the repeated spoken “your/opponent's last move” prefix is removed. Test both colors and delayed historical results again.
- **New tactics:** Test discovered attacks/checks, double checks, removal/deflection of a defender and intermediate checks. Material tactics require a demonstrated legal continuation and locally profitable exploitation. Test counterexamples where a pinned defender cannot recapture, a target escapes, or the followup is missing. This does not yet implement every advanced chess motif.
- **Independent effects:** Speech may be off while effects are on. Effects start disabled. Expand **Kısa uyarı efektleri**, enable the desired categories, set volume and press **Efekti dene**. Try the four preview tones. Reloading may require another explicit gesture. A batch produces at most one cue; duplicate/rapid cues are suppressed. Historical and conditional alerts produce no current-position beep. The connection cue applies only after a previously verified board remains lost for two seconds; short capture animations must stay silent.
- **Reports and export:** Check that all new positive/error classes appear correctly in the match report, that recommendation drift is not blamed on the player and that exported `health.effects` is present. Written classifications remain visible even when their speech is suppressed.
- **Alternative voice experiment:** See **NATURAL-VOICE-EXPERIMENT.md**. It is separate from the extension; Chrome TTS remains the shipping backend. No claim of Chatterbox performance or audibility on the reviewer's Mac is made.

Settings and actions are at the bottom under **Koç menüsü**. The main view shows commentary and compact candidates with expandable **Gerekçe ve devam**. The unused **Yeni oyun** action has been removed. Open **Koç menüsü → Ses ve görünüm seçenekleri** for independent speech channels, **Kademeli ipucu** for target → idea → move, and **Tek tuşlu kısayollar** for 15 editable single-key bindings (Space toggles arrows). The shortcut works with the panel collapsed. The evaluation bar and compact latest grade stay visible when collapsed. Open **Koç menüsü → Maç raporu** for examples from the actual game and a downloadable report. There are no separate exercises. Review [RELEASE-NOTES.md](RELEASE-NOTES.md) for definitions and limits before assessing the new grades.

Use your own approved accounts and opponents. For each test, note the page path, game type, time control, color, and the first move where behavior differs from the board.

| Scenario | Check |
| --- | --- |
| New controlled unrated live game, White | Panel appears; initial position and both players' moves are followed; suggestions update after each move. |
| New controlled unrated live game, Black | Board orientation, player color, candidates, and arrows match Black's viewpoint. |
| Midgame refresh or browser tab reopen | Board and move history resynchronize; no stale suggestions remain. |
| Daily game | Position and turn match the visible daily board after opening and after a move. |
| Different time controls | Repeat a short test at the time controls your team intends to evaluate. |
| End of game | Coach stops recommending moves and shows the end-of-game learning note. |
| Each side's grades | Both last-move cards update; their expandable reason names the stronger line and the actual reply when available. |
| Speech channels | Disable suggestions and leave grades enabled; no suggested move should be read automatically. Repeat with mate/fork/pin/skewer channels. |
| Rapid opponent reply | Play four half-moves quickly, once with the player as White and once as Black. Speech must keep the recorded mover's identity. Obsolete current commentary stops; at most two recent critical notes may be read as **Geçmiş konum**, using past tense. Notes more than two half-moves behind or waiting over 12 seconds are not automatically read. Written **Kritik notlar** remains available. A fresh mate warning takes precedence. |
| Actual versus hypothetical moves | A conditional tactic must name its setup: “Sen X oynarsan, rakip Y…” or “Rakip X oynarsa, sen Y…”. It must not describe X or Y as already played. With hidden moves or suggestions disabled, the condition remains explicit without announcing the coordinates. |
| Playback context | Check the small **Ses:** line below the evaluation area, including while the panel is collapsed. It distinguishes the player/opponent or a historical position. Changing the selected player color clears queued speech from the previous perspective. |
| Voice and speed | In **Koç menüsü → Ses ve görünüm seçenekleri**, select an installed Turkish voice, adjust the speed and use **Sesi dene**. Quality depends on installed voices. |
| Grading consistency | Play a published candidate; later score drift must not label it a missed move. A later forced-mate refutation is a **Koç düzeltmesi**, excluded from player mistakes. |
| Report completion | Finish a game while assessments are pending; the visible report must update as those assessments complete. |
| False fork regression | At `8/1ppk4/3n2r1/Q7/P1Np2bp/1P6/2P3PP/2R2K2 b - - 1 28`, Be2+ must not be advertised as a useful fork: Kxe2 is legal. |
| Defended f2 pawn | A bishop looking at f2 must not be presented as winning that pawn if the legal king recapture loses the bishop. Geometric contact alone is insufficient. |
| Plan consistency | Where a real material threat exists, check whether the primary candidate defends, moves the target, checks first or leaves the threat for counterplay; the commentary must say which applies. |
| Exchange order | In the supplied first PGN, compare 19.Nxe6 with 19.Rxe6+. The local trade should distinguish knight versus rook given for pawn and bishop. At move 18 the e5 pawn still blocks Rxe6; do not mix these positions. |
| Useful pin | A structural pin without a profitable exploitation in the computed line must not trigger an opening claim or a pin alert. |
| Mate pronunciation | Try the installed Turkish voices with a short forced mate. Speech should receive “şah matı”; confirm actual pronunciation on the reviewer machine. |
| Focus mode / refresh | First allow one verified position with move history visible, then enter focus mode and refresh the same numeric game URL. Check `checkpoint_restored`, pieces, turn and castling rights. The first-ever focused open has no trusted checkpoint; expose history once. |
| Global busy regression | With no active utterance owned by this coach, a system-wide busy flag must not reject the request before `tts.speak`. The worker submits with `enqueue: true`. A genuine other Kare Kare tab must produce the separate `coach-audio-busy` message; an old request's error must not overwrite a newer utterance. |
| Silent speech | Enable sound and listen for the confirmation. Use **Sesi dene**; check `speechState` and `speechError` in diagnostics or **Test notlarını indir**. A stalled start must retry once and show a visible error rather than hang. Check that `speechBackend` / `health.audio.backend` is `chrome-tts`; missing local Turkish voices produce `no-turkish-voice` with a readable explanation. No available voice and a busy system engine are separate outcomes. Confirm audible output on actual hardware. |
| Concise coaching | The main comment is brief; **Ayrıntılı açıklama ve karşılaştırma** preserves the longer explanation. Hide-move mode must also hide that detail. |
| Arrow shortcut | Collapse the panel, use Space to show and hide arrows, then verify typing into a text field does not trigger it. |
| Lost synchronization | Old candidates, arrows and score disappear until a legal replay matches the board. The second reported screenshot is a regression fixture. |
| Account restriction | In a separate non-designated account, the live/daily panel stays absent and diagnostics says access is blocked. |

For any mismatch, stop relying on the displayed advice and record it. A live/daily route adapter has not yet been proven across all Chess.com layouts.

## 5. Diagnostics and useful feedback

Click the pinned Kare Kare icon, then **Download diagnostic report**. The JSON contains a bounded local history of status checks: time, page path (without query parameters), access result, board and move counts, the reconstructed chess position (FEN) when available, engine status, and an error summary. It does **not** include cookies, passwords, full page text, or the reviewer's email address. Since a FEN can reveal a test-game position, share the report only through your approved review channel.

Please include with each issue:

1. Extension version and Chrome version.
2. Game type, time control, color, and page **path** (for example `/game/live/...`).
3. Approximate move number, expected board/coaching behavior, and actual behavior.
4. A screenshot of the board and panel, plus the diagnostic JSON.
5. Whether refreshing the game tab or restarting Chrome changes the result.

The coach panel's **Koç menüsü → Test notlarını indir** exports PGN, move assessments, recent analysis snapshots, critical notes, and feedback on explanations and audio/synchronization health (including the browser user-agent string) separately from diagnostics, even with no graded moves. Include this file when reporting a missed or incorrect tactic. Use **Koç menüsü → Maç raporu** for the learning report.

## 6. Troubleshooting

| Symptom | What to check |
| --- | --- |
| Chrome will not load the extension | Select the extracted folder containing `manifest.json`; check Developer mode and any organization policy. |
| No panel appears | Verify version 0.13.1, `hisaycheese` sign-in, the test dates, standard chess, supported route, and refresh the game tab. Open diagnostics for `account_missing`, `account_blocked`, or `unsupported_route`. |
| Panel disappears when the game starts | Confirm version 0.13.1, reopen diagnostics, and check the recorded **Page route** and **Stage**. Send the report and the address-bar path if it persists. |
| Diagnostics shows `board_missing` or `pieces_unreadable` | Wait for the game to render, refresh once, and send a screenshot plus the report. The page's board markup may differ from the tested bot layout. |
| Diagnostics shows `position_mismatch` | Record the move number and report. The move list may not have synchronized after a midgame join or refresh. |
| Engine says `error` or candidates never appear | Use the panel's **Tekrar dene** button once, refresh the game tab, then export diagnostics if it persists. |
| Two coach panels or duplicate speech | Disable other Kare Kare versions on `chrome://extensions` and refresh. |
| Diagnostics shows an old route/time | Bring the game tab to the front, refresh it, then reopen the popup. |

Please do not edit `manifest.json` or `review-config.json` to work around a problem. Send the report so the next build can address the cause.

## 7. Update or remove

For an updated build, extract the new ZIP to a **new folder**. On `chrome://extensions`, disable/remove the older Kare Kare review build, load the new folder, and refresh open Chess.com game tabs. Verify the new version in the diagnostics popup. To end the test, remove the extension from `chrome://extensions`; downloaded reports can be deleted separately.
