import { Chess } from 'chess.js'
import { scoreValue, explainedMotifs, uciMove, numberedVariation, sacrificeEvidence } from './coach-core.js'
import { bookReference, gradeLabels, gradeCue, importantGrades, negativeGrades, ordinaryGrade, positiveGrades } from './move-grades.js'
import { defaultShortcuts } from './keyboard-controls.js'
import { appearanceDefaults } from './coach-layout.js'

const opposite = color => color === 'w' ? 'b' : 'w'
export const colorName = color => color === 'w' ? 'Beyaz' : 'Siyah'
const channelFor = type => ({ royalFork: 'fork', fork: 'fork', pin: 'pin', skewer: 'skewer', mate: 'mate',
  discoveredAttack: 'discovered', discoveredCheck: 'discovered', doubleCheck: 'doubleCheck',
  removeDefender: 'defender', deflection: 'defender', zwischenzug: 'zwischenzug' })[type]

export const defaultPreferences = Object.freeze({
  ...appearanceDefaults,
  suggestions: true, grades: true, mate: true, fork: true, pin: true, skewer: true,
  discovered: true, doubleCheck: true, defender: true, zwischenzug: true, speechDetail: 'balanced',
  effects: false, effectMate: true, effectTactic: true, effectBlunder: true, effectConnection: true, effectVolume: 0.25,
  shortcut: 'Alt+O', keys: defaultShortcuts, shortcutsEnabled: true, recordingEnabled: true, hideMoves: false, voiceName: '', voiceRate: 1.0
})

export function strongCandidates(candidates, limit = 3) {
  const best = candidates[0]
  if (!best) return []
  const bestValue = scoreValue(best.score)
  return candidates.filter((candidate, index) => index === 0 || (bestValue !== null && scoreValue(candidate.score) !== null && bestValue - scoreValue(candidate.score) <= 55)).slice(0, limit)
}

export function positionEvaluation(fen, score) {
  if (!score || !Number.isFinite(score.value)) return null
  const turn = fen.split(' ')[1]
  const whiteValue = turn === 'w' ? score.value : -score.value
  if (score.type === 'mate') {
    const winner = score.value > 0 ? turn : opposite(turn)
    return { text: score.value === 0 ? `Mat • ${colorName(winner)}` : `M${Math.abs(score.value)} • ${colorName(winner)}`,
      detail: score.value === 0 ? `${colorName(winner)} mat etti.` : `${colorName(winner)} için motorun bulduğu zorunlu mat.`,
      whitePercent: winner === 'w' ? 100 : 0 }
  }
  if (score.type !== 'cp') return null
  const value = whiteValue / 100
  return { text: Math.abs(value) < 0.05 ? '0.0' : `${value > 0 ? '+' : ''}${value.toFixed(1)}`,
    detail: Math.abs(whiteValue) < 35 ? 'Konum dengeli' : `${colorName(whiteValue > 0 ? 'w' : 'b')} üstün`,
    whitePercent: 50 + 46 * Math.tanh(whiteValue / 550) }
}

export function positionAlerts(fen, candidates) {
  const turn = fen.split(' ')[1]
  const alerts = []
  const best = candidates[0]
  if (!best) return alerts
  const mate = best.score?.type === 'mate' ? best.score.value : null
  if (mate !== null && Math.abs(mate) >= 1 && Math.abs(mate) <= 5) {
    const color = mate > 0 ? turn : opposite(turn)
    alerts.push({ type: 'mate', channel: 'mate', color, mateIn: Math.abs(mate), context: 'Şimdiki konum',
      text: `${colorName(color)} için ${Math.abs(mate)} hamlede zorunlu mat var; en iyi savunmaya karşı hesaplanan devam.`,
      spoken: `${colorName(color)} için ${Math.abs(mate)} hamlede mat.`, conditional: false })
  }
  const seen = new Set()
  const add = (motif, color, move, context, conditional, setupMove = null) => {
    const channel = channelFor(motif.type)
    if (!channel || channel === 'mate') return
    const key = `${color}:${channel}:${motif.targets.join(',')}:${conditional}:${setupMove || ''}`
    if (seen.has(key)) return
    seen.add(key)
    const targets = motif.targets.join(' ve ')
    alerts.push({ type: motif.type, channel, color, context, move, setupMove, targets: motif.targets, conditional, label: motif.label,
      lesson: motif.lesson, evidence: motif.evidence,
      text: `${move}: ${motif.lesson || `${targets} karelerinde ${motif.label.toLocaleLowerCase('tr-TR')} fikri.`}${conditional ? ' Bu, önerilen ilk hamleye bağlı bir cevap.' : ''}`,
      spoken: `${colorName(color)} için ${conditional ? 'olası cevapta ' : ''}${motif.label.toLocaleLowerCase('tr-TR')} fırsatı.` })
  }
  for (const candidate of candidates) {
    const gap = scoreValue(best.score) - scoreValue(candidate.score)
    if (scoreValue(best.score) === null || scoreValue(candidate.score) === null || gap > 55) continue
    for (const motif of candidate.motifs || []) {
      if (motif.type === 'pin' && !motif.evidence) continue
      add(motif, turn, candidate.san, 'Hamle sırası bu tarafta', false)
    }
    if (!candidate.answerUci) continue
    const after = new Chess(fen)
    if (!uciMove(after, candidate.uci)) continue
    for (const motif of explainedMotifs(after.fen(), candidate.pv?.slice(1) || [candidate.answerUci])) {
      add(motif, opposite(turn), candidate.answer, `${candidate.san} sonrası olası cevap`, true, candidate.san)
    }
  }
  return alerts.slice(0, 7)
}

export function gradePlayedMove(record, beforeCandidates, afterBest, playerColor) {
  const baseline = record.gradingCandidates?.length ? record.gradingCandidates : record.shownCandidates?.length ? record.shownCandidates : beforeCandidates
  const best = baseline?.[0]
  if (!best?.score) return null
  const shown = record.shownCandidates?.find(candidate => candidate.uci === record.uci)
  const known = shown || record.actualCandidate || baseline.find(candidate => candidate.uci === record.uci)
  const preferAfter = afterBest?.score && (!known?.score ||
    (afterBest.score.type === 'mate' && afterBest.score.value > 0 && !shown && record.uci !== best.uci))
  const actual = record.san.endsWith('#') ? { type: 'mate', value: 1 }
    : preferAfter ? { type: afterBest.score.type, value: -afterBest.score.value } : known?.score
  const depth = Math.min(best.depth || 0, record.san.endsWith('#') ? best.depth : preferAfter ? afterBest.depth || 0 : known?.depth || 0)
  if (!actual || depth < 10) return null
  const beforeValue = scoreValue(best.score)
  const afterValue = scoreValue(actual)
  if (beforeValue === null || afterValue === null) return null
  const tactical = best.motifs?.find(motif => motif.label === best.kind) || best.motifs?.find(motif => motif.type !== 'capture') ||
    (best.score.type === 'mate' && best.score.value > 0 && best.score.value <= 5 ? { type: 'mate', label: 'Mat ağı' } : null)
  const forced = record.legalCount === 1
  let loss = Math.max(0, beforeValue - afterValue)
  let code
  const refutedRecommendation = shown && afterBest?.score?.type === 'mate' && afterBest.score.value > 0 &&
    !(shown.score?.type === 'mate' && shown.score.value < 0) && !record.san.endsWith('#')
  if (refutedRecommendation) {
    code = 'correction'; loss = 0
  } else if (best.score.type === 'mate' && best.score.value < 0 && actual.type === 'mate' && actual.value < 0) {
    code = 'good'; loss = 0 // A lost position does not make every forced reply a blunder.
  } else if (best.score.type === 'mate' && best.score.value < 0 && actual.type !== 'mate') {
    return null // Inconsistent searches; do not manufacture a grade.
  } else if (actual.type === 'mate' && actual.value < 0 && !(best.score.type === 'mate' && best.score.value < 0)) {
    code = 'blunder'
  } else if (best.score.type === 'mate' && best.score.value > 0 && !(actual.type === 'mate' && actual.value > 0)) {
    code = actual.type === 'mate' && actual.value < 0 ? 'blunder' : 'missed'
  } else {
    if (best.score.type === 'mate' && actual.type === 'mate') loss = Math.max(0, actual.value - best.score.value) * 15
    const second = baseline[1]
    const gap = second?.score && second.depth >= 10 ? beforeValue - scoreValue(second.score) : 0
    if (shown && loss > 55) { code = 'good'; loss = 0 }
    else code = ordinaryGrade({ loss, forced, bestMove: record.uci === best.uci || record.san.endsWith('#'),
      gap, beforeValue, afterValue, alternativeValue: second?.depth >= 10 ? scoreValue(second.score) : null, tactical: !!tactical,
      sacrifice: record.uci === best.uci && loss <= 15 ? sacrificeEvidence(record.beforeFen, best.pv) : null,
      book: bookReference(record.beforeFen, record.uci) })
  }
  const label = gradeLabels[code]
  const own = record.color === playerColor
  const actor = own ? 'Sen' : 'Rakip'
  const cue = gradeCue(code, own, record.san.endsWith('#'))
  const opening = code === 'book' ? bookReference(record.beforeFen, record.uci) : null
  const reply = afterBest?.san || known?.answer
  const replyWhy = afterBest?.why || known?.answerWhy
  const allowsMate = actual.type === 'mate' && actual.value < 0
  const consequence = allowsMate ? `${record.san} sonrası rakip${reply ? ` ${reply} ile` : ''} ${Math.abs(actual.value)} hamlede zorunlu mat bulabiliyor.`
    : record.uci !== best.uci && reply ? `${record.san} sonrası rakibin güçlü cevabı ${reply}${replyWhy ? `: ${replyWhy}` : '.'}` : ''
  const recommendedLine = best.pv?.length ? numberedVariation(record.beforeFen, best.pv) : null
  const lesson = recommendedLine ? ` ${record.number}${record.color === 'w' ? '.' : '...'} hamlesinden önceki konum için hesaplanan devam: ${recommendedLine}.` : ''
  return { ...record, code, label, actor, cue, loss, depth, opening, gradingVersion: 2, motif: allowsMate ? 'Mat savunması' : tactical?.label || null,
    recommendedLine, captureComparison: known?.captureComparison || (negativeGrades.has(code) ? best.captureComparison : null) || null,
    best, actualScore: actual, refutation: code === 'correction' ? afterBest : null, text: `${record.number}${record.color === 'w' ? '.' : '...'} ${record.san}: ${label}.`,
    explanation: code === 'correction' ? `Bu hamle koçun önerileri arasındaydı. Yeni hesapta rakibin ${afterBest.san || 'zorlayıcı'} cevabı mat gösterdi; bu kayıt oyuncu hatası olarak sayılmadı.`
      : opening ? `${record.san}, yerel açılış referansındaki ${opening.name} örneğinde bulunuyor. ${known?.why || best.why}`
      : positiveGrades.has(code) && known ? `${known.san}: ${known.why}`
      : `${consequence} ${best.san} daha güçlü devam olarak hesaplandı: ${best.why}${lesson || (best.answer ? ` Bu alternatifte rakibin olası yanıtı ${best.answer}.` : '')}`.trim() }
}

export function reviewReport(events, playerColor, totalMoves, ended = false) {
  const own = events.filter(event => event.color === playerColor)
  const corrections = own.filter(event => event.code === 'correction').length
  const mistakes = own.filter(event => negativeGrades.has(event.code)).sort((a, b) => b.loss - a.loss)
  const strengths = own.filter(event => positiveGrades.has(event.code)).sort((a, b) => Number(['great', 'brilliant'].includes(b.code)) - Number(['great', 'brilliant'].includes(a.code)))
  const counts = new Map()
  for (const event of mistakes) if (event.motif) counts.set(event.motif, (counts.get(event.motif) || 0) + 1)
  const recurring = [...counts].sort((a, b) => b[1] - a[1]).find(([, count]) => count >= 2)
  const focus = recurring ? `${recurring[0]} fikrini fark etme ve rakibin zorlayıcı cevabını hesaplama`
    : mistakes[0]?.motif ? `${mistakes[0].motif} fikrini doğru anda kullanma` : 'Aday hamleyi seçmeden önce rakibin en güçlü cevabını hesaplama'
  const moments = [...mistakes.slice(0, 2), ...strengths.slice(0, 1)]
  const exchangeLesson = own.find(event => event.captureComparison && positiveGrades.has(event.code))
  if (exchangeLesson && !moments.some(event => event.afterFen === exchangeLesson.afterFen)) moments.push(exchangeLesson)
  const gift = events.filter(event => event.color !== playerColor && event.code === 'blunder').sort((a, b) => b.loss - a.loss)[0]
  const response = gift && own.find(event => event.ply === gift.ply + 1)
  const opportunity = !gift ? null : {
    fen: gift.afterFen,
    text: `Rakibin ${gift.number}${gift.color === 'w' ? '.' : '...'} ${gift.san} hamlesi önemli bir fırsat verdi. ${!response
      ? 'Bu fırsata verdiğin yanıt için henüz yeterli değerlendirme yok.'
      : response.code === 'correction' ? 'Bu konumda koçun önceki önerisi düzeltildi; yanıtın oyuncu hatası sayılmadı.'
      : positiveGrades.has(response.code) ? `${response.san} ile güçlü bir karşılık buldun.`
        : `${response.san} yerine ${response.best.san} devamı daha güçlüydü; fırsatı daha iyi değerlendirebilirdin.`}` }
  return { title: ended ? 'Maç sonu koç raporu' : 'Bu ana kadarki koç raporu',
    overview: own.length ? `Bu oyunda senin ${own.length} hamlen değerlendirildi. ${strengths.length} güçlü veya makul seçim, ${mistakes.length} geliştirme noktası bulundu.${corrections ? ` ${corrections} koç önerisi sonradan düzeltildi ve oyuncu hatası sayılmadı.` : ''}`
      : 'Bu oyun için henüz yeterli hamle değerlendirmesi birikmedi.',
    focus, recurring: !!recurring, moments, opportunity, totalMoves,
    coverage: 'Rapor, oyun sırasında yeterli değerlendirme elde edilen hamlelere dayanır.' }
}

// Freeze perspective and branch information when the analysis event is created.
// A queued message must never infer its actor from the board's later turn.
export function coachingSpeechEvents({ grade, alerts = [], suggestion }, { fen, playerColor, key, revealMoves = true }) {
  const entries = []
  const plyFor = value => {
    const fields = String(value || '').split(' ')
    return /^[wb]$/.test(fields[1]) && Number(fields[5]) > 0 ? (Number(fields[5]) - 1) * 2 + (fields[1] === 'b' ? 1 : 0) : null
  }
  if (grade) {
    const own = grade.color === playerColor
    const subject = own ? 'Senin hamlen' : 'Rakibin hamlesi'
    entries.push({ key: `grade:${grade.afterFen}:${grade.code}`, fen: grade.afterFen || fen,
      ply: grade.ply ?? plyFor(grade.afterFen || fen), color: grade.color, role: subject,
      channel: 'grades', critical: importantGrades.has(grade.code) || !!grade.san?.endsWith('#'), priority: 2,
      gradeCode: grade.code, own, checkmate: !!grade.san?.endsWith('#'), variationGroup: `grade:${grade.code}:${own}`, text: gradeCue(grade.code, own, grade.san?.endsWith('#')) || grade.cue,
      historicalText: grade.code === 'correction' ? 'Önceki koç önerisi sonraki hesapta düzeltildi; ayrıntı kritik notlarda.'
        : `${subject} ${grade.label.toLocaleLowerCase('tr-TR')} olarak değerlendirildi.` })
  }
  for (const alert of alerts) {
    const own = alert.color === playerColor
    const side = own ? 'senin için' : 'rakip için'
    const pastSide = own ? 'Senin için' : 'Rakip için'
    const motif = (alert.label || { mate: 'Mat', fork: 'Çatal', pin: 'Açmaz', skewer: 'Şiş', discovered: 'Açarak saldırı',
      doubleCheck: 'Çifte şah', defender: 'Savunucuyu uzaklaştırma', zwischenzug: 'Ara şah' }[alert.channel] || 'Taktik').toLocaleLowerCase('tr-TR')
    let text
    let historicalText
    if (alert.channel === 'mate') {
      text = `Bu konumda ${side} ${alert.mateIn} hamlede zorunlu mat var.`
      historicalText = `${pastSide} ${alert.mateIn} hamlede zorunlu mat hesaplanmıştı; bu, güncel konumun uyarısı değil.`
    } else if (alert.conditional) {
      const setupOwn = fen.split(' ')[1] === playerColor
      const setup = setupOwn ? 'Sen' : 'Rakip'
      const reply = own ? 'sen' : 'rakip'
      text = revealMoves && alert.setupMove && alert.move
        ? `${setup} ${alert.setupMove} oynarsa${setupOwn ? 'n' : ''}, ${reply} ${alert.move} ile ${motif} fikrini kullanabilir${own ? 'sin' : ''}.`
        : `${setupOwn ? 'Önerilen hamleyi oynarsan' : 'Rakip önerilen hamleyi oynarsa'}, ${side} ${motif} fırsatı doğabilir.`
      historicalText = `${pastSide} koşullu bir ${motif} fikri hesaplanmıştı; önerilen ilk hamleye bağlıydı.`
    } else {
      text = `${own ? 'Fırsat' : 'Rakibin fikri'}: ${revealMoves && alert.move ? `${alert.move} ile ` : ''}${motif}.`
      historicalText = `${pastSide} ${motif} fırsatı hesaplanmıştı; ayrıntı kritik notlarda.`
    }
    entries.push({ key: `alert:${fen}:${alert.color}:${alert.type}:${alert.targets?.join(',') || alert.spoken}:${alert.setupMove || ''}:${alert.move || ''}`,
      fen, ply: plyFor(fen), color: alert.color, role: own ? 'Senin taktiğin' : 'Rakibin taktiği',
      channel: alert.channel, conditional: !!alert.conditional, visualAlert: alert, text, historicalText,
      critical: true, priority: alert.channel === 'mate' ? 4 : alert.conditional ? 1 : 3 })
  }
  if (suggestion) entries.push({ key, fen, ply: plyFor(fen), channel: 'suggestions', role: 'Olası devam',
    text: `Olası devam. ${suggestion}`, critical: false, priority: 0 })
  return entries
}

export function speechForEvents({ grade, alerts = [], suggestion }, preferences, context = null) {
  if (context) return coachingSpeechEvents({ grade, alerts, suggestion }, { ...context, revealMoves: preferences.suggestions && !preferences.hideMoves })
    .filter(item => preferences[item.channel] && !(item.channel === 'suggestions' && preferences.hideMoves))
    .map(item => item.fen !== context.fen && item.historicalText
      ? `Geçmiş konum. ${context.historyContext ? `${context.historyContext(item.fen)}. ` : ''}${item.historicalText}` : item.text).join(' ')
  const parts = []
  if (grade && preferences.grades) parts.push(grade.cue)
  for (const alert of alerts) if (preferences[alert.channel]) parts.push(alert.spoken)
  if (suggestion && preferences.suggestions && !preferences.hideMoves) parts.push(suggestion)
  return [...new Set(parts)].join(' ')
}

export function matchesArrowShortcut(event, shortcut = 'Alt+O') {
  if (event.repeat || event.ctrlKey || event.metaKey || !event.altKey || event.defaultPrevented) return false
  if (event.target?.closest?.('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return false
  return event.code === (shortcut.endsWith('K') ? 'KeyK' : 'KeyO') && event.shiftKey === shortcut.includes('Shift')
}
