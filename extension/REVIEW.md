# Kare Kare — Chess.com review build 0.13.1

This is a limited evaluation build of a Turkish chess coaching extension. It reads the visible chessboard, evaluates positions locally with Stockfish.js, and displays explanations, candidate moves, optional arrows, and optional speech. It does not make moves, change results, or transmit game data to a project server.

**Install this extracted folder, not the ZIP file or the `source` folder.** The file `manifest.json` must be directly inside the folder selected in Chrome. See [INSTALLATION-AND-TEST-GUIDE.md](INSTALLATION-AND-TEST-GUIDE.md) for the complete setup, test procedure, diagnostics, and feedback template.

The review build is limited to standard chess on the listed live and daily Chess.com pages, the `hisaycheese` test account, and the period **24 October 2026 18:00 through 23 November 2026 18:00 (Türkiye time, UTC+03:00)**. The owner's accounts are blocked. Chess960 and other variants are outside this build's scope. The page adapters still require validation on actual Chess.com live and daily games.

This package includes source code and license notices. The main project is GPL-3.0; Stockfish.js 19.0.1 is GPL-3.0, and chess.js 1.4.0 is BSD-2-Clause.

See [RELEASE-NOTES.md](RELEASE-NOTES.md) for the ten move classes, speech repetition controls, six new tactical recognizers, independent sound cues and regression cases. The new controls are described in the installation guide.

## Retained coaching and progress features

All seven approved features are implemented: position-change commentary, persistent multi-move plans, comparison of two verified strong candidates, conditional opponent explanations, target → idea → move hints, local last-ten-game statistics with consecutive non-overlapping ten-game comparisons, and 15 customizable single-key controls. No separate puzzles/exercises are included. See [ACCEPTANCE-CHECKLIST.md](ACCEPTANCE-CHECKLIST.md) for the full Turkish feature-by-feature procedure. The installation guide includes the English overview. Native Chrome TTS and existing access limits remain unchanged.

## 0.13.1 interface and synchronized visual coaching

A 360 px adaptive edge panel adds Comment/Plan/Opponent tabs, persistent compact critical/grade/audio status, width/text/theme/side preferences, and sentence/branch-based narrated overlays. Original candidate colors remain fixed. Both actors use the same solid arrow geometry with uniform 12 px Sen/Rakip badges and numbered hypothetical steps. Narration temporarily replaces the idle candidate layer, even when idle arrows are off. Space changes only the idle-arrow preference; on completion the latest preference and current candidates are restored. Hidden-hint mode and historical-position protections apply to visuals. See ARAYUZ-VE-ANLATIM-PLANI.md and ACCEPTANCE-CHECKLIST.md. All prior features, access limits and storage/tts permissions remain. Real layouts and audible output still require reviewer testing.
