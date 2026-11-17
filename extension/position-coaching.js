import { Chess } from 'chess.js'
import { briefExplanation, continuationText, profitableCaptures, scoreValue, tacticalMotifs, variationMoves } from './coach-core.js'
import { coachingSpeechEvents } from './coach-insights.js'

const names = { p: 'piyon', n: 'at', b: 'fil', r: 'kale', q: 'vezir', k: 'şah' }
const opposite = color => color === 'w' ? 'b' : 'w'
const moveUci = move => move.from + move.to + (move.promotion || '')
const squarePieces = game => game.board().flat().filter(Boolean)
const legalLine = (fen, candidate) => candidate && variationMoves(fen, candidate.pv?.length ? candidate.pv : [candidate.uci], 6)

export function positionChanges(fen, lastMove, playerColor) {
  if (!lastMove?.before || lastMove.after !== fen) return []
  const before = new Chess(lastMove.before), after = new Chess(fen)
  const next = after.turn()
  const old = profitableCaptures(before, next)
  const fresh = profitableCaptures(after, next)
  const result = []
  const gift = fresh.find(capture => !old.some(previous => previous.to === capture.to && previous.gain >= capture.gain))
  if (gift) result.push({ type: 'new-profitable-capture', targets: [gift.to], actor: next, move: { from: gift.from, to: gift.to },
    text: `${lastMove.color === playerColor ? 'Bu hamleden sonra rakip' : 'Rakibin hamlesinden sonra sen'} ${gift.san} ile ${gift.to} karesindeki taşı kazançlı biçimde alabilir${next === playerColor ? 'sin' : ''}.` })
  const removed = old.find(capture => !fresh.some(item => item.to === capture.to) && after.get(capture.to)?.color === opposite(next))
  if (removed && !gift) result.push({ type: 'threat-ended', targets: [removed.to],
    text: `${removed.to} karesindeki ${names[after.get(removed.to).type]} için önceki doğrudan alış tehdidi giderildi.` })
  const priorActor = profitableCaptures(before, lastMove.color)
  const newThreat = profitableCaptures(after, lastMove.color).find(capture => !priorActor.some(old => old.to === capture.to && old.gain >= capture.gain))
  if (newThreat) result.push({ type: 'new-threat', targets: [newThreat.to], actor: lastMove.color, move: { from: newThreat.from, to: newThreat.to },
    text: lastMove.color === playerColor ? `Rakip önlem almazsa sonraki sıranda ${newThreat.san} alışı kazanç sağlayabilir.` : `Önlem almazsan rakip ${newThreat.san} ile kazanç sağlayabilir.` })
  for (const file of 'abcdefgh') {
    const wasClosed = squarePieces(before).some(piece => piece.type === 'p' && piece.square[0] === file)
    const isOpen = !squarePieces(after).some(piece => piece.type === 'p' && piece.square[0] === file)
    if (wasClosed && isOpen && squarePieces(after).some(piece => piece.color === playerColor && piece.type === 'r' && piece.square[0] === file)) {
      result.push({ type: 'open-file', targets: [file], text: `${file} dikeyi piyonlardan temizlendi; bu dikeydeki kalenin önünde yeni bir açık hat oluştu.` })
      break
    }
  }
  const motif = tacticalMotifs(lastMove.before, moveUci(lastMove)).find(item => ['doubleCheck', 'discoveredCheck'].includes(item.type))
  if (motif) result.push({ type: motif.type, targets: motif.targets, text: lastMove.color === playerColor
    ? `${motif.label}: rakip şahını savunmak zorunda.` : `${motif.label}: önce şahının güvenliğini sağlamalısın.` })
  return result.slice(0, 2)
}

export function opponentComment(fen, candidates, playerColor, reveal = true) {
  const game = new Chess(fen), enemy = opposite(playerColor)
  if (game.isGameOver()) return 'Oyun tamamlandı; güncel rakip cevabı yok.'
  if (game.turn() === playerColor && game.isCheck()) return reveal
    ? 'Şahın tehdit altında. Önce yasal şah savunmasını seç; rakibin diğer fikirleri bu zorunlu cevaptan sonra değerlendirilmeli.'
    : 'Şahın tehdit altında; önce yasal savunmayı bul.'
  const best = candidates?.[0]
  if (game.turn() === enemy) return best ? reveal
    ? `Rakibin hesaplanan güçlü cevabı ${best.san}. ${briefExplanation(best, false)}`
    : 'Hamle sırası rakipte; hesaplanan cevabın taş ve kare ayrıntıları gizli.' : 'Rakibin cevabı için hesap henüz hazır değil.'
  const threat = profitableCaptures(game, enemy)[0]
  let text = threat ? reveal ? `Yanıt vermezsen rakip ${threat.san} alışıyla maddi kazanç sağlayabilir.` : 'Yanıt verilmesi gereken kazançlı bir alış tehdidi var.' : 'Yerel takas hesabında rakip için doğrudan kazançlı alış bulunmadı; bu, başka tehdit olmadığı anlamına gelmez.'
  if (!best?.answerUci) return text
  const after = new Chess(fen)
  if (variationMoves(fen, [best.uci, best.answerUci]).length < 2 || !after.moves({ verbose: true }).some(move => moveUci(move) === best.uci)) return text
  after.move({ from: best.uci.slice(0, 2), to: best.uci.slice(2, 4), promotion: best.uci[4] || 'q' })
  if (threat) text += profitableCaptures(after, enemy).some(item => item.to === threat.to)
    ? ' Ana aday bu alış imkânını doğrudan kapatmıyor; hesap karşı oyunu tercih ediyor.' : ' Ana aday bu doğrudan alış tehdidini gideriyor.'
  if (reveal && best.answer) text += ` Sen ${best.san} oynarsan, rakip ${best.answer} ile cevap verebilir.`
  else if (!reveal) text += ' Önerilen ilk hamleye bağlı olası cevap ayrıntısı gizli.'
  return text
}

export function compareCandidates(fen, candidates, playerColor) {
  const [a, b] = candidates || []
  if (!a) return { text: 'Adaylar henüz hesaplanmadı.', candidates: [] }
  if (!b) return { text: 'Bu hesapta güçlü aday toleransında tek seçenek var; ikinci bir güçlü hamle uydurulmadı.', candidates: [a.uci] }
  const first = legalLine(fen, a), second = legalLine(fen, b)
  const av = scoreValue(a.score), bv = scoreValue(b.score)
  if (!first?.length || !second?.length || a.depth < 10 || b.depth < 10 || av === null || bv === null || Math.abs(av - bv) > 55) return { text: 'Bu iki seçenek aynı güçlü aday aralığında doğrulanmadı.', candidates: [] }
  const own = new Chess(fen).turn() === playerColor
  const forcedA = new Chess(first[0].after).moves().length
  const forcedB = new Chess(second[0].after).moves().length
  let difference = first[0].san.includes('+') !== second[0].san.includes('+')
    ? `${first[0].san.includes('+') ? a.san : b.san} doğrudan şah çekerek cevabı sınırlar; diğer seçenek şah çekmiyor.`
    : !!first[0].captured !== !!second[0].captured
      ? `${first[0].captured ? a.san : b.san} hemen bir alışa giriyor; diğer seçenek taş değişmeden konumu düzenliyor.`
      : (forcedA === 1) !== (forcedB === 1) ? `${forcedA === 1 ? a.san : b.san} sonrasında rakibin tek yasal cevabı var; diğerinde birden fazla yasal cevap bulunuyor.`
        : `${a.san}: ${briefExplanation(a, own)} ${b.san}: ${briefExplanation(b, own)}`
  return { text: `İki seçenek de güçlü aday aralığında. ${difference} ${Math.abs(av - bv) <= 15 ? 'Hesap farkı küçük; plan farkına bak.' : 'İlk adayın hesaplanan değerlendirmesi daha yüksek.'}`,
    candidates: [a.uci, b.uci], scoreGap: Math.abs(av - bv), lines: [a.lineText, b.lineText] }
}

function planDescription(fen, candidate) {
  const game = new Chess(fen), line = legalLine(fen, candidate)
  if (!line?.length || candidate.depth < 10 || scoreValue(candidate.score) === null) return null
  const first = line[0]
  const motif = candidate.motifs?.find(item => item.type !== 'capture')
  const target = motif?.prize || motif?.evidence?.square || motif?.targets?.find(square => game.get(square)?.color !== first.color)
  const openFile = first.piece === 'r' && !squarePieces(new Chess(first.after)).some(piece => piece.type === 'p' && piece.square[0] === first.to[0])
  const signature = motif ? `tactic:${motif.type}:${target || ''}` : first.captured ? `capture:${first.to}` : openFile ? `file:${first.to[0]}` : `${first.piece}:${first.to}`
  return { signature, goal: briefExplanation(candidate), target: target || (first.captured ? first.to : null),
    sourceFen: fen, sourcePly: (Number(fen.split(' ')[5]) - 1) * 2 + (game.turn() === 'b' ? 1 : 0), color: first.color,
    steps: line.filter(move => move.color === first.color).slice(0, 2).map(moveUci), first: first.san,
    next: line[2]?.san || null, continuation: line[2] ? `Rakip ${line[1].san} oynarsa, sen ${line[2].san} ile devam edebilirsin.` : '' }
}

export function createPlanTracker() {
  let active = null, latest = null, lastKey = null
  return {
    observe(fen, candidates, history, playerColor) {
      const game = new Chess(fen)
      const key = `${fen}:${candidates?.[0]?.uci || ''}:${playerColor}`
      if (key === lastKey) return latest
      lastKey = key
      if (active?.color !== playerColor) active = null
      const next = game.turn() === playerColor ? planDescription(fen, candidates?.[0]) : null
      const ownSince = active ? history.filter((move, index) => index >= active.sourcePly && move.color === playerColor) : []
      let status = 'new', progress = 0, update = ''
      if (active) {
        while (progress < ownSince.length && progress < active.steps.length && moveUci(ownSince[progress]) === active.steps[progress]) progress++
        const captureGoal = active.target && ownSince.some(move => move.to === active.target && move.captured)
        if (captureGoal || (progress >= active.steps.length && progress > 0)) {
          status = 'completed'; update = 'Önceki planın hesaplanan hedefi gerçekleşti.'
        } else if (ownSince.length > progress) {
          status = 'changed'; update = 'Farklı bir devam seçtin; planı oluşan yerleşime göre güncelliyorum.'
        } else if (game.turn() !== playerColor) {
          status = progress ? 'partial' : 'continuing'
          update = progress ? 'Planın ilk adımı gerçekleşti; sonraki adım rakibin cevabına bağlı.' : 'Plan korunuyor; rakibin cevabı bekleniyor.'
        } else if (next?.signature === active.signature || next?.steps[0] === active.steps[progress]) {
          status = progress ? 'partial' : 'continuing'; update = progress ? 'İlk adım tamam; güncel hesap planın devamını destekliyor.' : 'Güncel hesap önceki hedefi destekliyor.'
        } else if (candidates?.some(candidate => candidate.uci === active.steps[progress])) {
          status = 'changed'; update = 'Önceki devam hâlâ güçlü bir seçenek; ana aday bu kez farklı bir hedef seçiyor.'
        } else {
          const expected = active.steps[progress]
          const legal = expected && game.moves({ verbose: true }).some(move => moveUci(move) === expected)
          status = legal ? 'changed' : 'blocked'
          update = legal ? 'Önceki devam yasal olsa da güncel güçlü adaylar arasında değil; yeni hesabın hedefi değişti.' : 'Rakibin cevabından sonra önceki somut devam artık yasal değil; planı değiştirmek gerekiyor.'
        }
      }
      const previous = active
      if (next && (!active || ['completed', 'changed', 'blocked'].includes(status))) active = next
      const plan = active || next
      const updateAudible = ['partial', 'completed', 'changed', 'blocked'].includes(status) && (latest?.status !== status || latest?.progress !== progress)
      latest = { status, progress, update, updateAudible, goal: plan?.goal || 'Kendi planın için rakibin cevabından sonraki doğrulanmış hesap bekleniyor.',
        continuation: next?.continuation || plan?.continuation || '', previousGoal: previous?.goal || null, nextStep: next?.first || null,
        text: [update, plan?.goal, game.turn() === playerColor ? `${next ? `Güncel ilk adım ${next.first}. ${next.goal !== plan?.goal ? next.goal : ''}` : ''} ${next?.continuation || ''}`
          : 'Sonraki hamle rakibin gerçek cevabına göre yeniden hesaplanacak.'].filter(Boolean).join(' ') }
      return latest
    },
    snapshot() { return { version: 1, active, latest } },
    restore(value, history, playerColor) {
      if (value?.version !== 1 || value.active?.color !== playerColor || !Number.isInteger(value.active.sourcePly) || value.active.sourcePly < 0 || value.active.sourcePly > history.length ||
          !Array.isArray(value.active.steps) || !value.active.steps.length || value.active.steps.length > 2 || !value.active.steps.every(uci => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) || typeof value.active.goal !== 'string') return false
      const game = new Chess()
      try { for (const move of history.slice(0, value.active.sourcePly)) game.move(move.san || move) } catch { return false }
      if (game.fen() !== value.active.sourceFen) return false
      active = value.active; latest = value.latest; lastKey = null; return true
    },
    reset() { active = null; latest = null; lastKey = null }
  }
}

export function hintContent(fen, candidate, playerColor = new Chess(fen).turn()) {
  if (!candidate) return { target: 'Konum doğrulanıp hesap tamamlandığında hedef açıklanacak.', idea: 'Doğrulanmış fikir henüz hazır değil.', move: '' }
  const game = new Chess(fen), motif = candidate.motifs?.find(item => item.type !== 'capture')
  const pieces = (motif?.targets || []).map(square => game.get(square)).filter(Boolean)
  const target = pieces.length ? `Hedefteki ${[...new Set(pieces.map(piece => names[piece.type]))].join(' ve ')} yerleşimini karşılaştır.`
    : candidate.piece === 'r' ? 'Kalelerin etkinliğini ve açık hatları karşılaştır.'
      : candidate.piece === 'p' ? 'Piyon yapısını ve merkezdeki alanı incele.'
        : 'Taşlarının etkinliğini ve rakibin zayıf noktalarını karşılaştır.'
  const idea = motif ? `${motif.label} fikrini araştır; rakibin en güçlü cevabını da hesaba kat.`
    : candidate.captured ? 'Bu alışın ardından verilecek ve alınacak taşları karşılaştır.'
      : candidate.piece === 'r' ? 'Kalenin etkinliğini artırma fikrini değerlendir.' : 'Taş etkinliğini artıran konumsal devamı araştır.'
  return { target, idea, move: `${candidate.san}: ${briefExplanation(candidate, game.turn() === playerColor)}` }
}

export function sectionSpeech(action, { fen, view, hidden, hintLevel, candidates = [], playerColor, alerts = [], grades = [], lastHeard = null }) {
  if (action === 'repeat') {
    if (!lastHeard) return { text: 'Henüz dinlenmiş bir açıklama yok.', role: 'Tekrar' }
    return { text: lastHeard.fen && lastHeard.fen !== fen ? `Geçmiş konuma ait açıklama; güncel hamle önerisi değildir. ${lastHeard.text}` : lastHeard.text,
      canonical: lastHeard, role: 'Son açıklama' }
  }
  if (!['grades', 'tactics'].includes(action) && (!view || view.fen !== fen)) return { text: 'Bu konumun hesabı henüz hazır değil.', role: 'Konum bekleniyor' }
  const hint = hintContent(fen, candidates[0], playerColor)
  const safe = hintLevel > 0 ? hint.idea : hint.target
  if (/^candidate[123]$/.test(action)) {
    const index = Number(action.at(-1)) - 1, candidate = candidates[index]
    const subject = new Chess(fen).turn() === playerColor ? `${index + 1}. aday` : `Rakibin ${index + 1}. adayı`
    return { text: candidate ? `${subject} ${candidate.san}. ${briefExplanation(candidate, new Chess(fen).turn() === playerColor)} ${continuationText({ ...candidate, why: '' }, playerColor, new Chess(fen).turn())}`
      : `Bu konumda ${index + 1}. güçlü aday bulunmuyor.`, role: `${index + 1}. aday`, revealsMove: !!candidate }
  }
  if (action === 'tactics') return { text: alerts.length ? coachingSpeechEvents({ alerts }, { fen, playerColor, revealMoves: !hidden }).map(item => item.text).join(' ') : 'Bu hesapta doğrulanmış taktik uyarısı bulunmadı; bu, taktik olmadığı anlamına gelmez.', role: 'Taktikler' }
  if (action === 'grades') return { text: grades.length ? [...grades].sort((a, b) => b.ply - a.ply).filter((grade, index, all) => all.findIndex(item => item.color === grade.color) === index)
    .map(grade => `${grade.afterFen !== fen ? 'Geçmiş hamle. ' : ''}${grade.color === playerColor ? 'Senin' : 'Rakibin'} ${grade.number}. hamlesi: ${grade.label}.`).join(' ') : 'Henüz yeterli hesapla değerlendirilmiş hamle yok.', role: 'Hamle dereceleri' }
  if (!view || view.fen !== fen) return { text: 'Bu konumun hesabı henüz hazır değil.', role: 'Konum bekleniyor' }
  const fields = {
    comment: { text: hidden ? safe : view.comment, role: 'Konum yorumu' },
    plan: { text: hidden ? safe : view.plan.text, role: 'Plan ve hedef' },
    opponent: { text: hidden ? opponentComment(fen, candidates, playerColor, false) : view.opponent, role: 'Rakibin cevabı' },
    comparison: { text: hidden ? 'Aday karşılaştırmasının somut hamleleri gizli. Hamle düzeyini açabilir veya bir adayı özellikle isteyebilirsin.' : view.comparison.text, role: 'Aday karşılaştırması' },
    details: { text: hidden ? safe : view.full, role: 'Tam açıklama' },
    change: { text: view.changes.length ? view.changes.map(change => hidden ? ({ 'new-profitable-capture': 'Yeni bir kazançlı alış imkânı oluştu.', 'new-threat': 'Yeni bir kazançlı alış tehdidi oluştu.', 'threat-ended': 'Önceki doğrudan alış tehdidi giderildi.', 'open-file': 'Bir dikey piyonlardan temizlendi.', doubleCheck: 'Çifte şah oluştu.', discoveredCheck: 'Açarak şah oluştu.' }[change.type] || 'Önemli bir yerleşim değişikliği oluştu.') : change.text).join(' ') : 'Bu hamlede anlatılacak yeni, doğrulanmış önemli konum değişikliği bulunmadı.', role: 'Tahtadaki değişim' },
    hint: { text: hidden ? safe : hint.move, role: ['Hedef', 'Fikir', 'Somut hamle'][hintLevel] }
  }
  return fields[action] || { text: 'Bu bölüm için açıklama yok.', role: 'Koç' }
}

export function createHintController() {
  let position = '', guided = false, level = 2
  return {
    sync(fen, enabled) { if (position !== fen || guided !== enabled) { position = fen; guided = enabled; level = enabled ? 0 : 2 } return level },
    advance() { level = Math.min(2, level + 1); return level },
    get level() { return level },
    get hidden() { return level < 2 },
    reset() { position = ''; level = 2 }
  }
}
