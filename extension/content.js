import { Chess } from 'chess.js'
import { compareAlternative, describeLines, positionIntro, scoreValue, tacticalSearchQueue, continuationText, playerExplanation, briefExplanation } from './coach-core.js'
import { boardSelectors, gameMode, liveConfig, reviewAccess } from './game-mode.js'
import { withEngineRecovery } from './engine-recovery.js'
import { createDiagnosticReporter } from './diagnostics.js'
import { checkpointScope, createCheckpointStore, makeCheckpoint, restoreCheckpoint } from './game-checkpoint.js'
import { signedInAccount } from './account-identity.js'
import { createSpeechCoach, preferredVoice } from './speech-coach.js'
import { createSpeechEditor } from './speech-editor.js'
import { createSoundEffects, effectEvents } from './sound-effects.js'
import { createNativeSynthesis, speechErrorText } from './native-speech.js'
import { defaultShortcuts, interactiveKeyTarget, keyLabel, normalizeKey, shortcutAction, shortcutActions, validateShortcuts } from './keyboard-controls.js'
import { createMatchStore, developmentReport, journalSession } from './match-journal.js'
import { compareCandidates, createHintController, createPlanTracker, hintContent, opponentComment, positionChanges, sectionSpeech } from './position-coaching.js'
import { moveListSnapshots, piecesFromGame, readBoardPieces, reconstructPosition, samePieces, visibleGameResult } from './board-sync.js'
import { coachingSpeechEvents, colorName, defaultPreferences, gradePlayedMove, positionAlerts, positionEvaluation, reviewReport, speechForEvents, strongCandidates } from './coach-insights.js'
import { gradeLabels } from './move-grades.js'
import { appearanceDefaults, appearancePreferences, boardOrientation, coachPlacement } from './coach-layout.js'
import { candidateSignature, createNarrationController, narrationSegments } from './narration.js'
import { renderBoardOverlay } from './board-overlays.js'

const reportDiagnostic = createDiagnosticReporter(liveConfig.enabled, chrome.storage.local, () => location.pathname)

// The default package has only bot URL permissions. A separate live build also
// requires an allowed account and an unexpired authorization before mounting.
let mounted = false
let activeDispose = null
let verifiedAccount = null
function mountCoach(activeMode) {
  if (document.querySelector('#kare-kare-coach')) return false
  const files = 'abcdefgh'
  let game = new Chess()
  let playerColor = 'w'
  let colorSelectedManually = false
  let voiceEnabled = false
  let open = true
  let arrowsVisible = false
  let lastBoardKey = ''
  let analysisToken = 0
  let gameEpoch = 0
  let gradingTask = null
  let published = null
  let manualSpeechId = 0
  let audioStatus = { state: 'idle', error: null }
  const criticalNotes = new Map()
  let currentCandidates = []
  let speechSummary = ''
  let selectedSquare = null
  let focusedCandidate = null
  let activeContext = 'comment'
  let layoutTimer = null
  let layoutBoard = null
  let overlayBoard = null
  let overlayOrientation = null
  let overlaySize = 0
  let overlayExpected = false
  let overlayRedrawPending = false
  let preferences = { ...defaultPreferences, keys: { ...defaultShortcuts } }
  const narrated = createNarrationController(() => preferences, () => drawArrows())
  const planTracker = createPlanTracker()
  const hints = createHintController()
  let coachingView = null
  let lastHeard = null
  let manualArrowFen = null
  let manualSiteResult = false
  let journalProfile = null
  let journalActiveId = null
  let journalTimer = null
  let journalLoad = Promise.resolve()
  let journalMetadata = {}
  let reviewNavigation = false
  let reviewResumePly = 0
  let newGameIntentFen = null
  let assistance = {}
  const helpSettings = new Set()
  let journalTabState = null
  try { journalTabState = JSON.parse(sessionStorage.getItem('kareKareJournalTabV1') || 'null') } catch { /* A fresh local session is created below. */ }
  const matchStore = createMatchStore(chrome.storage.local, { withLock: work => navigator.locks?.request
    ? navigator.locks.request(`kare-kare-journal:${chrome.runtime.id}`, work)
    : Promise.reject(new Error('Güvenli sekmeler arası kayıt kilidi kullanılamadı')) })
  let boardSynchronized = false
  let hasSynchronizedPosition = false
  let lastMismatchKey = ''
  let lastMoveListSignature = ''
  let analysisInProgress = false
  let alerts = []
  let lastReport = null
  let siteResult = null
  const checkpointStore = createCheckpointStore(chrome.storage.local)
  let checkpointContext = null
  let cachedCheckpoint = null
  let checkpointAttempt = ''
  let checkpointSavedFen = ''
  const analysisCache = new Map()
  const moveRecords = new Map()
  const pendingGrades = new Map()
  const gradedMoves = new Map()
  const spoken = new Set()
  let engineFrame = null
  let engineMessageHandler = null
  let engineReady = false
  let engineBusy = false
  let engineStartupTimer = null
  let nextJobId = 0
  const queue = []
  let missingHeaderReported = false
  let disposed = false
  reportDiagnostic({ stage: 'coach_mounted', mode: activeMode, board: 'waiting', engine: 'starting', error: null })

  const panel = document.createElement('aside')
  panel.id = 'kare-kare-coach'
  panel.innerHTML = `
    <div class="kk-head"><div class="kk-brand"><span class="kk-mark">♞</span><div><strong>Kare Kare</strong><small>${activeMode === 'bot' ? 'BOT ANTRENMAN KOÇU' : 'ONAYLI TEST KOÇU'}</small></div></div><div class="kk-head-actions"><button class="kk-menu-quick" type="button" aria-label="Koç menüsünü aç" title="Koç menüsü">☰</button><button class="kk-arrow-quick" type="button" aria-label="Okları aç veya kapat" title="Hamle oklarını aç/kapat (Boşluk)">↗</button><button class="kk-minimize" type="button" aria-label="Koçu küçült" aria-expanded="true">−</button></div></div>
    <div class="kk-overview"><div class="kk-evaluation"><span class="kk-eval-score">—</span><div class="kk-eval-rail" role="meter" aria-label="Beyaz açısından konum değerlendirmesi" aria-valuemin="0" aria-valuemax="100"><span class="kk-eval-white"></span></div><span class="kk-eval-detail">Konum bekleniyor</span></div><div class="kk-grade-compact" hidden></div><div class="kk-persistent-status"><span class="kk-status" aria-live="polite">Chess.com tahtası bekleniyor…</span><span class="kk-audio-status" aria-live="polite">Ses kapalı</span></div><p class="kk-urgent" hidden></p><div class="kk-speech-context" hidden></div></div>
    <div class="kk-body">
      <div class="kk-scroll">
        
        <p class="kk-hidden-note" hidden>Önce hedefi bul; H ile fikri ve somut hamleyi sırayla aç.</p>
        <div class="kk-hint-controls" hidden><span class="kk-hint-level"></span><button class="kk-hint-next" type="button">Sonraki ipucu</button></div>
        <div class="kk-context-tabs" role="tablist" aria-label="Koç açıklaması" hidden><button type="button" class="kk-context-tab" id="kk-tab-comment" data-context="comment" role="tab" aria-controls="kk-current-explanation" aria-selected="true">Yorum <kbd>Q</kbd></button><button type="button" class="kk-context-tab" id="kk-tab-plan" data-context="plan" role="tab" aria-controls="kk-current-explanation" aria-selected="false">Plan <kbd>W</kbd></button><button type="button" class="kk-context-tab" id="kk-tab-opponent" data-context="opponent" role="tab" aria-controls="kk-current-explanation" aria-selected="false">Rakip <kbd>E</kbd></button></div><section id="kk-current-explanation" role="tabpanel" aria-labelledby="kk-tab-comment"><h2 class="kk-title">Hazırlanıyoruz.</h2><p class="kk-message">Oyunu başlat; iki tarafın hamlelerini takip edeceğim.</p><div class="kk-explanation" hidden><p class="kk-full-message"></p></div></section>
        <details class="kk-coaching-details" hidden><summary>Ayrıntılı açıklama ve karşılaştırma</summary><p class="kk-change" hidden></p><p class="kk-plan" hidden></p><p class="kk-opponent" hidden></p><p class="kk-comparison"></p></details>
        <h3 class="kk-candidates-title" hidden></h3><div class="kk-candidates"></div>
        <div class="kk-selection" hidden><p class="kk-selection-text"></p><label>İncelemek istediğin hamle <select class="kk-other-move"></select></label><button class="kk-inspect-button" type="button">Hamleyi incele</button><p class="kk-inspect-result" hidden></p></div>
        <details class="kk-insights"><summary>Taktik ve son hamleler</summary><div class="kk-tactics" hidden></div><div class="kk-grades" hidden></div></details>
        <details class="kk-history" hidden><summary class="kk-history-heading">Kritik notlar</summary><div class="kk-history-list"></div></details>
        <div class="kk-summary" hidden></div>
        <div class="kk-development" hidden></div>
        <p class="kk-milestone" hidden></p>
      </div>
      <div class="kk-quick-controls"><button class="kk-arrows" type="button" aria-pressed="false">↗ Okları göster</button><button class="kk-repeat" type="button">◖ Yorumu dinle</button></div><small class="kk-narration-state" aria-live="polite"></small>
      <button class="kk-retry" type="button" hidden>↻ Tekrar dene</button>
      <details class="kk-menu"><summary>Koç menüsü <span class="kk-menu-voice-state">Ses kapalı</span></summary><div class="kk-menu-content">
        <div class="kk-settings"><label>Ben <select class="kk-color" aria-label="Oynadığım renk"><option value="w">Beyaz</option><option value="b">Siyah</option></select></label><button class="kk-voice" type="button" aria-pressed="false">🔈 Ses kapalı</button></div>
        <details class="kk-preferences"><summary>Ses ve görünüm seçenekleri</summary><div class="kk-sound-grid">${[['suggestions', 'Hamle önerileri'], ['grades', 'Hamle derecelendirmeleri'], ['mate', 'Mat uyarıları'], ['fork', 'Çatal uyarıları'], ['pin', 'Açmaz uyarıları'], ['skewer', 'Şiş uyarıları'], ['discovered', 'Açarak saldırı / şah'], ['doubleCheck', 'Çifte şah'], ['defender', 'Savunucuyu uzaklaştırma'], ['zwischenzug', 'Ara şah']].map(([key, label]) => `<label><input type="checkbox" data-speech="${key}" checked> ${label}</label>`).join('')}</div>
          <label>Konuşma yoğunluğu <select class="kk-speech-detail"><option value="balanced">Dengeli: tekrarları azalt</option><option value="all">Tüm dereceleri oku</option><option value="critical">Yalnızca önemli dereceler</option></select></label>
          <label>Konuşma sesi <select class="kk-voice-select" aria-label="Konuşma sesi"><option value="">Otomatik Türkçe ses</option></select></label>
          <label>Konuşma hızı <input class="kk-voice-rate" aria-label="Konuşma hızı" type="range" min="0.8" max="1.2" step="0.05" value="1"><output class="kk-voice-rate-value">1.00×</output></label><button class="kk-test-voice" type="button">Sesi dene</button><small class="kk-speech-status" aria-live="polite">Ses kapalı</small>
          <details class="kk-effect-settings"><summary>Kısa uyarı efektleri</summary><label><input class="kk-effects" type="checkbox"> Efektler açık (konuşmadan bağımsız)</label><div class="kk-sound-grid">${[['effectMate', 'Mat tehlikesi'], ['effectTactic', 'Taktik fırsatı'], ['effectBlunder', 'Büyük hata'], ['effectConnection', 'Tahta bağlantısı']].map(([key, label]) => `<label><input type="checkbox" data-effect="${key}" checked> ${label}</label>`).join('')}</div><label>Efekt düzeyi <input class="kk-effect-volume" aria-label="Efekt düzeyi" type="range" min="0" max="1" step="0.05" value="0.25"><output class="kk-effect-volume-value">%25</output></label><label>Denenecek efekt <select class="kk-effect-kind"><option value="tactic">Taktik fırsatı</option><option value="mate">Mat tehlikesi</option><option value="blunder">Büyük hata</option><option value="connection">Tahta bağlantısı</option></select></label><button class="kk-test-effect" type="button">Efekti dene</button><small class="kk-effect-state" aria-live="polite">Efektler kapalı</small></details>
          <details class="kk-appearance"><summary>Panel ve anlatım okları</summary>
            <label>Panel genişliği <input class="kk-panel-width" type="range" min="280" max="480" step="10" aria-label="Panel genişliği"><output class="kk-panel-width-value"></output></label>
            <label>Yazı boyutu <input class="kk-text-size" type="range" min="14" max="20" step="1" aria-label="Yorum yazı boyutu"><output class="kk-text-size-value"></output></label>
            <label>Tema <select class="kk-theme"><option value="auto">Sistemle aynı</option><option value="dark">Koyu</option><option value="light">Açık</option></select></label>
            <label>Tercih edilen kenar <select class="kk-panel-side"><option value="auto">Otomatik • Önce sağ</option><option value="right">Sağ</option><option value="left">Sol</option></select></label>
            <label>Konuşmayı oklarla takip et <select class="kk-narration-mode"><option value="off">Kapalı</option><option value="tactics">Yalnızca taktik ve tehditler</option><option value="all">Bütün açıklamalar</option></select></label>
            <small>Aday renkleri: sarı 1, mavi 2, kırmızı 3. Sen/Rakip etiketi tarafı, numara örnek devamın adımını gösterir. Boşluk yalnızca hamle oklarını açıp kapatır. Anlatım çizimleri konuşurken görünür, bitince önceki hamle okları düzenine dönülür.</small><button class="kk-appearance-reset" type="button">Görünümü varsayılana döndür</button>
          </details>
          <label class="kk-hide-setting"><input class="kk-hide-moves" type="checkbox"> Kademeli ipucu: önce hedef, sonra fikir ve hamle</label>
          <details class="kk-key-settings"><summary>Tek tuşlu kısayollar</summary><label><input class="kk-keys-enabled" type="checkbox" checked> Kısayollar açık</label><p>Yazı ve form alanlarında çalışmaz. X/Z Chess.com'a ayrıldı. Atamak için kutuya basıp tek tuşa bas; Backspace atamayı kaldırır.</p><div class="kk-key-grid">${Object.entries(shortcutActions).map(([action, label]) => `<label>${label}<input type="text" readonly data-key-action="${action}" aria-label="${label} kısayolu"></label>`).join('')}</div><button class="kk-keys-save" type="button">Kısayolları kaydet</button><button class="kk-keys-reset" type="button">Varsayılan tuşlar</button><small class="kk-keys-status" aria-live="polite"></small></details>
        </details>
        <div class="kk-actions"><button class="kk-read-all" type="button">◖ Açıklamayı dinle</button><button class="kk-export" type="button">↓ Test notlarını indir</button><button class="kk-report" type="button">Maç raporu</button><button class="kk-development-button" type="button">Son 10 maç / gelişim</button><small class="kk-export-status" aria-live="polite"></small></div>
        <details class="kk-journal-settings"><summary>Maç kayıtları</summary><label><input class="kk-recording" type="checkbox" checked> Maçları bu bilgisayarda kaydet</label><small class="kk-journal-status" aria-live="polite">Kayıtlar bu sürümden itibaren tutulur.</small><label>Sonuç algılanmadıysa <select class="kk-result"><option value="*">Sonuç seç</option><option value="1-0">Beyaz kazandı</option><option value="0-1">Siyah kazandı</option><option value="1/2-1/2">Berabere</option></select></label><button class="kk-save-result" type="button">Maçı sonuçlandır</button><button class="kk-journal-export" type="button">Maç kayıtlarını indir</button><button class="kk-journal-delete" type="button">Bu hesabın kayıtlarını sil…</button><div class="kk-delete-confirm" hidden><p>Bu hesaptaki kayıtlar silinecek ve kayıt kapatılacak. Diğer hesapların kayıtları silinmez.</p><button class="kk-delete-yes" type="button">Evet, kayıtları sil</button><button class="kk-delete-no" type="button">Vazgeç</button></div></details>
        <div class="kk-feedback" hidden><span>Bu yorum?</span><button type="button" data-feedback="helpful">Faydalı</button><button type="button" data-feedback="irrelevant">Gereksiz</button><button type="button" data-feedback="wrong">Hatalı</button><small class="kk-feedback-status"></small></div>
      </div></details>
    </div><div class="kk-footer">${activeMode === 'bot' ? 'Bot antrenmanı' : 'İnceleme hesabı'} • v${chrome.runtime.getManifest().version} • <span class="kk-layout-note"></span><span class="kk-arrow-legend"><span class="kk-rank-1">● 1</span> <span class="kk-rank-2">● 2</span> <span class="kk-rank-3">● 3</span></span><span class="kk-hotkey-hint">Oklar: Boşluk</span><span class="kk-shortcut-notice" aria-live="polite"></span></div>
  `
  document.documentElement.appendChild(panel)
  const $ = selector => panel.querySelector(selector)
  $('.kk-coaching-details > summary').after($('.kk-explanation'))
  const boardElement = () => {
    for (const selector of boardSelectors(activeMode)) {
      for (const board of document.querySelectorAll(selector)) {
        if (board.querySelector('.piece') && board.getClientRects().length) return board
      }
    }
    return null
  }

  const panelResize = new ResizeObserver(() => scheduleLayout())
  panelResize.observe(panel)
  function scheduleLayout() {
    if (disposed || layoutTimer !== null) return
    layoutTimer = setTimeout(() => { layoutTimer = null; layoutPanel() }, 32)
  }
  function layoutPanel() {
    if (disposed) return
    const board = boardElement()
    if (layoutBoard !== board) { if (layoutBoard) panelResize.unobserve(layoutBoard); layoutBoard = board; if (board) panelResize.observe(board) }
    const blockers = [...document.querySelectorAll('.board-layout-sidebar, .layout-column-two, .sidebar, .sidebar-layout, #board-layout-sidebar, [data-cy="game-sidebar"], .player-top, .player-bottom, .clock-component')]
      .filter(node => node !== panel && !panel.contains(node) && !node.contains(panel) && !node.contains(board) && !board?.contains(node) && node.getClientRects().length)
      .map(node => node.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0 && rect.width < innerWidth * .95)
    const placement = coachPlacement({ viewport: { width: document.documentElement.clientWidth || innerWidth, height: innerHeight, scrollX, scrollY }, board: board?.getBoundingClientRect(), blockers,
      width: preferences.panelWidth, side: preferences.panelSide })
    for (const [name, value] of Object.entries({ position: placement.position, left: `${placement.left}px`, top: `${placement.top}px`, width: `${placement.width}px`, maxHeight: `${placement.maxHeight}px`, right: 'auto', bottom: 'auto' })) {
      if (panel.style[name] !== value) panel.style[name] = value
    }
    panel.dataset.placement = placement.mode
    const below = placement.mode === 'below'
    if (document.documentElement.classList.contains('kk-coach-below') !== below) document.documentElement.classList.toggle('kk-coach-below', below)
    $('.kk-layout-note').textContent = below ? 'Boşluk dar • Koç tahtanın altında. Gerekirse pencereyi genişlet.' : placement.mode === 'left' ? 'Tahtanın solunda' : placement.mode === 'right' ? 'Tahtanın sağında' : 'Tahta bekleniyor'
    const orientation = boardOrientation(board)
    const boardSize = board?.getBoundingClientRect().width || 0
    if (board !== overlayBoard || orientation !== overlayOrientation || boardSize !== overlaySize || overlayRedrawPending ||
        (overlayExpected && !board?.querySelector('#kk-board-arrows'))) {
      overlayBoard = board; overlayOrientation = orientation; overlaySize = boardSize; drawArrows()
    }
  }
  window.addEventListener('resize', scheduleLayout)
  window.addEventListener('scroll', scheduleLayout, { passive: true })

  const nativeSynthesis = createNativeSynthesis(chrome.runtime,
    () => ({ path: location.pathname, account: activeMode === 'bot' ? null : verifiedAccount }),
    refreshVoiceChoices, error => speechStateChanged({ state: 'error', error }))
  const speechEditor = createSpeechEditor(() => preferences)
  const speaker = createSpeechCoach(
    nativeSynthesis,
    text => ({ text }),
    () => preferences,
    error => reportDiagnostic({ stage: 'speech_error', speechError: String(error).slice(0, 100) }),
    { onState: speechStateChanged, prepare: speechEditor.prepare, onSegment: (item, segment) => {
      if (narrated.start(item, segment, { fen: game.fen(), verified: boardSynchronized, hidden: movesHidden(), signature: candidateSignature(currentCandidates), candidates: currentCandidates })) {
        assistance.narration = (assistance.narration || 0) + 1; scheduleJournal()
      }
    }, onStarted: item => {
      speechEditor.started(item)
      lastHeard = item.repeatCanonical || { text: item.historical ? `Geçmiş konum. ${item.historicalText}` : item.text, fen: item.fen, role: item.role,
        segments: item.historical ? [] : item.segments || [], allowReveal: item.allowReveal, visualSignature: item.visualSignature }
    } }
  )
  const soundEffects = createSoundEffects(() => preferences, {
    isSpeaking: () => ['starting', 'speaking'].includes(audioStatus.state),
    onState: state => { $('.kk-effect-state').textContent = state.state === 'error' ? 'Efekt başlatılamadı. Efekti dene ile tekrar dene.'
      : state.state === 'starting' ? 'Efekt başlatılıyor…' : ['ready', 'preview'].includes(state.state) ? 'Efekt sesi hazır' : 'Efektler kapalı veya beklemede' }
  })

  function speechStateChanged(state) {
      if (state.state === 'starting') narrated.nextSegment()
      else if (state.state !== 'speaking') narrated.clear()
      audioStatus = { ...state, backend: 'chrome-tts' }
      const labels = { idle: voiceEnabled ? 'Ses açık' : 'Ses kapalı', starting: 'Ses başlatılıyor…', speaking: 'Konuşuyor',
        recovering: 'Ses bağlantısı yenileniyor…', ready: voiceEnabled ? 'Ses açık • Hazır' : 'Okuma tamamlandı', error: 'Ses başlayamadı • Sesi dene' }
      const text = state.state === 'error' && state.error === 'no-turkish-voice' ? 'Türkçe ses bulunamadı'
        : state.state === 'error' && state.error === 'coach-audio-busy' ? 'Diğer koç sekmesi konuşuyor'
        : state.state === 'error' && state.error === 'speech-request-busy' ? 'Önceki ses isteği sürüyor'
        : state.state === 'error' && state.error === 'audio-busy' ? 'Ses hizmeti meşgul' : labels[state.state] || 'Ses bekleniyor'
      $('.kk-speech-status').textContent = state.state === 'error' ? speechErrorText(state.error) : text
      $('.kk-menu-voice-state').textContent = text
      $('.kk-audio-status').textContent = text
      $('.kk-audio-status').dataset.state = state.state
      const speaking = ['starting', 'speaking'].includes(state.state)
      $('.kk-speech-context').hidden = !speaking
      $('.kk-speech-context').textContent = speaking ? `Ses: ${state.historical ? `Geçmiş konum • ${state.context || ''}` : narrated.cue?.label || state.role || 'İstediğin açıklama'}` : ''
      reportDiagnostic({ speechState: state.state, speechBackend: 'chrome-tts', speechError: state.error || null, speechVoice: state.voice || null,
        speechVoiceCount: nativeSynthesis.getVoices().length, speechTransport: nativeSynthesis.getHealth() })
  }

  function say(text, force = false, replace = true, positionBound = true) {
    if ((!voiceEnabled && !force) || !text) return
    if (force) speaker.request({ key: `manual:${++manualSpeechId}`, text, fen: positionBound ? game.fen() : null, role: positionBound ? 'İstediğin açıklama' : 'Ses denemesi' })
    else { if (replace) speaker.clearOrdinary(); speaker.enqueue({ key: `manual:${++manualSpeechId}`, text, fen: positionBound ? game.fen() : null }) }
  }

  function movesHidden() { hints.sync(game.fen(), preferences.hideMoves); return hints.hidden }

  function narratedItem(item, action, part = null) {
    if (!boardSynchronized || item.fen !== game.fen() || preferences.narrationMode === 'off') return item
    if (action === 'repeat') return { ...item, allowReveal: !!part?.canonical?.allowReveal, visualSignature: part?.canonical?.visualSignature,
      segments: part?.canonical?.fen === game.fen() ? part.canonical.segments || [] : [] }
    return { ...item, visualSignature: candidateSignature(currentCandidates), allowReveal: !!part?.revealsMove, segments: narrationSegments({ text: item.text, action, fen: item.fen,
      candidates: currentCandidates, playerColor, view: coachingView, alerts, alert: item.visualAlert,
      hidden: movesHidden(), allowReveal: !!part?.revealsMove }) }
  }

  function readSection(action) {
    if (['comment', 'plan', 'opponent'].includes(action)) { activeContext = action; refreshLearningView() }
    if (!boardSynchronized && action !== 'repeat') { say('Konum henüz doğrulanmadı; eski açıklamayı güncel öneri olarak okumuyorum.', true, true, false); return }
    if ((game.isGameOver() || siteResult) && ['comment', 'details', 'plan', 'opponent'].includes(action)) {
      say(`${$('.kk-title').textContent}. ${$('.kk-message').textContent}`, true); return
    }
    const part = sectionSpeech(action, { fen: game.fen(), view: coachingView, hidden: movesHidden(), hintLevel: hints.level,
      candidates: currentCandidates, playerColor, alerts, grades: [...gradedMoves.values()], lastHeard })
    const item = narratedItem({ key: `manual:${++manualSpeechId}`, text: !boardSynchronized ? `Son doğrulanmış konuma ait kayıt. ${part.text}` : part.text,
      fen: boardSynchronized ? game.fen() : null, role: part.role }, action, part)
    item.repeatCanonical = part.canonical || { text: part.text, fen: game.fen(), role: part.role, segments: item.segments || [], allowReveal: item.allowReveal, visualSignature: item.visualSignature }
    speaker.request(item)
    $('.kk-shortcut-notice').textContent = ` • ${part.role}`
    assistance[action] = (assistance[action] || 0) + 1
    scheduleJournal()
  }

  function renderCoaching(lastMove = game.history({ verbose: true }).at(-1)) {
    if (!boardSynchronized || !currentCandidates.length) return
    const fen = game.fen()
    if (currentCandidates[0].depth < 10 || scoreValue(currentCandidates[0].score) === null) {
      coachingView = null
      render('Hesap henüz yeterli değil', 'Somut plan açıklaması için daha güvenilir motor hesabı gerekiyor. Tekrar dene ile yeniden hesaplatabilirsin.', 'Ön hesap', false)
      $('.kk-coaching-details').hidden = true
      return
    }
    const intro = positionIntro(game, playerColor, lastMove, currentCandidates)
    const changes = positionChanges(fen, lastMove, playerColor)
    const own = game.turn() === playerColor
    const best = currentCandidates[0]
    const change = changes.map(item => item.text).join(' ')
    const lead = `${own ? '' : 'Rakip '}${best.san}${own ? ': ' : ' oynayabilir. '}${briefExplanation(best, own)}`
    const forcing = /[+#]$/.test(best.san) || best.motifs?.some(motif => motif.type !== 'capture')
    const importantChange = changes.find(item => item.type === 'new-threat') || changes[0]
    const changeLead = importantChange ? `${importantChange.text}${importantChange.text.includes(best.san) ? '' : ` ${lead}`}` : ''
    let comment = forcing ? lead : /karşı oyun|bu tehdidi gideriyor|önce şah çekiyor/.test(intro.brief || '') ? intro.brief : changeLead || intro.brief || intro.body
    const plan = planTracker.observe(fen, currentCandidates, game.history({ verbose: true }), playerColor)
    if (plan.updateAudible) comment += ` ${plan.update}`
    coachingView = { fen, intro, changes, comment, full: [change, intro.body].filter(Boolean).join(' '),
      plan,
      opponent: opponentComment(fen, currentCandidates, playerColor), comparison: compareCandidates(fen, currentCandidates, playerColor) }
    render(intro.title, coachingView.full, own ? 'Sıra sende' : 'Rakip düşünüyor', false, comment)
    refreshLearningView()
    scheduleJournal()
  }

  function refreshLearningView() {
    const hidden = movesHidden()
    panel.classList.toggle('kk-moves-hidden', hidden)
    $('.kk-hidden-note').hidden = !preferences.hideMoves
    $('.kk-hint-controls').hidden = !preferences.hideMoves || !currentCandidates.length
    $('.kk-hint-level').textContent = ['1/3 • Hedef', '2/3 • Fikir', '3/3 • Somut hamle'][hints.level]
    $('.kk-hint-next').textContent = hints.level < 2 ? `Sonraki ipucu${preferences.keys.hint ? ` (${keyLabel(preferences.keys.hint)})` : ''}` : 'Hamle düzeyi açık'
    $('.kk-hidden-note').textContent = preferences.keys.hint ? `Önce hedefi bul; ${keyLabel(preferences.keys.hint)} ile fikri ve somut hamleyi sırayla aç.` : 'Önce hedefi bul; Sonraki ipucu düğmesiyle fikri ve hamleyi sırayla aç.'
    $('.kk-hint-next').disabled = hints.level >= 2
    $('.kk-coaching-details').hidden = !coachingView || hidden
    $('.kk-context-tabs').hidden = !coachingView || coachingView.fen !== game.fen()
    for (const button of panel.querySelectorAll('[data-context]')) {
      button.setAttribute('aria-selected', String(button.dataset.context === activeContext))
      const key = preferences.keys[button.dataset.context]
      button.querySelector('kbd').textContent = keyLabel(key) || '—'
      button.querySelector('kbd').hidden = !key || !preferences.shortcutsEnabled
    }
    $('#kk-current-explanation').setAttribute('aria-labelledby', `kk-tab-${activeContext}`)
    if (!coachingView || coachingView.fen !== game.fen()) return
    if (hidden) {
      const hint = hintContent(game.fen(), currentCandidates[0], playerColor)
      $('.kk-title').textContent = activeContext === 'opponent' ? 'Rakibin fikrini araştır' : hints.level ? 'Fikri araştır' : 'Önce hedefi bul'
      $('.kk-message').textContent = activeContext === 'opponent' ? opponentComment(game.fen(), currentCandidates, playerColor, false) : hints.level ? hint.idea : hint.target
      speechSummary = $('.kk-message').textContent
    } else {
      $('.kk-title').textContent = activeContext === 'plan' ? 'Planın ve sonraki adım' : activeContext === 'opponent' ? 'Rakibin cevabı ve tehdidi' : coachingView.intro.title
      $('.kk-message').textContent = activeContext === 'plan' ? coachingView.plan.text : activeContext === 'opponent' ? coachingView.opponent : coachingView.comment
      speechSummary = coachingView.comment
    }
    $('.kk-explanation').hidden = hidden || activeContext !== 'comment' || coachingView.full === coachingView.comment
    $('.kk-change').textContent = coachingView.changes.map(change => change.text).join(' ') || 'Yeni, doğrulanmış önemli bir değişim yok.'
    $('.kk-plan').textContent = `Plan: ${coachingView.plan.text}`
    $('.kk-opponent').textContent = coachingView.opponent
    $('.kk-comparison').textContent = coachingView.comparison.text
    const firstBrief = $('.kk-card-1 .kk-card-brief')
    if (firstBrief) firstBrief.hidden = activeContext === 'comment' && coachingView.comment.includes(firstBrief.textContent)
    renderAlerts(); drawArrows(); scheduleLayout()
  }

  function advanceHint() {
    if (!boardSynchronized || !coachingView) { say('İpucu için doğrulanmış konum hesabı bekleniyor.', true, true, false); return }
    activeContext = 'comment'; hints.sync(game.fen(), preferences.hideMoves); hints.advance(); refreshLearningView(); readSection('hint')
  }

  function matchMetadata() {
    const text = selector => document.querySelector(selector)?.textContent?.trim() || null
    const rating = text('[data-cy="opponent-rating"], .player-top .rating, .player-top .user-rating')
    const clock = text('[data-cy="time-control"], .time-control-component')
    const time = clock?.match(/^(\d{1,3})\s*(?:\+|\|)\s*(\d{1,3})$/)
    return { opponent: text('[data-cy="opponent-name"], .player-top .user-username-component, .player-top .user-tagline-username'),
      opponentRating: rating && /^\(?\d{2,4}\)?$/.test(rating) ? Number(rating.replace(/[()]/g, '')) : null,
      timeControl: time ? `${Number(time[1]) * 60}+${Number(time[2])}` : null }
  }

  function ensureJournalSession() {
    if (reviewNavigation && game.history().length >= reviewResumePly && reviewResumePly > 0) reviewNavigation = false
    if (reviewNavigation) return
    journalProfile ||= verifiedAccount || signedInAccount(document) || journalTabState?.profile || 'yerel-profil'
    const startNew = newGameIntentFen !== null && newGameIntentFen !== game.fen()
    const next = journalSession(journalTabState, { path: location.pathname, profile: journalProfile, moves: game.history(), result: siteResult || '*', newGame: startNew })
    if (startNew) newGameIntentFen = null
    journalTabState = next
    const observedMetadata = matchMetadata()
    for (const [key, value] of Object.entries(observedMetadata)) if (value !== null) journalMetadata[key] = value
    try { sessionStorage.setItem('kareKareJournalTabV1', JSON.stringify(next)) } catch { $('.kk-journal-status').textContent = 'Sekme kimliği saklanamadı; bot sayfası yenilemelerinde kayıt eşleştirmesi sınırlı olabilir.' }
    if (journalActiveId === next.id) return
    journalActiveId = next.id
    const epoch = gameEpoch, id = next.id
    journalLoad = matchStore.list(journalProfile).then(saved => {
      if (epoch !== gameEpoch || id !== journalActiveId || disposed) return
      const match = saved.matches.find(item => item.id === id)
      if (!match) return
      assistance = { ...match.assistance }; delete assistance.settings
      for (const setting of match.assistance.settings || []) helpSettings.add(setting)
      if (match.color === playerColor && planTracker.restore(match.planState, game.history({ verbose: true }), playerColor) && currentCandidates.length) renderCoaching()
    }).catch(() => { $('.kk-journal-status').textContent = 'Önceki maç kaydı bu kez okunamadı.' })
  }

  function journalSnapshot() {
    if (!preferences.recordingEnabled || !boardSynchronized || !hasSynchronizedPosition || reviewNavigation) return null
    if (!journalActiveId) ensureJournalSession()
    helpSettings.add(JSON.stringify({ suggestions: preferences.suggestions, hideMoves: preferences.hideMoves, speechDetail: preferences.speechDetail, voice: voiceEnabled,
      narrationMode: preferences.narrationMode, narrationPaused: narrated.paused }))
    return { id: journalActiveId, profile: journalProfile, color: playerColor, mode: activeMode, moves: game.history(), result: siteResult || '*',
      grades: [...gradedMoves.values()], assistance: { ...assistance, settings: [...helpSettings] }, metadata: journalMetadata,
      planState: planTracker.snapshot(), coachVersion: chrome.runtime.getManifest().version }
  }

  async function persistJournal(snapshot = journalSnapshot()) {
    if (!snapshot) return null
    const epoch = gameEpoch
    try {
      await journalLoad
      if (!preferences.recordingEnabled) return null
      const record = await matchStore.save(snapshot)
      if (!disposed && epoch === gameEpoch) {
        $('.kk-journal-status').textContent = record.finished ? `${record.ordinal}. tamamlanan maç kaydedildi. Analizler geldikçe güncellenir.` : 'Bu maç yerel olarak kaydediliyor; tamamlanınca istatistiğe katılır.'
        if (record.newMilestone) {
          $('.kk-milestone').hidden = false
          $('.kk-milestone').textContent = `${record.ordinal}. maç tamamlandı. ${record.ordinal === 10 ? 'İlk 10 maçlık ölçüm' : '10 maçlık dönem karşılaştırması'} hazır: Koç menüsü → Son 10 maç / gelişim.`
        }
        if (!$('.kk-development').hidden) renderDevelopment(developmentReport(await matchStore.list(journalProfile)))
      }
      return record
    } catch (error) {
      if (!disposed) $('.kk-journal-status').textContent = `Maç kaydedilemedi: ${String(error.message).slice(0, 120)}`
      return null
    }
  }

  function scheduleJournal() {
    clearTimeout(journalTimer)
    if (!preferences.recordingEnabled || !boardSynchronized) return
    journalTimer = setTimeout(() => { journalTimer = null; persistJournal() }, 300)
  }

  function renderDevelopment(report) {
    const box = $('.kk-development'); box.hidden = false; box.replaceChildren()
    const add = (tag, text) => { const node = document.createElement(tag); node.textContent = text; box.append(node); return node }
    const number = value => value === null ? '—' : value.toFixed(1)
    add('h3', `Son 10 maç • ${report.profile}`)
    add('p', `${report.total} tamamlanan maç. Güncel özet ${report.rolling.games} maç içeriyor; ${report.rolling.graded}/${report.rolling.ownMoves} hamle puanlandı. Analiz kapsamı %${number(report.rolling.coverage)}.`)
    const table = document.createElement('table'); table.className = 'kk-stats-table'
    const rows = [['Gösterge', 'Son 10', report.currentRange ? `${report.currentRange.join('–')}` : 'Son dönem', report.previousRange ? `${report.previousRange.join('–')}` : 'Önceki dönem'],
      ['Hata / 100 değerlendirilen hamle', ...[report.rolling, report.current, report.previous].map(item => number(item.errorsPer100))],
      ['Büyük hata / 100 değerlendirilen hamle', ...[report.rolling, report.current, report.previous].map(item => number(item.blundersPer100))],
      ['Güçlü seçim (%)', ...[report.rolling, report.current, report.previous].map(item => number(item.strongPercent))],
      ['Doğrulanmış fırsata güçlü yanıt (%)', ...[report.rolling, report.current, report.previous].map(item => number(item.opportunityPercent))],
      ['Analiz kapsamı (%)', ...[report.rolling, report.current, report.previous].map(item => item.games ? number(item.coverage) : '—')]]
    rows.forEach((cells, index) => { const row = document.createElement('tr'); cells.forEach(value => { const cell = document.createElement(index ? 'td' : 'th'); cell.textContent = value; row.append(cell) }); table.append(row) }); box.append(table)
    add('p', report.interpretation)
    add('p', `Sonraki dönem: ${report.nextMilestone}. maç. Son 10 özeti kayan penceredir; dönemler birbirleriyle çakışmaz.`)
    add('p', `Son 10 maçın dereceleri: ${Object.entries(gradeLabels).map(([code, label]) => `${label}: ${report.rolling.counts[code] || 0}`).join(' • ')}`)
    add('h4', 'Oyun aşamaları')
    for (const [phase, data] of Object.entries(report.rolling.phases)) add('p', `${phase}: ${data.graded}/${data.total} hamle değerlendirildi; ${data.errors} hata veya büyük hata.`)
    if (report.ready) for (const change of report.phaseChanges) add('p', change.text)
    if (report.ready) add('p', `Bilinen rakip puanı ortalaması: son dönem ${report.conditions.current.rating === null ? 'bilinmiyor' : Math.round(report.conditions.current.rating)}, önceki dönem ${report.conditions.previous.rating === null ? 'bilinmiyor' : Math.round(report.conditions.previous.rating)}.`)
    for (const warning of report.warnings) add('p', warning).className = 'kk-stat-warning'
    add('h4', 'Kaydedilen son maçlar')
    for (const match of [...report.recent].reverse()) {
      const detail = document.createElement('details'), title = document.createElement('summary')
      title.textContent = `#${match.ordinal} • ${colorName(match.color)} • ${match.result} • ${match.metadata.opponent || 'Rakip bilinmiyor'}`
      const info = document.createElement('p'); info.textContent = `Süre: ${match.metadata.timeControl || 'bilinmiyor'} • Rakip puanı: ${match.metadata.opponentRating ?? 'bilinmiyor'} • Analiz: ${match.graded}/${match.ownMoves} • Koç: ${match.version || 'bilinmiyor'}`
      const moves = document.createElement('pre'); moves.textContent = match.moves.map((san, index) => `${index % 2 === 0 ? `${Math.floor(index / 2) + 1}. ` : ''}${san}`).join(' ')
      detail.append(title, info, moves); box.append(detail)
    }
    add('small', `${report.note} Hesap başına son 100 tamamlanan ve 8 sürmekte olan maç tutulur. Her hamle derecesi kendi hesabıdır; rakip/süre bilgisi bulunamazsa bilinmiyor bırakılır.`)
  }

  async function showDevelopment() {
    await persistJournal()
    const profile = journalProfile || verifiedAccount || signedInAccount(document) || 'yerel-profil'
    try { renderDevelopment(developmentReport(await matchStore.list(profile))); $('.kk-development').scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }
    catch { $('.kk-journal-status').textContent = 'Gelişim raporu okunamadı.' }
  }

  function contextFor(fen) {
    const record = [...moveRecords.values()].find(item => item.afterFen === fen)
    return record ? `${record.number}${record.color === 'w' ? '.' : '...'} ${colorName(record.color)} ${record.san} sonrası`
      : `${Number(fen.split(' ')[5])}. hamle konumunda`
  }

  function rememberCritical(key, text, fen) {
    if (criticalNotes.has(key)) return
    criticalNotes.set(key, { context: contextFor(fen), text, fen })
    if (criticalNotes.size > 40) criticalNotes.delete(criticalNotes.keys().next().value)
    const history = $('.kk-history'); history.hidden = false
    $('.kk-history-heading').textContent = `Kritik notlar (${criticalNotes.size})`
    const list = $('.kk-history-list'); list.replaceChildren()
    for (const item of [...criticalNotes.values()].slice(-6).reverse()) {
      const row = document.createElement('p')
      const label = document.createElement('strong'); label.textContent = item.context
      const body = document.createElement('span'); body.textContent = item.text
      row.append(label, body); list.append(row)
    }
  }

  function render(title, body, status, speak = true, brief = null) {
    if (!coachingView) $('.kk-context-tabs').hidden = true
    $('.kk-title').textContent = title
    $('.kk-message').textContent = brief || body
    $('.kk-full-message').textContent = body
    $('.kk-explanation').hidden = !brief || brief === body
    $('.kk-status').textContent = status
    const firstIdea = briefExplanation(currentCandidates[0], game.turn() === playerColor)
    speechSummary = firstIdea ? `${game.turn() === playerColor ? '' : 'Rakip için olası devam: '}${firstIdea}` : title
    // Automatic speech is routed by event type below; manual reading stays explicit.
  }

  function readPieces(board) {
    return readBoardPieces(board)
  }

  function boardKey(pieces) { return [...pieces].sort(([a], [b]) => a.localeCompare(b)).map(([s, p]) => s + p).join('') }

  function inferColor(board) {
    return boardOrientation(board)
  }

  function updateEvaluation(score = null) {
    const evaluation = score && positionEvaluation(game.fen(), score)
    $('.kk-eval-score').textContent = evaluation?.text || '—'
    $('.kk-eval-detail').textContent = evaluation?.detail || (boardSynchronized ? 'Hesaplanıyor' : 'Konum doğrulanıyor')
    $('.kk-eval-white').style.width = `${evaluation?.whitePercent ?? 50}%`
    const rail = $('.kk-eval-rail')
    if (evaluation) rail.setAttribute('aria-valuenow', String(Math.round(evaluation.whitePercent)))
    else rail.removeAttribute('aria-valuenow')
    rail.setAttribute('aria-valuetext', evaluation ? `${evaluation.text}. ${evaluation.detail}` : 'Değerlendirme henüz yok')
    rail.classList.toggle('kk-eval-unknown', !evaluation)
  }

  function renderAlerts() {
    const container = $('.kk-tactics')
    container.replaceChildren()
    container.hidden = !alerts.length
    const urgent = alerts.find(alert => alert.channel === 'mate') || alerts.find(alert => !alert.conditional)
    $('.kk-urgent').hidden = !urgent
    $('.kk-urgent').textContent = urgent ? urgent.spoken : ''
    if (!alerts.length) return
    for (const color of ['w', 'b']) {
      const group = document.createElement('section'); group.className = 'kk-tactic-side'
      const title = document.createElement('strong'); title.textContent = colorName(color)
      group.append(title)
      const items = alerts.filter(alert => alert.color === color)
      if (!items.length) {
        const empty = document.createElement('small'); empty.textContent = 'Bu hesaplanan devamda belirgin taktik uyarısı yok.'; group.append(empty)
      }
      for (const alert of items) {
        const item = document.createElement('p')
        item.className = `kk-alert kk-alert-${alert.channel}`
        item.textContent = movesHidden() ? alert.spoken : alert.text
        if (alert.channel !== 'mate') {
          const context = document.createElement('small')
          context.textContent = movesHidden() && alert.conditional ? 'Önerilen hamleden sonra olası cevap' : alert.context
          item.append(context)
        }
        group.append(item)
      }
      container.append(group)
    }
  }

  function announce(key, events, fen = game.fen()) {
    const entries = coachingSpeechEvents(events, { key, fen, playerColor, revealMoves: preferences.suggestions && !movesHidden() })
    const audible = []
    if (boardSynchronized) soundEffects.notify(effectEvents(entries, game.fen(), playerColor))
    for (const item of entries) {
      const itemFen = item.fen || fen
      if (item.critical) rememberCritical(item.key, item.text, itemFen)
      if (!voiceEnabled || spoken.has(item.key) || !preferences[item.channel] || (item.channel === 'suggestions' && movesHidden())) continue
      spoken.add(item.key)
      if (spoken.size > 300) spoken.delete(spoken.values().next().value)
      audible.push(narratedItem({ ...item, fen: itemFen, context: contextFor(itemFen) }, item.channel === 'suggestions' ? 'comment' : item.channel === 'grades' ? 'grades' : 'tactics'))
    }
    speaker.enqueueMany(audible)
  }

  function renderGrades() {
    const box = $('.kk-grades')
    box.replaceChildren()
    const records = [...moveRecords.values()]
    box.hidden = !records.length
    for (const color of ['w', 'b']) {
      const record = records.filter(item => item.color === color).at(-1)
      if (!record) continue
      const grade = gradedMoves.get(record.afterFen)
      const card = document.createElement('div'); card.className = `kk-grade kk-grade-${grade?.code || 'pending'}`
      const label = document.createElement('strong')
      label.textContent = `${colorName(color)} • ${record.number}${color === 'w' ? '.' : '...'} ${record.san} — ${grade?.label || (pendingGrades.has(record.afterFen) ? 'İnceleniyor' : 'Yeterli hesap yok')}`
      card.append(label)
      if (grade) {
        const cue = document.createElement('p'); cue.textContent = grade.cue; card.append(cue)
        const detail = document.createElement('details'); detail.className = 'kk-grade-detail'
        const heading = document.createElement('summary'); heading.textContent = 'Bu değerlendirme neden verildi?'
        const explanation = document.createElement('p'); explanation.textContent = grade.explanation
        detail.append(heading, explanation); card.append(detail)
      }
      box.append(card)
    }
    const latest = [...gradedMoves.values()].sort((a, b) => a.ply - b.ply).at(-1)
    const compact = $('.kk-grade-compact')
    compact.hidden = !latest
    compact.textContent = latest ? `${latest.actor} • ${latest.number}${latest.color === 'b' ? '...' : '.'} ${latest.label}` : ''
    compact.className = `kk-grade-compact kk-grade-${latest?.code || 'pending'}`
  }

  function cacheAnalysis(fen, candidates) {
    analysisCache.set(fen, { candidates })
    if (fen !== game.fen() && [...moveRecords.values()].some(record => record.afterFen === fen)) {
      announce(`past-cache:${fen}`, { alerts: positionAlerts(fen, strongCandidates(candidates)) }, fen)
    }
    const previousGrade = gradedMoves.get(fen)
    if (previousGrade?.shownCandidates && candidates[0]?.score?.type === 'mate' && candidates[0].score.value > 0) {
      const correction = gradePlayedMove(previousGrade, analysisCache.get(previousGrade.beforeFen)?.candidates, candidates[0], playerColor)
      if (correction?.code === 'correction' && previousGrade.code !== 'correction') saveGrade(previousGrade, correction)
    }
    if (analysisCache.size > 400) analysisCache.delete(analysisCache.keys().next().value)
  }

  function saveGrade(record, grade) {
    if (!grade) return
    if (gradedMoves.get(record.afterFen)?.code === grade.code && gradedMoves.get(record.afterFen)?.loss === grade.loss) { pendingGrades.delete(record.afterFen); return }
    grade.assessedAt = Date.now()
    gradedMoves.set(record.afterFen, grade)
    pendingGrades.delete(record.afterFen)
    renderGrades()
    reportDiagnostic({ gradedMoveCount: gradedMoves.size })
    announce(`grade:${record.afterFen}`, { grade }, record.afterFen)
    scheduleJournal()
    // Late background assessments must also reach an already visible report.
    if (lastReport) showReview()
  }

  function gradeKnownMoves() {
    for (const record of pendingGrades.values()) {
      const before = analysisCache.get(record.beforeFen)?.candidates
      const after = analysisCache.get(record.afterFen)?.candidates[0]
      const known = record.shownCandidates?.some(candidate => candidate.uci === record.uci) || record.actualCandidate || before?.some(candidate => candidate.uci === record.uci)
      if (known || record.san.endsWith('#')) saveGrade(record, gradePlayedMove(record, before, after, playerColor))
    }
  }

  function completeMoveGrades() {
    if (gradingTask) return gradingTask
    const epoch = gameEpoch
    gradingTask = (async () => {
      for (const record of [...pendingGrades.values()].slice(-8)) {
        if (epoch !== gameEpoch || disposed) return
        record.gradeAttempts = (record.gradeAttempts || 0) + 1
        try {
          let before = record.gradingCandidates || record.shownCandidates || analysisCache.get(record.beforeFen)?.candidates
          if (!before?.length) {
            const lines = await analyzeHistorical(record.beforeFen, null, epoch)
            if (epoch !== gameEpoch || disposed) return
            before = describeLines(record.beforeFen, lines)
            cacheAnalysis(record.beforeFen, before)
          }
          if (!record.actualCandidate && !before.some(candidate => candidate.uci === record.uci) && !record.san.endsWith('#')) {
            const lines = await analyzeHistorical(record.beforeFen, record.uci, epoch)
            if (epoch !== gameEpoch || disposed) return
            record.actualCandidate = describeLines(record.beforeFen, lines)[0]
          }
          if (epoch !== gameEpoch || disposed) return
          const after = analysisCache.get(record.afterFen)?.candidates[0]
          const grade = gradePlayedMove(record, before, after, playerColor)
          saveGrade(record, grade)
          if (!grade) { pendingGrades.delete(record.afterFen); renderGrades() }
        } catch (error) {
          if (epoch !== gameEpoch || disposed) return
          if (record.gradeAttempts >= 2) pendingGrades.delete(record.afterFen)
          reportDiagnostic({ stage: 'grade_incomplete', error: String(error.message).slice(0, 160) })
        }
      }
    })().finally(() => {
      gradingTask = null
      if (!disposed && pendingGrades.size) setTimeout(() => completeMoveGrades(), 0)
    })
    return gradingTask
  }

  function showReview(ended = game.isGameOver() || !!siteResult) {
    lastReport = reviewReport([...gradedMoves.values()], playerColor, game.history().length, ended)
    const box = $('.kk-summary'); box.hidden = false; box.replaceChildren()
    const title = document.createElement('strong'); title.textContent = lastReport.title
    const overview = document.createElement('p'); overview.textContent = lastReport.overview
    const focus = document.createElement('p'); focus.textContent = `Bu maçta öne çıkan konu: ${lastReport.focus}.`
    box.append(title, overview, focus)
    if (lastReport.opportunity) {
      const opportunity = document.createElement('p'); opportunity.textContent = lastReport.opportunity.text; box.append(opportunity)
    }
    for (const moment of lastReport.moments) {
      const card = document.createElement('article'); card.className = 'kk-review-moment'
      const heading = document.createElement('strong'); heading.textContent = moment.text
      const explanation = document.createElement('p'); explanation.textContent = moment.explanation
      card.append(heading, explanation)
      if (moment.captureComparison) {
        const exchange = document.createElement('p'); exchange.textContent = `Takas dersi: ${moment.captureComparison.text}`
        card.append(exchange)
      }
      box.append(card)
    }
    const coverage = document.createElement('small'); coverage.textContent = lastReport.coverage
    const download = document.createElement('button'); download.type = 'button'; download.textContent = 'Koç raporunu indir'
    download.addEventListener('click', () => downloadJson({ ...lastReport, pgn: game.pgn(), grades: [...gradedMoves.values()] }, 'kare-kare-mac-raporu.json'))
    box.append(coverage, download)
    persistJournal()
  }

  function downloadJson(data, filename) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 30000)
  }

  function applyPreferences() {
    panel.dataset.theme = preferences.theme
    panel.style.setProperty('--kk-text-size', `${preferences.textSize}px`)
    $('.kk-panel-width').value = String(preferences.panelWidth)
    $('.kk-panel-width-value').textContent = `${preferences.panelWidth} px`
    $('.kk-text-size').value = String(preferences.textSize)
    $('.kk-text-size-value').textContent = `${preferences.textSize} px`
    $('.kk-theme').value = preferences.theme
    $('.kk-panel-side').value = preferences.panelSide
    $('.kk-narration-mode').value = preferences.narrationMode
    panel.classList.toggle('kk-moves-hidden', movesHidden())
    $('.kk-hidden-note').hidden = !preferences.hideMoves
    $('.kk-hide-moves').checked = preferences.hideMoves
    $('.kk-hotkey-hint').textContent = preferences.shortcutsEnabled ? `Oklar: ${keyLabel(preferences.keys.arrows) || 'Atanmamış'} • ${keyLabel(preferences.keys.comment)} yorum • ${keyLabel(preferences.keys.plan)} plan` : 'Kısayollar kapalı'
    $('.kk-arrow-quick').title = `Okları aç/kapat (${keyLabel(preferences.keys.arrows) || 'tuş atanmamış'})`
    $('.kk-keys-enabled').checked = preferences.shortcutsEnabled
    $('.kk-recording').checked = preferences.recordingEnabled
    for (const input of panel.querySelectorAll('[data-key-action]')) { input.dataset.value = preferences.keys[input.dataset.keyAction]; input.value = keyLabel(input.dataset.value) || 'Atanmamış' }
    for (const input of panel.querySelectorAll('[data-speech]')) input.checked = preferences[input.dataset.speech]
    $('.kk-voice-rate').value = String(preferences.voiceRate)
    $('.kk-voice-rate-value').textContent = `${preferences.voiceRate.toFixed(2)}×`
    $('.kk-speech-detail').value = preferences.speechDetail
    $('.kk-effects').checked = preferences.effects
    for (const input of panel.querySelectorAll('[data-effect]')) input.checked = preferences[input.dataset.effect]
    $('.kk-effect-volume').value = String(preferences.effectVolume)
    $('.kk-effect-volume-value').textContent = `%${Math.round(preferences.effectVolume * 100)}`
    if (preferences.effects && soundEffects.getState().context !== 'running') $('.kk-effect-state').textContent = 'Efektleri başlatmak için Efekti dene düğmesine bas.'
    refreshVoiceChoices()
    if (preferences.narrationMode === 'off') narrated.clear()
    refreshLearningView(); renderAlerts(); scheduleLayout()
  }

  function refreshVoiceChoices() {
    const voices = nativeSynthesis.getVoices()
    const automatic = preferredVoice(voices)
    const select = $('.kk-voice-select'); select.replaceChildren()
    const option = document.createElement('option'); option.value = ''
    option.textContent = automatic ? `Otomatik: ${automatic.name}` : 'Otomatik Türkçe ses'
    select.append(option)
    for (const voice of voices.filter(item => /^tr(?:-|$)/i.test(item.lang))) {
      const item = document.createElement('option'); item.value = voice.voiceURI || voice.name
      item.textContent = `${voice.name} (${voice.lang})`; select.append(item)
    }
    select.value = preferences.voiceName
    if (select.selectedIndex < 0) select.value = ''
  }

  function invalidatePosition(title, body, key = '') {
    narrated.clear()
    const wasSynchronized = boardSynchronized
    const changed = boardSynchronized || lastMismatchKey !== key
    if (changed) {
      ++analysisToken
      analysisInProgress = false
      boardSynchronized = false
      coachingView = null; manualArrowFen = null
      $('.kk-coaching-details').hidden = true
      selectedSquare = null
      alerts = []
      renderAlerts(); renderCandidates([], false); updateEvaluation()
      $('.kk-selection').hidden = true
      speaker.positionChanged('unverified')
      soundEffects.stop()
      if (wasSynchronized) soundEffects.connection(true, `connection:${gameEpoch}:${lastBoardKey}`)
    }
    lastMismatchKey = key
    if (changed) {
      render(title, body, 'Konum doğrulanıyor', false)
      $('.kk-retry').hidden = false
    }
  }

  function findMoves(pieces) {
    for (const move of game.moves({ verbose: true })) {
      game.move(move)
      const match = samePieces(piecesFromGame(game), pieces)
      game.undo()
      if (match) return [move]
    }
    for (const first of game.moves({ verbose: true })) {
      game.move(first)
      for (const second of game.moves({ verbose: true })) {
        game.move(second)
        const match = samePieces(piecesFromGame(game), pieces)
        game.undo()
        if (match) { game.undo(); return [first, second] }
      }
      game.undo()
    }
    return null
  }

  function clearArrows() { document.querySelectorAll('#kk-board-arrows').forEach(layer => layer.remove()) }

  function drawArrows() {
    clearArrows()
    overlayExpected = false; overlayRedrawPending = false
    // This switch controls idle move arrows only. Narration has a separate
    // preference and temporarily owns the board throughout an explanation.
    for (const button of [$('.kk-arrows'), $('.kk-arrow-quick')]) button.setAttribute('aria-pressed', String(arrowsVisible))
    $('.kk-arrows').textContent = arrowsVisible ? '↗ Hamle okları: Açık' : '↗ Hamle okları: Kapalı'
    $('.kk-arrow-quick').setAttribute('aria-label', `Hamle okları ${arrowsVisible ? 'açık' : 'kapalı'}; aç/kapat`)
    const cue = boardSynchronized && narrated.cue?.fen === game.fen() ? narrated.cue : null
    $('.kk-narration-state').textContent = cue ? `Anlatım: ${cue.label}` : narrated.playing ? 'Anlatım sürüyor • Hamle okları konuşma bitince geri döner.' : ''
    if (disposed || !boardSynchronized) return
    const board = boardElement(), pieces = board && readPieces(board)
    if (!board || !pieces || !samePieces(pieces, piecesFromGame(game))) { overlayRedrawPending = arrowsVisible || narrated.playing; return }
    const showCandidates = arrowsVisible && (!movesHidden() || manualArrowFen === game.fen())
    const svg = renderBoardOverlay(document, { orientation: inferColor(board), boardSize: board.getBoundingClientRect().width, candidates: currentCandidates,
      focused: focusedCandidate, showCandidates, narration: cue, narrating: narrated.playing, playerColor })
    if (svg) { board.appendChild(svg); overlayExpected = true }
  }

  function renderCandidates(candidates, myTurn) {
    currentCandidates = candidates
    narrated.refresh(candidates)
    if (candidates.length && boardSynchronized) published = { fen: game.fen(), candidates: structuredClone(candidates),
      gradingCandidates: structuredClone(analysisCache.get(game.fen())?.candidates || candidates) }
    panel.classList.toggle('kk-has-analysis', !!candidates.length)
    focusedCandidate = null
    const heading = $('.kk-candidates-title')
    heading.hidden = !candidates.length
    $('.kk-feedback').hidden = !candidates.length
    $('.kk-feedback-status').textContent = ''
    heading.textContent = myTurn ? `Güçlü seçenekler (${candidates.length})` : `Rakibin olası cevapları (${candidates.length})`
    const container = $('.kk-candidates')
    container.replaceChildren()
    candidates.forEach((candidate, index) => {
      const card = document.createElement('article')
      card.className = `kk-card kk-card-${index + 1}`
      const top = document.createElement('div'); top.className = 'kk-card-top'
      const move = document.createElement('strong'); move.className = 'kk-move'; move.textContent = `${index + 1}. ${candidate.san}`
      const kind = document.createElement('span'); kind.className = 'kk-kind'; kind.textContent = candidate.kind
      top.append(move, kind)
      const why = document.createElement('p'); why.textContent = `${myTurn ? 'Senin' : 'Rakibin'} fikri: ${playerExplanation(candidate.why, myTurn)}`
      const continuation = document.createElement('small')
      continuation.textContent = continuationText(candidate, playerColor, game.turn())
      const showLine = document.createElement('button')
      showLine.type = 'button'; showLine.className = 'kk-show-line'; showLine.textContent = 'Bu planın oklarını göster'
      showLine.addEventListener('click', () => {
        manualArrowFen = game.fen()
        focusedCandidate = focusedCandidate === index ? null : index
        arrowsVisible = true
        Array.from(container.children).forEach((item, itemIndex) => item.classList.toggle('kk-focused', itemIndex === focusedCandidate))
        drawArrows()
      })
      const details = document.createElement('details'); details.className = 'kk-candidate-detail'
      const detailTitle = document.createElement('summary'); detailTitle.textContent = 'Gerekçe ve devam'
      details.append(detailTitle, why, continuation, showLine)
      const brief = document.createElement('p'); brief.className = 'kk-card-brief'; brief.textContent = briefExplanation(candidate, myTurn)
      card.append(top, brief, details)
      container.appendChild(card)
    })
    drawArrows()
  }

  function recordMove(move, beforeFen) {
    coachingView = null; manualArrowFen = null
    narrated.positionChanged(game.fen())
    speaker.positionChanged(game.fen())
    const record = { san: move.san, uci: move.from + move.to + (move.promotion || ''), color: move.color,
      number: Number(beforeFen.split(' ')[5]), ply: game.history().length, beforeFen, afterFen: game.fen(),
      legalCount: new Chess(beforeFen).moves().length,
      shownCandidates: published?.fen === beforeFen ? structuredClone(published.candidates) : null,
      gradingCandidates: published?.fen === beforeFen ? structuredClone(published.gradingCandidates) : null }
    moveRecords.set(record.afterFen, record)
    if (hasSynchronizedPosition && !gradedMoves.has(record.afterFen)) pendingGrades.set(record.afterFen, record)
    gradeKnownMoves()
    renderGrades()
  }

  function gameEnd() {
    analysisInProgress = false
    coachingView = null; $('.kk-coaching-details').hidden = true; $('.kk-hint-controls').hidden = true
    $('.kk-retry').hidden = true
    renderCandidates([], false)
    alerts = []; renderAlerts()
    showReview(true)
    render(game.isCheckmate() ? (game.turn() === playerColor ? 'Bu oyunu kaybettin.' : 'Bu oyunu kazandın.') : 'Oyun berabere.', 'Öne çıkan hamleler maç raporunda; tamamlanan oyun son 10 maç özetine katılır.', 'Oyun bitti', false)
  }

  function stopEngine(reason) {
    if (reason !== 'Yeni oyun' && reason !== 'Sayfa değişti' && reason !== 'Yeniden başlatıldı' && reason !== 'Motor yeniden başlatılıyor') {
      reportDiagnostic({ stage: 'engine_error', engine: 'error', error: String(reason).slice(0, 160) })
    }
    clearTimeout(engineStartupTimer)
    engineStartupTimer = null
    if (engineMessageHandler) window.removeEventListener('message', engineMessageHandler)
    engineMessageHandler = null
    engineFrame?.remove()
    engineFrame = null
    engineReady = false
    engineBusy = false
    while (queue.length) {
      const job = queue.shift()
      clearTimeout(job.timer)
      job.reject(new Error(reason))
    }
  }

  function startEngine() {
    if (engineFrame) return
    try {
      engineFrame = document.createElement('iframe')
      engineFrame.src = chrome.runtime.getURL('engine.html')
      engineFrame.title = 'Kare Kare satranç motoru'
      engineFrame.style.display = 'none'
      engineMessageHandler = event => {
        if (event.source !== engineFrame?.contentWindow || event.origin !== `chrome-extension://${chrome.runtime.id}`) return
        const data = event.data
        if (data?.source !== 'kare-kare-engine') return
        if (data.type === 'ready') {
          clearTimeout(engineStartupTimer)
          engineStartupTimer = null
          engineReady = true
          reportDiagnostic({ stage: 'engine_ready', engine: 'ready', error: null })
          pump()
          return
        }
        if (data.type === 'error') { stopEngine(data.message || 'Motor çalışmıyor'); return }
        if (data.type === 'analysis' && engineBusy && queue[0]?.id === data.id) {
          const job = queue.shift()
          clearTimeout(job.timer)
          engineBusy = false
          job.resolve(data.lines)
          reportDiagnostic({ stage: 'analysis_ready', engine: 'ready', lineCount: Array.isArray(data.lines) ? data.lines.length : 0, error: null })
          pump()
        }
      }
      window.addEventListener('message', engineMessageHandler)
      engineStartupTimer = setTimeout(() => stopEngine('Motor başlatılamadı'), 10000)
      document.documentElement.appendChild(engineFrame)
    } catch (error) { stopEngine(`Motor başlatılamadı: ${error.message}`) }
  }

  function pump() {
    if (!engineFrame || !engineReady || engineBusy || !queue.length) return
    engineBusy = true
    const job = queue[0]
    try {
      engineFrame.contentWindow.postMessage({ source: 'kare-kare-content', type: 'analyze', id: job.id, fen: job.fen, searchMove: job.searchMove }, `chrome-extension://${chrome.runtime.id}`)
      job.timer = setTimeout(() => stopEngine('Motor zaman aşımı'), 12000)
    } catch { stopEngine('Motor bağlantısı koptu') }
  }

  function analyze(fen, searchMove = null, priority = 0) {
    return new Promise((resolve, reject) => {
      const active = engineBusy ? queue.shift() : null
      if (priority === 0) for (const job of queue) if (job.priority === 0 && job.fen !== fen) job.priority = 2
      queue.push({ id: ++nextJobId, fen, searchMove, priority, resolve, reject })
      queue.sort((a, b) => a.priority - b.priority || a.id - b.id)
      while (queue.length > 10) queue.pop().reject(new Error('Konum kuyruğu yenilendi'))
      if (active) queue.unshift(active)
      if (!engineFrame) startEngine()
      pump()
    })
  }

  async function analyzeHistorical(fen, searchMove, epoch) {
    return withEngineRecovery(
      () => analyze(fen, searchMove, 3),
      () => epoch === gameEpoch && !disposed,
      () => stopEngine('Motor yeniden başlatılıyor')
    )
  }

  async function analyzeWithRecovery(fen, searchMove, token, liveFen = fen, priority = 0) {
    return withEngineRecovery(
      () => analyze(fen, searchMove, priority),
      () => token === analysisToken && game.fen() === liveFen && boardSynchronized,
      () => {
        if (!currentCandidates.length) render('Motor yeniden başlatılıyor', 'Tahtayı okudum; önerileri yeniden hesaplıyorum…', game.turn() === playerColor ? 'Sıra sende' : 'Rakip düşünüyor', false)
        stopEngine('Motor yeniden başlatılıyor')
      }
    )
  }

  function coach(lastMove = null) {
    if (!boardSynchronized) return
    narrated.positionChanged(game.fen())
    ensureJournalSession()
    coachingView = null; manualArrowFen = null; hints.sync(game.fen(), preferences.hideMoves)
    $('.kk-coaching-details').hidden = true; $('.kk-hint-controls').hidden = true
    const fen = game.fen()
    const token = ++analysisToken
    const epoch = gameEpoch
    analysisInProgress = true
    selectedSquare = null
    $('.kk-selection').hidden = true
    speaker.positionChanged(game.fen())
    if (game.isGameOver()) {
      cacheAnalysis(fen, [{ score: { type: game.isCheckmate() ? 'mate' : 'cp', value: 0 }, depth: 99 }])
      gradeKnownMoves()
      updateEvaluation(game.isCheckmate() ? { type: 'mate', value: 0 } : { type: 'cp', value: 0 })
      gameEnd()
      completeMoveGrades().then(() => { if (token === analysisToken) showReview(true) })
      return
    }
    const myTurn = game.turn() === playerColor
    currentCandidates = []
    renderCandidates([], myTurn)
    alerts = []; renderAlerts(); updateEvaluation()
    $('.kk-retry').hidden = true
    const loading = myTurn ? 'Konumu hesaplıyorum…' : 'Rakibin cevaplarını hesaplıyorum…'
    render(myTurn ? 'Sıra sende' : 'Rakip düşünüyor', loading, myTurn ? 'Sıra sende' : 'Rakip düşünüyor', false)
    analyzeWithRecovery(fen, null, token).then(async lines => {
      if (epoch !== gameEpoch || disposed) return
      const candidates = describeLines(fen, lines)
      if (!candidates.length) throw new Error('Motorun geçerli devamı bulunamadı')
      cacheAnalysis(fen, candidates)
      gradeKnownMoves()
      if (token !== analysisToken || game.fen() !== fen) {
        announce(`past:${fen}`, { alerts: positionAlerts(fen, strongCandidates(candidates)) }, fen)
        completeMoveGrades()
        return
      }
      analysisInProgress = false
      let displayed = strongCandidates(candidates)
      renderCandidates(displayed, myTurn)
      updateEvaluation(candidates[0].score)
      alerts = positionAlerts(fen, displayed); renderAlerts()
      reportDiagnostic({ stage: 'coach_ready', evaluation: candidates[0].score, alertCount: alerts.length, gradedMoveCount: gradedMoves.size })
      renderCoaching(lastMove)
      gradeKnownMoves()
      announce(`tactics:${fen}`, { alerts })
      announce(`suggestion:${fen}`, { suggestion: speechSummary })
      if (selectedSquare) checkSelection()
      const extras = tacticalSearchQueue(fen, candidates, 4)
      let combined = candidates
      for (const extra of extras) {
        try {
          const extraLines = await analyzeWithRecovery(fen, extra.uci, token, fen, 1)
          if (epoch !== gameEpoch || disposed) return
          const candidate = describeLines(fen, extraLines)[0]
          const bestScore = scoreValue(candidates[0]?.score)
          const extraScore = scoreValue(candidate?.score)
          if (!candidate || bestScore === null || extraScore === null) continue
          const gap = bestScore - extraScore
          if (gap <= 55 && candidate.motifs.some(motif => motif.type !== 'capture')) {
            combined = [...combined.filter(item => item.uci !== candidate.uci), candidate]
              .sort((a, b) => scoreValue(b.score) - scoreValue(a.score))
            cacheAnalysis(fen, combined)
            displayed = strongCandidates(combined)
            if (token !== analysisToken || game.fen() !== fen) {
              announce(`past-extra:${fen}`, { alerts: positionAlerts(fen, displayed) }, fen)
              completeMoveGrades()
              return
            }
            renderCandidates(displayed, myTurn)
            renderCoaching(lastMove)
            alerts = positionAlerts(fen, displayed); renderAlerts()
            announce(`extra:${fen}:${candidate.uci}`, { alerts: positionAlerts(fen, [candidate]).filter(alert => !alert.conditional) })
            if (selectedSquare) checkSelection()
          }
        } catch { /* A fresh board position can replace this optional search. */ }
      }
      completeMoveGrades()
    }).catch(error => {
      if (token !== analysisToken || error.message === 'Yeni konum geldi') return
      analysisInProgress = false
      reportDiagnostic({ stage: 'explanation_error', error: String(error.message).slice(0, 160) })
      renderCandidates([], myTurn); alerts = []; renderAlerts(); updateEvaluation()
      const intro = positionIntro(game, playerColor, lastMove, [])
      render(intro.title, `${intro.body} Konum doğrulandı, ancak bu hesap tamamlanamadı. Tekrar deneyebilirsin; hata ayrıntısı tanılama kaydına eklendi.`, myTurn ? 'Sıra sende' : 'Rakip düşünüyor', false)
      $('.kk-retry').hidden = false
    })
  }

  function resetSession() {
    narrated.clear()
    clearTimeout(journalTimer); persistJournal()
    if (!reviewNavigation) { journalActiveId = null; journalProfile = null; journalLoad = Promise.resolve(); journalMetadata = {}; assistance = {}; helpSettings.clear() }
    planTracker.reset(); hints.reset(); coachingView = null; manualArrowFen = null; manualSiteResult = false; lastHeard = null
    $('.kk-coaching-details').hidden = true; $('.kk-hint-controls').hidden = true
    game = new Chess(); lastBoardKey = ''; ++analysisToken; ++gameEpoch; speaker.stop(); speechEditor.reset(); soundEffects.reset(); stopEngine('Yeni oyun'); published = null; criticalNotes.clear(); $('.kk-history').hidden = true; currentCandidates = []
    boardSynchronized = false; hasSynchronizedPosition = false; lastMismatchKey = ''; lastMoveListSignature = ''; analysisInProgress = false
    analysisCache.clear(); moveRecords.clear(); pendingGrades.clear(); gradedMoves.clear(); spoken.clear()
    selectedSquare = null; alerts = []; lastReport = null; siteResult = null
    $('.kk-summary').hidden = true; $('.kk-selection').hidden = true; $('.kk-retry').hidden = true
    renderCandidates([], true)
    renderAlerts(); renderGrades(); updateEvaluation()
  }

  function loadGameCheckpoint() {
    const context = checkpointScope(location.pathname, activeMode === 'bot' ? null : verifiedAccount)
    if (context === checkpointContext) return
    if (checkpointContext && context !== checkpointContext) resetSession()
    checkpointContext = context; cachedCheckpoint = null; checkpointAttempt = ''; checkpointSavedFen = ''
    if (!context) return
    checkpointStore.load(context).then(record => {
      if (disposed || context !== checkpointContext) return
      cachedCheckpoint = record; checkpointAttempt = ''
      checkBoard()
    }).catch(() => reportDiagnostic({ stage: 'checkpoint_unavailable' }))
  }

  function saveVerifiedCheckpoint() {
    if (!checkpointContext || checkpointSavedFen === game.fen()) return
    const record = makeCheckpoint(game, checkpointContext)
    if (!record) return
    checkpointSavedFen = game.fen(); cachedCheckpoint = record
    checkpointStore.save(record)
  }

  function syncMoveList(pieces, snapshots) {
    const result = reconstructPosition(snapshots, pieces)
    reportDiagnostic({ moveListSource: result.source, moveListCount: result.count, syncReason: result.reason })
    const reconstructed = result.position
    if (!reconstructed) return null
    const previous = game.history()
    const next = reconstructed.history()
    const shared = previous.length <= next.length && previous.every((san, index) => san === next[index])
    if (!shared) resetSession()
    const from = shared ? previous.length : 0
    const priorObservation = hasSynchronizedPosition
    hasSynchronizedPosition = priorObservation && shared && next.length - from <= 4
    for (let index = from; index < next.length; index++) {
      const beforeFen = game.fen()
      const move = game.move(next[index])
      if (move) recordMove(move, beforeFen)
    }
    hasSynchronizedPosition = priorObservation
    return { changed: from < next.length || !shared, lastMove: game.history({ verbose: true }).at(-1) }
  }

  function checkBoard() {
    scheduleLayout()
    reportDiagnostic({ route: location.pathname })
    if (gameMode(location.pathname) !== activeMode) {
      if (!gameMode(location.pathname)) verifiedAccount = null
      reportDiagnostic({ stage: 'route_changed', route: location.pathname, board: null, engine: null })
      dispose(); return
    }
    if (activeMode !== 'bot') {
      const observed = signedInAccount(document)
      const access = reviewAccess(observed, verifiedAccount)
      verifiedAccount = access.verifiedAccount
      if (!access.allowed) {
        reportDiagnostic({ stage: observed ? 'account_blocked' : 'account_missing',
          access: access.reason, board: null, pieceCount: null, moveCount: null, fen: null, engine: null })
        dispose(); return
      }
      if (!observed && !missingHeaderReported) {
        reportDiagnostic({ stage: 'header_missing_verified_session', access: 'allowed', error: null })
        missingHeaderReported = true
      } else if (observed) missingHeaderReported = false
    }
    loadGameCheckpoint()
    const board = boardElement()
    const pieces = readPieces(board)
    if (!pieces) {
      const foundBoard = board || boardSelectors(activeMode).some(selector => document.querySelector(selector))
      reportDiagnostic({ stage: foundBoard ? 'pieces_unreadable' : 'board_missing', board: foundBoard ? 'unreadable' : 'missing', pieceCount: 0 })
      invalidatePosition('Tahta güncelleniyor', 'Taşların yerleşimini doğruluyorum; eşleşme tamamlanınca öneriler yeniden gelecek.', 'unreadable')
      return
    }
    const key = boardKey(pieces)
    const result = visibleGameResult(document)
    if (result && key === lastBoardKey && !siteResult && !game.isGameOver() && !analysisInProgress) {
      siteResult = result; ++analysisToken; analysisInProgress = false
      coachingView = null; $('.kk-coaching-details').hidden = true; $('.kk-hint-controls').hidden = true
      renderCandidates([], false); alerts = []; renderAlerts(); gradeKnownMoves()
      showReview(true)
      render('Oyun tamamlandı', `Sonuç: ${result}. Maç kaydı ve gelişim özeti güncelleniyor.`, 'Oyun bitti', false)
      const finishToken = analysisToken
      completeMoveGrades().then(() => { if (siteResult && finishToken === analysisToken) showReview(true) })
      return
    }
    if (siteResult && result) return
    if (siteResult && manualSiteResult && key === lastBoardKey) return
    if (manualSiteResult && key !== lastBoardKey) manualSiteResult = false
    if (siteResult && !result) siteResult = null
    if (!lastBoardKey && !colorSelectedManually) { playerColor = inferColor(board); $('.kk-color').value = playerColor }
    const snapshots = moveListSnapshots(document, board?.id)
    const signature = snapshots.map(snapshot => snapshot.sans.join(' ')).join('|')
    if (key === lastBoardKey && boardSynchronized && signature === lastMoveListSignature) return
    reportDiagnostic({ stage: 'board_read', board: 'read', pieceCount: pieces.size })
    const wasSynchronized = boardSynchronized
    const synced = syncMoveList(pieces, snapshots)
    if (synced) {
      boardSynchronized = true; hasSynchronizedPosition = true; lastMismatchKey = ''; soundEffects.connection(false)
      lastBoardKey = key; lastMoveListSignature = signature
      reportDiagnostic({ stage: 'moves_synced', moveCount: game.history().length, fen: game.fen(), board: 'read', error: null })
      saveVerifiedCheckpoint()
      if (synced.changed || !wasSynchronized) coach(synced.lastMove)
      return
    }
    if (samePieces(pieces, piecesFromGame(new Chess())) && game.history().length) resetSession()
    if (samePieces(pieces, piecesFromGame(game))) {
      boardSynchronized = true; hasSynchronizedPosition = true; lastMismatchKey = ''; soundEffects.connection(false)
      lastBoardKey = key; lastMoveListSignature = signature
      reportDiagnostic({ stage: 'position_synced', moveCount: game.history().length, fen: game.fen(), board: 'read', error: null })
      saveVerifiedCheckpoint()
      if (!wasSynchronized || (!currentCandidates.length && !analysisInProgress && !game.isGameOver())) coach(game.history({ verbose: true }).at(-1))
      return
    }
    const restoreAttempt = `${key}|${signature}`
    if (!hasSynchronizedPosition && cachedCheckpoint && checkpointAttempt !== restoreAttempt) {
      checkpointAttempt = restoreAttempt
      const restored = restoreCheckpoint(cachedCheckpoint, checkpointContext, pieces, snapshots)
      if (restored) {
        const synced = syncMoveList(pieces, [{ source: 'verified_game_checkpoint', sans: restored.history() }])
        if (synced) {
          boardSynchronized = true; hasSynchronizedPosition = true; lastMismatchKey = ''; soundEffects.connection(false)
          lastBoardKey = key; lastMoveListSignature = signature
          reportDiagnostic({ stage: 'checkpoint_restored', moveCount: game.history().length, fen: game.fen(), board: 'read', error: null })
          saveVerifiedCheckpoint(); coach(synced.lastMove); return
        }
      }
    }
    if (lastMismatchKey === key && !boardSynchronized) return
    const moves = findMoves(pieces)
    if (!moves) {
      reportDiagnostic({ stage: 'position_mismatch', board: 'read', pieceCount: pieces.size, moveCount: game.history().length,
        fen: game.fen(), error: 'Tahtadaki konum hamle geçmişiyle eşleşmedi' })
      const hasHistory = snapshots.some(snapshot => snapshot.sans.length)
      invalidatePosition(hasHistory ? 'Hamleler henüz eşleşmedi' : 'Hamle geçmişi gerekli', hasHistory
        ? 'Tahta ile hamle listesi uyuşmuyor. Hamleler sekmesini açıp tekrar dene.'
        : 'Bu konum için kayıtlı geçmiş bulunamadı. Odak görünümünü kapatıp hamle listesini aç.', key)
      return
    }
    for (const candidate of moves) { const beforeFen = game.fen(); const move = game.move(candidate); if (move) recordMove(move, beforeFen) }
    boardSynchronized = true; hasSynchronizedPosition = true; lastMismatchKey = ''; soundEffects.connection(false)
    lastBoardKey = key; lastMoveListSignature = signature
    reportDiagnostic({ stage: 'moves_reconstructed', moveCount: game.history().length, fen: game.fen(), error: null })
    saveVerifiedCheckpoint()
    coach(game.history({ verbose: true }).at(-1))
  }

  function checkSelection() {
    const box = $('.kk-selection')
    box.hidden = true
    if (!boardSynchronized || !selectedSquare || game.turn() !== playerColor || !currentCandidates.length) return
    const piece = game.get(selectedSquare)
    if (!piece || piece.color !== playerColor) return
    const ownCandidate = currentCandidates.find(candidate => candidate.from === selectedSquare)
    if (ownCandidate) {
      $('.kk-selection-text').textContent = `Bu taş için güçlü fikir: ${ownCandidate.san}. ${ownCandidate.why}`
    } else {
      const best = currentCandidates[0]
      $('.kk-selection-text').textContent = `Bu taşı oynatmadan önce ${best.san} fikrini de karşılaştır: ${best.why}`
    }
    const select = $('.kk-other-move')
    select.replaceChildren()
    for (const move of game.moves({ square: selectedSquare, verbose: true })) {
      const option = document.createElement('option')
      option.value = move.from + move.to + (move.promotion || '')
      option.textContent = move.san
      select.appendChild(option)
    }
    $('.kk-inspect-button').disabled = !select.options.length
    $('.kk-inspect-result').hidden = true
    box.hidden = false
  }

  let timer = null
  const ownNode = node => node?.nodeType === 1 && (node.id === 'kk-board-arrows' || node.closest?.('#kk-board-arrows') || node === panel || panel.contains(node))
  const observer = new MutationObserver(records => {
    if (records.every(record => ownNode(record.target) || (record.type === 'childList' && [...record.addedNodes, ...record.removedNodes].length && [...record.addedNodes, ...record.removedNodes].every(ownNode)))) return
    clearTimeout(timer); timer = setTimeout(checkBoard, 180); scheduleLayout()
  })
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] })
  const poll = setInterval(checkBoard, 900)
  function toggleArrows() {
    arrowsVisible = !arrowsVisible
    manualArrowFen = arrowsVisible ? game.fen() : null
    assistance.arrows = (assistance.arrows || 0) + 1; scheduleJournal()
    drawArrows()
  }
  const onKeyDown = event => {
    if (!interactiveKeyTarget(event) && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (['ArrowLeft', 'ArrowUp'].includes(event.key) && game.history().length) { reviewNavigation = true; reviewResumePly = Math.max(game.history().length, journalTabState?.moves?.length || 0); clearTimeout(journalTimer) }
      if (event.key === 'ArrowDown' && game.history().length >= reviewResumePly) reviewNavigation = false
    }
    const action = shortcutAction(event, preferences.keys, preferences.shortcutsEnabled)
    if (!action) return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (action === 'arrows') toggleArrows()
    else if (action === 'stop') { speaker.stop(); $('.kk-shortcut-notice').textContent = ' • Konuşma durduruldu' }
    else if (action === 'hint') advanceHint()
    else readSection(action)
  }
  document.addEventListener('keydown', onKeyDown, true)
  const onBoardPointerDown = event => {
    if (panel.contains(event.target)) return
    const board = boardElement()
    if (!board?.contains(event.target)) return
    if (panel.contains(document.activeElement)) document.activeElement.blur?.()
    const piece = event.target.closest('.piece')
    const squareClass = piece && [...piece.classList].find(name => /^square-[1-8][1-8]$/.test(name))
    selectedSquare = squareClass ? files[Number(squareClass[7]) - 1] + squareClass[8] : null
    checkSelection()
  }
  document.addEventListener('pointerdown', onBoardPointerDown, true)
  const onSiteClick = event => {
    if (panel.contains(event.target)) return
    const button = event.target.closest?.('button, [role="button"]')
    if (!button) return
    const labels = [button.getAttribute('aria-label'), button.getAttribute('title'), button.textContent].filter(Boolean).map(label => label.trim().toLocaleLowerCase('tr-TR'))
    const label = labels.join(' ')
    if (labels.some(value => /^(?:new game|play again|rematch|yeni oyun|tekrar oyna|yeniden oyna)$/.test(value))) { newGameIntentFen = game.fen(); reviewNavigation = false; reviewResumePly = 0 }
    else if (/previous move|first move|önceki hamle|ilk hamle/.test(label)) { reviewNavigation = true; reviewResumePly = Math.max(game.history().length, journalTabState?.moves?.length || 0); clearTimeout(journalTimer) }
    else if (/last move|son hamle/.test(label) && game.history().length >= reviewResumePly) reviewNavigation = false
  }
  document.addEventListener('click', onSiteClick, true)
  function dispose() {
    if (disposed) return
    clearTimeout(journalTimer); persistJournal()
    disposed = true
    ++gameEpoch
    ++analysisToken
    observer.disconnect()
    panelResize.disconnect(); if (layoutTimer !== null) clearTimeout(layoutTimer)
    window.removeEventListener('resize', scheduleLayout); window.removeEventListener('scroll', scheduleLayout)
    document.documentElement.classList.remove('kk-coach-below')
    clearTimeout(timer)
    clearInterval(poll)
    document.removeEventListener('pointerdown', onBoardPointerDown, true)
    document.removeEventListener('keydown', onKeyDown, true)
    document.removeEventListener('click', onSiteClick, true)
    window.removeEventListener('pagehide', onPageHide)
    chrome.storage.onChanged?.removeListener(onStorageChanged)
    stopEngine('Sayfa değişti')
    speaker.stop()
    nativeSynthesis.dispose()
    soundEffects.dispose(); speechEditor.reset()
    clearArrows()
    panel.remove()
    mounted = false
    if (activeDispose === dispose) activeDispose = null
  }
  function setOpen(value) {
    open = value; panel.classList.toggle('kk-collapsed', !open)
    $('.kk-minimize').textContent = open ? '−' : '+'
    $('.kk-minimize').setAttribute('aria-label', open ? 'Koçu küçült' : 'Koçu büyüt')
    $('.kk-minimize').setAttribute('aria-expanded', String(open)); scheduleLayout()
  }
  $('.kk-minimize').addEventListener('click', () => setOpen(!open))
  $('.kk-menu-quick').addEventListener('click', () => {
    setOpen(true); $('.kk-menu').open = !$('.kk-menu').open
    if ($('.kk-menu').open) requestAnimationFrame(() => $('.kk-menu').scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  })
  const tabs = [...panel.querySelectorAll('[data-context]')]
  tabs.forEach((button, index) => {
    button.addEventListener('click', () => { activeContext = button.dataset.context; refreshLearningView() })
    button.addEventListener('keydown', event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null
      if (next !== null) { event.preventDefault(); tabs[next].click(); tabs[next].focus() }
    })
  })
  $('.kk-color').addEventListener('change', event => {
    speaker.stop(); spoken.clear(); speechEditor.reset(); soundEffects.reset()
    playerColor = event.target.value; colorSelectedManually = true
    planTracker.reset(); coachingView = null; lastHeard = null
    for (const [key, record] of gradedMoves) {
      const grade = gradePlayedMove(record, analysisCache.get(record.beforeFen)?.candidates, analysisCache.get(record.afterFen)?.candidates[0], playerColor)
      if (grade) gradedMoves.set(key, grade)
    }
    renderGrades(); coach()
  })
  $('.kk-voice').addEventListener('click', () => {
    voiceEnabled = !voiceEnabled
    $('.kk-voice').textContent = voiceEnabled ? '🔊 Ses açık' : '🔈 Ses kapalı'
    $('.kk-voice').setAttribute('aria-pressed', String(voiceEnabled))
    $('.kk-menu-voice-state').textContent = voiceEnabled ? 'Ses açık' : 'Ses kapalı'
    if (voiceEnabled) {
      speaker.stop(); speaker.positionChanged(boardSynchronized ? game.fen() : 'unverified'); speaker.unlock(); spoken.clear()
      say('Ses açıldı.', true, true, false)
      if (boardSynchronized) announce(`voice-on:${++manualSpeechId}`, { grade: [...gradedMoves.values()].at(-1), alerts, suggestion: speechSummary })
    }
    else speaker.stop()
  })
  $('.kk-repeat').addEventListener('click', () => readSection('comment'))
  $('.kk-read-all').addEventListener('click', () => readSection('details'))
  $('.kk-inspect-button').addEventListener('click', async () => {
    const fen = game.fen()
    const token = analysisToken
    const uci = $('.kk-other-move').value
    const result = $('.kk-inspect-result')
    if (!boardSynchronized || !uci || game.turn() !== playerColor) return
    result.hidden = false
    result.textContent = 'Bu hamlenin karşılığını hesaplıyorum…'
    const known = currentCandidates.find(candidate => candidate.uci === uci)
    if (known) { result.textContent = compareAlternative(currentCandidates[0], known); return }
    try {
      const lines = await analyzeWithRecovery(fen, uci, token)
      if (game.fen() !== fen) return
      result.textContent = compareAlternative(currentCandidates[0], describeLines(fen, lines)[0])
    } catch { if (game.fen() === fen) result.textContent = 'Bu hamleyi şu anda inceleyemedim. Tekrar deneyebilirsin.' }
  })
  $('.kk-arrows').addEventListener('click', toggleArrows)
  $('.kk-arrow-quick').addEventListener('click', toggleArrows)
  $('.kk-report').addEventListener('click', () => { showReview(); $('.kk-summary').scrollIntoView({ block: 'nearest', behavior: 'smooth' }) })
  $('.kk-development-button').addEventListener('click', showDevelopment)
  $('.kk-hint-next').addEventListener('click', advanceHint)
  async function savePreferences() {
    applyPreferences()
    try { await chrome.storage.local.set({ kareKarePreferencesV1: preferences }) }
    catch { $('.kk-export-status').textContent = 'Tercihler bu kez kaydedilemedi' }
  }
  for (const [selector, key, type] of [['.kk-panel-width', 'panelWidth', 'number'], ['.kk-text-size', 'textSize', 'number'], ['.kk-theme', 'theme', 'enum'], ['.kk-panel-side', 'panelSide', 'enum'], ['.kk-narration-mode', 'narrationMode', 'enum']]) {
    $(selector).addEventListener(type === 'number' ? 'input' : 'change', event => {
      preferences[key] = type === 'number' ? Number(event.target.value) : event.target.value
      Object.assign(preferences, appearancePreferences(preferences))
      if (key === 'narrationMode') { speaker.stop(); narrated.resume() }
      savePreferences()
    })
  }
  $('.kk-appearance-reset').addEventListener('click', () => { Object.assign(preferences, appearanceDefaults); speaker.stop(); narrated.resume(); savePreferences() })
  for (const input of panel.querySelectorAll('[data-speech]')) input.addEventListener('change', () => {
    preferences[input.dataset.speech] = input.checked
    speaker.stop()
    savePreferences()
  })
  $('.kk-hide-moves').addEventListener('change', event => { preferences.hideMoves = event.target.checked; speaker.stop(); manualArrowFen = null; savePreferences() })
  $('.kk-keys-enabled').addEventListener('change', event => { preferences.shortcutsEnabled = event.target.checked; savePreferences() })
  for (const input of panel.querySelectorAll('[data-key-action]')) input.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.isComposing) return
    event.preventDefault(); event.stopPropagation()
    input.dataset.value = ['Backspace', 'Delete'].includes(event.key) ? '' : normalizeKey(event.key)
    input.value = keyLabel(input.dataset.value) || 'Atanmamış'
  })
  $('.kk-keys-save').addEventListener('click', () => {
    const draft = Object.fromEntries([...panel.querySelectorAll('[data-key-action]')].map(input => [input.dataset.keyAction, input.dataset.value]))
    const result = validateShortcuts(draft)
    if (result.error) { $('.kk-keys-status').textContent = result.error; return }
    preferences.keys = result.bindings; savePreferences(); $('.kk-keys-status').textContent = 'Tek tuşlu kısayollar kaydedildi.'
  })
  $('.kk-keys-reset').addEventListener('click', () => { preferences.keys = { ...defaultShortcuts }; savePreferences(); $('.kk-keys-status').textContent = 'Varsayılan tek tuşlar geri yüklendi.' })
  $('.kk-recording').addEventListener('change', event => {
    preferences.recordingEnabled = event.target.checked
    clearTimeout(journalTimer)
    savePreferences()
    $('.kk-journal-status').textContent = preferences.recordingEnabled ? 'Yerel maç kaydı açık.' : 'Yeni kayıt kapalı. Önceki kayıtlar korunuyor.'
    if (preferences.recordingEnabled) scheduleJournal()
  })
  $('.kk-save-result').addEventListener('click', async () => {
    const selected = $('.kk-result').value
    if (!boardSynchronized || !game.history().length || selected === '*') { $('.kk-journal-status').textContent = 'Doğrulanmış oynanmış maç ve sonuç seçimi gerekiyor.'; return }
    siteResult = selected; manualSiteResult = true; ++analysisToken; analysisInProgress = false
    coachingView = null; speaker.stop(); renderCandidates([], false); alerts = []; renderAlerts(); showReview(true)
    render('Oyun tamamlandı', `Sonuç senin seçiminle kaydedildi: ${selected}.`, 'Oyun bitti', false)
    await persistJournal(); completeMoveGrades()
  })
  $('.kk-journal-export').addEventListener('click', async () => {
    await persistJournal()
    try {
      const records = await matchStore.list(journalProfile || verifiedAccount || signedInAccount(document) || 'yerel-profil')
      downloadJson({ ...records, report: developmentReport(records), exportedAt: new Date().toISOString() }, 'kare-kare-mac-kayitlari.json')
      $('.kk-journal-status').textContent = 'Bu hesabın maç kayıtları indirildi.'
    } catch { $('.kk-journal-status').textContent = 'Maç kayıtları indirilemedi.' }
  })
  $('.kk-journal-delete').addEventListener('click', () => { $('.kk-delete-confirm').hidden = false })
  $('.kk-delete-no').addEventListener('click', () => { $('.kk-delete-confirm').hidden = true })
  $('.kk-delete-yes').addEventListener('click', async () => {
    preferences.recordingEnabled = false; clearTimeout(journalTimer); await savePreferences()
    try {
      const profile = journalProfile || verifiedAccount || signedInAccount(document) || 'yerel-profil'
      await matchStore.clear(profile)
      $('.kk-delete-confirm').hidden = true; $('.kk-milestone').hidden = true
      $('.kk-journal-status').textContent = 'Bu hesabın kayıtları silindi; kayıt kapatıldı.'
      renderDevelopment(developmentReport(await matchStore.list(profile)))
    } catch { $('.kk-journal-status').textContent = 'Silme tamamlanamadı; kayıt kapalı tutuldu.' }
  })
  $('.kk-voice-select').addEventListener('change', event => { preferences.voiceName = event.target.value; savePreferences() })
  $('.kk-voice-rate').addEventListener('input', event => { preferences.voiceRate = Number(event.target.value); savePreferences() })
  $('.kk-speech-detail').addEventListener('change', event => { preferences.speechDetail = event.target.value; speaker.stop(); savePreferences() })
  $('.kk-effects').addEventListener('change', async event => {
    preferences.effects = event.target.checked
    if (preferences.effects) await soundEffects.unlock()
    else soundEffects.stop()
    savePreferences()
  })
  for (const input of panel.querySelectorAll('[data-effect]')) input.addEventListener('change', event => {
    preferences[event.target.dataset.effect] = event.target.checked; soundEffects.stop(); savePreferences()
  })
  $('.kk-effect-volume').addEventListener('input', event => {
    preferences.effectVolume = Number(event.target.value); soundEffects.stop(); savePreferences()
  })
  $('.kk-test-effect').addEventListener('click', () => soundEffects.preview($('.kk-effect-kind').value))
  $('.kk-test-voice').addEventListener('click', () => { speaker.stop(); nativeSynthesis.reset(); speaker.positionChanged(boardSynchronized ? game.fen() : 'unverified'); say('Ses denemesi. Satranç koçun hazır.', true, true, false) })
  chrome.storage.local.get('kareKarePreferencesV1').then(saved => {
    const values = saved.kareKarePreferencesV1 || {}
    Object.assign(preferences, appearancePreferences(values))
    for (const key of Object.keys(defaultPreferences)) if (typeof defaultPreferences[key] === 'boolean' && typeof values[key] === 'boolean') preferences[key] = values[key]
    if (['Alt+O', 'Alt+K', 'Alt+Shift+O'].includes(values.shortcut)) preferences.shortcut = values.shortcut
    const keys = validateShortcuts({ ...defaultShortcuts, ...(values.keys || {}) })
    if (!keys.error) preferences.keys = keys.bindings
    if (typeof values.voiceName === 'string') preferences.voiceName = values.voiceName
    if (Number.isFinite(values.voiceRate) && values.voiceRate >= 0.8 && values.voiceRate <= 1.2) preferences.voiceRate = values.voiceRate
    if (['balanced', 'all', 'critical'].includes(values.speechDetail)) preferences.speechDetail = values.speechDetail
    if (Number.isFinite(values.effectVolume) && values.effectVolume >= 0 && values.effectVolume <= 1) preferences.effectVolume = values.effectVolume
    if (!disposed) applyPreferences()
  }).catch(() => {})
  function onPageHide() { clearTimeout(journalTimer); persistJournal() }
  function onStorageChanged(changes, area) {
    if (area !== 'local' || typeof changes.kareKarePreferencesV1?.newValue?.recordingEnabled !== 'boolean') return
    preferences.recordingEnabled = changes.kareKarePreferencesV1.newValue.recordingEnabled
    if (!preferences.recordingEnabled) clearTimeout(journalTimer)
    $('.kk-recording').checked = preferences.recordingEnabled
  }
  window.addEventListener('pagehide', onPageHide)
  chrome.storage.onChanged?.addListener(onStorageChanged)
  for (const button of panel.querySelectorAll('[data-feedback]')) button.addEventListener('click', async () => {
    if (!currentCandidates.length) return
    try {
      const key = 'kareKareFeedbackV1'
      const stored = await chrome.storage.local.get(key)
      const records = Array.isArray(stored[key]) ? stored[key] : []
      records.push({ at: new Date().toISOString(), verdict: button.dataset.feedback, fen: game.fen(),
        moves: game.history(), playerColor, mode: activeMode,
        title: $('.kk-title').textContent, explanation: $('.kk-message').textContent,
        candidates: currentCandidates.map(item => ({ san: item.san, why: item.why, kind: item.kind })) })
      await chrome.storage.local.set({ [key]: records.slice(-100) })
      $('.kk-feedback-status').textContent = 'Kaydedildi'
    } catch { $('.kk-feedback-status').textContent = 'Not kaydedilemedi' }
  })
  $('.kk-export').addEventListener('click', async () => {
    try {
      const stored = await chrome.storage.local.get('kareKareFeedbackV1')
      const records = stored.kareKareFeedbackV1 || []
      downloadJson({ version: chrome.runtime.getManifest().version, feedback: records, grades: [...gradedMoves.values()], report: lastReport, pgn: game.pgn(),
        health: { audio: { ...audioStatus, ...speaker.getState(), transport: nativeSynthesis.getHealth() }, effects: soundEffects.getState(), boardSynchronized, route: location.pathname, userAgent: navigator.userAgent,
          panel: { placement: panel.dataset.placement, context: activeContext, ...appearancePreferences(preferences) }, narration: { playing: narrated.playing, candidateArrows: arrowsVisible, cue: narrated.cue },
          shortcuts: preferences.keys, hintLevel: hints.level }, coaching: coachingView, plan: planTracker.snapshot(),
        criticalNotes: [...criticalNotes.values()], positions: [...analysisCache].slice(-80).map(([fen, data]) => ({ fen, candidates: data.candidates })) }, 'kare-kare-test-notlari.json')
      $('.kk-export-status').textContent = `${records.length} not indirildi`
    } catch { $('.kk-export-status').textContent = 'Notlar indirilemedi' }
  })
  $('.kk-retry').addEventListener('click', () => {
    if (!boardSynchronized) { lastMismatchKey = ''; checkBoard(); return }
    stopEngine('Yeniden başlatıldı')
    coach(game.history({ verbose: true }).at(-1))
  })
  activeDispose = dispose
  applyPreferences()
  nativeSynthesis.refreshVoices()
  startEngine()
  checkBoard()
  return true
}

let bootstrapTimer = null
function tryMount() {
  if (mounted || document.querySelector('#kare-kare-coach')) return
  const mode = gameMode(location.pathname)
  if (!mode) {
    verifiedAccount = null
    reportDiagnostic({ stage: 'unsupported_route', route: location.pathname, mode: null, access: 'blocked' }); return
  }
  if (mode !== 'bot') {
    const observed = signedInAccount(document)
    const access = reviewAccess(observed, verifiedAccount)
    verifiedAccount = access.verifiedAccount
    if (!access.allowed) {
      const windowOpen = Date.now() >= Date.parse(liveConfig.from) && Date.now() <= Date.parse(liveConfig.until)
      reportDiagnostic({ stage: observed ? 'account_blocked' : 'account_missing', route: location.pathname, mode,
        access: windowOpen ? access.reason : 'outside_test_window',
        board: null, pieceCount: null, moveCount: null, fen: null, engine: null, error: null })
      return
    }
  }
  reportDiagnostic({ stage: 'account_allowed', route: location.pathname, mode, access: 'allowed' })
  mounted = mountCoach(mode)
}
const bootstrapObserver = new MutationObserver(() => {
  if (mounted && !document.querySelector('#kare-kare-coach')) {
    reportDiagnostic({ stage: 'panel_removed_by_page', route: location.pathname, board: null, engine: null })
    activeDispose?.()
  }
  if (mounted) return
  clearTimeout(bootstrapTimer)
  bootstrapTimer = setTimeout(tryMount, 180)
})
bootstrapObserver.observe(document.documentElement, { childList: true, subtree: true })
tryMount()
