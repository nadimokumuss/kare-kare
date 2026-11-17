import { Chess } from 'chess.js'

const names = { p: 'piyon', n: 'at', b: 'fil', r: 'kale', q: 'vezir', k: 'şah' }
const accusative = { p: 'piyonu', n: 'atı', b: 'fili', r: 'kaleyi', q: 'veziri', k: 'şahı' }
const dative = { p: 'piyona', n: 'ata', b: 'file', r: 'kaleye', q: 'vezire', k: 'şaha' }
const ownDative = { p: 'piyonuna', n: 'atına', b: 'filine', r: 'kalesine', q: 'vezirine', k: 'şahına' }
const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }

export function uciMove(position, uci) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci || '')) return null
  try { return position.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' }) } catch { return null }
}

export function loosePieces(position, color) {
  const enemy = color === 'w' ? 'b' : 'w'
  return position.board().flat().filter(piece => piece && piece.color === color && piece.type !== 'k')
    .filter(piece => position.isAttacked(piece.square, enemy) && !position.isAttacked(piece.square, color))
    .sort((a, b) => values[b.type] - values[a.type])
}

function phase(position) {
  const material = position.board().flat().filter(piece => piece && piece.type !== 'p' && piece.type !== 'k').reduce((sum, piece) => sum + values[piece.type], 0)
  if (material < 17) return 'oyun sonu'
  return Number(position.fen().split(' ')[5]) <= 6 ? 'açılış' : 'oyun ortası'
}

export const phaseOf = fen => phase(new Chess(fen))

function isPassedPawn(position, square) {
  const pawn = position.get(square)
  if (!pawn || pawn.type !== 'p') return false
  const ownFile = square.charCodeAt(0)
  const ownRank = Number(square[1])
  return !position.board().flat().some(piece => piece && piece.type === 'p' && piece.color !== pawn.color &&
    Math.abs(piece.square.charCodeAt(0) - ownFile) <= 1 &&
    (pawn.color === 'w' ? Number(piece.square[1]) > ownRank : Number(piece.square[1]) < ownRank))
}

function pieceAttacks(position, from, to, type, color) {
  if (!from || !to) return false
  const dx = to.charCodeAt(0) - from.charCodeAt(0)
  const dy = Number(to[1]) - Number(from[1])
  const ax = Math.abs(dx); const ay = Math.abs(dy)
  if (type === 'n') return (ax === 1 && ay === 2) || (ax === 2 && ay === 1)
  if (type === 'k') return Math.max(ax, ay) === 1
  if (type === 'p') return ax === 1 && dy === (color === 'w' ? 1 : -1)
  if (type === 'b' && ax !== ay) return false
  if (type === 'r' && dx !== 0 && dy !== 0) return false
  if (type === 'q' && !(ax === ay || dx === 0 || dy === 0)) return false
  if (!['b', 'r', 'q'].includes(type) || (!dx && !dy)) return false
  const stepX = Math.sign(dx); const stepY = Math.sign(dy)
  for (let x = from.charCodeAt(0) + stepX, y = Number(from[1]) + stepY;
    x !== to.charCodeAt(0) || y !== Number(to[1]); x += stepX, y += stepY) {
    if (position.get(String.fromCharCode(x) + y)) return false
  }
  return true
}

export function lineMotifs(position, color) {
  const motifs = []
  for (const attacker of position.board().flat().filter(piece => piece && piece.color === color && 'brq'.includes(piece.type))) {
    const directions = attacker.type === 'b' ? [[1, 1], [1, -1], [-1, 1], [-1, -1]]
      : attacker.type === 'r' ? [[1, 0], [-1, 0], [0, 1], [0, -1]]
        : [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]
    for (const [dx, dy] of directions) {
      const found = []
      for (let x = attacker.square.charCodeAt(0) + dx, y = Number(attacker.square[1]) + dy; x >= 97 && x <= 104 && y >= 1 && y <= 8; x += dx, y += dy) {
        const square = String.fromCharCode(x) + y
        const piece = position.get(square)
        if (!piece) continue
        if (piece.color === color) break
        found.push({ ...piece, square })
        if (found.length === 2) break
      }
      if (found.length !== 2) continue
      const [front, back] = found
      if (back.type === 'k' || (values[front.type] >= 3 && values[back.type] > values[front.type] && values[attacker.type] < values[back.type])) {
        motifs.push({ type: 'pin', label: 'Açmaz', attacker: attacker.square, targets: [front.square, back.square], absolute: back.type === 'k', targetType: front.type })
      } else if ((front.type === 'k' || values[front.type] > values[back.type]) && values[back.type] >= 3) {
        motifs.push({ type: 'skewer', label: 'Şiş', attacker: attacker.square, targets: [front.square, back.square] })
      }
    }
  }
  return motifs
}

function exchangeGain(position, square, depth = 0) {
  if (depth >= 6) return 0
  let gain = 0
  for (const capture of position.moves({ verbose: true }).filter(move => move.to === square && move.captured)) {
    position.move(capture)
    gain = Math.max(gain, captureValue(capture) - exchangeGain(position, square, depth + 1))
    position.undo()
  }
  return gain
}

const captureValue = move => (values[move.captured] || 0) + (move.promotion ? values[move.promotion] - values.p : 0)

function bestRecapture(position, square) {
  let best = null
  for (const move of position.moves({ verbose: true }).filter(item => item.to === square && item.captured)) {
    position.move(move)
    const gain = captureValue(move) - exchangeGain(position, square)
    position.undo()
    if (!best || gain > best.gain) best = { move, gain }
  }
  return best && best.gain >= 0 ? best.move : null
}

// This is a local exchange estimate, not a positional score or a forced line.
// Every capture is legal (including king safety, pins and en passant).
export function captureAssessment(fen, uci) {
  const position = new Chess(fen)
  const move = uciMove(position, uci)
  if (!move?.captured) return null
  const gain = captureValue(move) - exchangeGain(position, move.to)
  const sequence = [move]
  for (let depth = 0; depth < 6; depth++) {
    const reply = bestRecapture(position, move.to)
    if (!reply) break
    sequence.push(position.move(reply))
  }
  const won = sequence.filter(item => item.color === move.color).map(item => item.captured)
  const lost = sequence.filter(item => item.color !== move.color).map(item => item.captured)
  const balance = sequence.reduce((sum, item) => sum + (item.color === move.color ? 1 : -1) * captureValue(item), 0)
  return { gain, balance, won, lost, sequence: sequence.map(item => ({ san: item.san, color: item.color, from: item.from, to: item.to, captured: item.captured })) }
}

function capturePosition(position, color) {
  const copy = new Chess(position.fen())
  if (copy.turn() !== color) {
    if (copy.isCheck()) return null // A checking move cannot be ignored for an imaginary extra turn.
    copy.setTurn(color)
  }
  return copy
}

export function profitableCaptures(position, color, from = null) {
  const copy = capturePosition(position, color)
  if (!copy) return []
  const result = []
  for (const move of copy.moves({ verbose: true, ...(from ? { square: from } : {}) }).filter(item => item.captured)) {
    copy.move(move)
    const gain = captureValue(move) - exchangeGain(copy, move.to)
    copy.undo()
    if (gain > 0) result.push({ from: move.from, to: move.to, san: move.san, captured: move.captured, gain })
  }
  return result.sort((a, b) => b.gain - a.gain)
}

function pieceList(types) {
  const counts = new Map()
  for (const type of types) counts.set(type, (counts.get(type) || 0) + 1)
  const words = [...counts].map(([type, count]) => `${count === 1 ? 'bir' : count} ${names[type]}`)
  return words.length > 1 ? words.slice(0, -1).join(', ') + ' ve ' + words.at(-1) : words[0] || ''
}

export function exchangeExplanation(exchange) {
  if (!exchange || exchange.sequence.length < 2) return ''
  const reply = exchange.sequence[1]
  const continuation = exchange.sequence[2]
  const line = exchange.source === 'calculated' ? `Hesaplanan alış dizisi: ${exchange.sequence.map(move => move.san).join(' ')}.`
    : continuation ? `Rakibin ${reply.san} ile karşı alışına ${continuation.san} ile cevap verilebilir.` : `Rakip ${reply.san} ile karşılık alabilir.`
  const actor = exchange.sequence[0].color === 'w' ? 'Beyaz' : 'Siyah'
  const material = exchange.lost.length ? `Bu alış dizisinde ${actor} ${pieceList(exchange.lost)} verip ${pieceList(exchange.won)} alır` : `${actor} ${pieceList(exchange.won)} alır`
  const balance = exchange.balance === 0 ? 'maddi denge eşit kalır' : `maddi denge yaklaşık ${Math.abs(exchange.balance)} piyon ${exchange.balance > 0 ? 'lehine' : 'aleyhine'}`
  return `${line} ${exchange.source === 'calculated' ? material.replace('Bu alış dizisinde', 'Gösterilen alışlarda') : material}; ${balance}.`
}

function calculatedExchange(fen, pv) {
  const sequence = []
  for (const move of variationMoves(fen, pv, 8)) {
    if (!move.captured) break
    sequence.push(move)
  }
  if (sequence.length < 2) return null
  const color = sequence[0].color
  return { source: 'calculated', sequence: sequence.map(move => ({ san: move.san, color: move.color, from: move.from, to: move.to, captured: move.captured })),
    won: sequence.filter(move => move.color === color).map(move => move.captured),
    lost: sequence.filter(move => move.color !== color).map(move => move.captured),
    balance: sequence.reduce((sum, move) => sum + (move.color === color ? 1 : -1) * captureValue(move), 0) }
}

export function captureChoiceComparison(fen, uci) {
  const position = new Chess(fen)
  const move = position.moves({ verbose: true }).find(item => item.from + item.to + (item.promotion || '') === uci)
  if (!move?.captured) return null
  const chosen = captureAssessment(fen, uci)
  if (chosen.gain < 0) return null
  const alternatives = position.moves({ verbose: true }).filter(item => item.captured && item.to === move.to && item.from !== move.from)
    .map(item => ({ san: item.san, uci: item.from + item.to + (item.promotion || ''), exchange: captureAssessment(fen, item.from + item.to + (item.promotion || '')) }))
    .filter(item => item.exchange.gain < chosen.gain)
    .sort((a, b) => a.exchange.gain - b.exchange.gain)
  const alternative = alternatives[0]
  return alternative ? { chosen: move.san, alternative: alternative.san, difference: chosen.gain - alternative.exchange.gain,
    text: `Aynı taşı ${alternative.san} yerine ${move.san} ile almak, yerel takas hesabında yaklaşık ${chosen.gain - alternative.exchange.gain} piyon daha iyi. ${exchangeExplanation(chosen)}` } : null
}

export function variationMoves(fen, pv = [], limit = 12) {
  const position = new Chess(fen)
  const moves = []
  for (const uci of pv.slice(0, limit)) {
    const move = uciMove(position, uci)
    if (!move) break
    moves.push(move)
  }
  return moves
}

export function numberedVariation(fen, pv, limit = 6) {
  return variationMoves(fen, pv, limit).map((move, index) => {
    const number = Number(move.before.split(' ')[5])
    return `${move.color === 'w' ? `${number}. ` : index === 0 ? `${number}... ` : ''}${move.san}`
  }).join(' ')
}

// Evidence of a concrete offered piece in the engine line, not a claim that
// every sacrifice is sound. Grading additionally requires a strong score.
export function sacrificeEvidence(fen, pv) {
  const moves = variationMoves(fen, pv, 6)
  const [first, reply] = moves
  if (moves.length < 3 || !'nbrq'.includes(first.piece) || reply.to !== first.to || reply.captured !== first.piece) return null
  const offered = values[reply.captured] - (values[first.captured] || 0)
  if (offered < 2 || !(captureAssessment(first.after, reply.from + reply.to + (reply.promotion || ''))?.gain >= 2)) return null
  return { offered, san: first.san, reply: reply.san, square: first.to, line: numberedVariation(fen, pv, 6) }
}

function discoveredMotifs(before, after, move) {
  const enemy = move.color === 'w' ? 'b' : 'w'
  const king = after.board().flat().find(piece => piece?.color === enemy && piece.type === 'k')
  const checks = king ? after.attackers(king.square, move.color) : []
  const result = []
  if (after.isCheck() && checks.length >= 2) result.push({ type: 'doubleCheck', label: 'Çifte şah',
    targets: [king.square], attackers: checks, lesson: `${move.san} ile iki taş aynı anda şah çeker; rakip şahını hareket ettirmek zorundadır.` })
  for (const piece of after.board().flat().filter(item => item?.color === move.color && 'brq'.includes(item.type) && item.square !== move.to)) {
    for (const target of after.board().flat().filter(item => item?.color === enemy && values[item.type] >= 3)) {
      if (!pieceAttacks(after, piece.square, target.square, piece.type, move.color) ||
        pieceAttacks(before, piece.square, target.square, piece.type, move.color)) continue
      const check = target.type === 'k'
      if (check && checks.length >= 2) continue // One useful label for the same double-check mechanism.
      result.push({ type: check ? 'discoveredCheck' : 'discoveredAttack', label: check ? 'Açarak şah' : 'Açarak saldırı',
        attacker: piece.square, targets: [target.square],
        lesson: `${move.san}, ${piece.square} karesindeki ${names[piece.type]} için hattı açar; ${check ? 'bu taş şah çeker' : `${target.square} karesindeki ${names[target.type]} hedef olur`}.` })
    }
  }
  return result
}

function advancedLineMotifs(fen, moves) {
  const [first, reply, continuation] = moves
  if (!continuation?.captured || continuation.color !== first.color) return []
  const before = new Chess(fen)
  const target = before.get(continuation.to)
  if (!target || target.color === first.color || values[target.type] < 3 ||
      !(captureAssessment(continuation.before, continuation.from + continuation.to + (continuation.promotion || ''))?.gain > 0)) return []
  const result = []
  const previousGains = profitableCaptures(before, first.color)
  const targetWasProfitable = previousGains.some(item => item.to === continuation.to)
  const evidence = { san: continuation.san, square: continuation.to, ply: 3 }
  if (first.san.includes('+') && !first.san.endsWith('#') && first.to !== continuation.to && targetWasProfitable) {
    result.push({ type: 'zwischenzug', label: 'Ara şah', targets: [continuation.to], evidence,
      lesson: `${first.san} ile önce şah çekilir. Hesaplanan ${reply.san} cevabından sonra ${continuation.san} ile alışa dönülür.` })
  }
  if (targetWasProfitable) return result
  const canDefend = square => {
    const copy = new Chess(fen)
    const hypothetical = copy.moves({ verbose: true }).find(move => move.from === continuation.from && move.to === continuation.to && move.captured)
    if (!hypothetical) return false
    copy.move(hypothetical)
    return copy.moves({ verbose: true }).some(move => move.from === square && move.to === continuation.to && move.captured)
  }
  const removed = first.captured && before.get(first.to)
  if (removed && removed.color !== first.color && removed.type !== 'k' &&
      pieceAttacks(before, first.to, continuation.to, removed.type, removed.color) && canDefend(first.to)) {
    result.push({ type: 'removeDefender', label: 'Savunucuyu ortadan kaldırma', targets: [first.to, continuation.to], evidence,
      lesson: `${first.san}, ${continuation.to} karesini koruyan ${accusative[removed.type]} ortadan kaldırır. Hesaplanan devamda ${continuation.san} alışı kazançlı hale gelir.` })
  }
  const defender = before.get(reply.from)
  const afterReply = new Chess(reply.after)
  if (!first.captured && defender?.color !== first.color && defender && defender.type !== 'k' &&
      (first.san.includes('+') || pieceAttacks(new Chess(first.after), first.to, reply.from, first.piece, first.color)) &&
      pieceAttacks(before, reply.from, continuation.to, defender.type, defender.color) && canDefend(reply.from) &&
      !pieceAttacks(afterReply, reply.to, continuation.to, defender.type, defender.color)) {
    result.push({ type: 'deflection', label: 'Savunucuyu uzaklaştırma', targets: [reply.from, continuation.to], evidence,
      lesson: `${first.san} sonrasında hesaplanan ${reply.san} cevabı savunucuyu görevinden uzaklaştırır. Böylece ${continuation.san} alışı kazançlı hale gelir.` })
  }
  return result
}

// Geometry discovers ideas for the engine to search. Public coaching needs a
// demonstrated follow-up before calling a pin an opportunity.
export function explainedMotifs(fen, pv) {
  const moves = variationMoves(fen, pv)
  if (!moves.length) return []
  const first = moves[0]
  const motifs = tacticalMotifs(fen, pv[0]).flatMap(motif => {
    if (motif.type === 'discoveredAttack') {
      const followup = moves.slice(2).find(move => move.color === first.color && move.from === motif.attacker &&
        motif.targets.includes(move.to) && move.captured && captureAssessment(move.before, move.from + move.to + (move.promotion || ''))?.gain > 0)
      return followup ? [{ ...motif, evidence: { san: followup.san, square: followup.to, ply: moves.indexOf(followup) + 1 } }] : []
    }
    if (motif.type !== 'pin') return [motif]
    let followup = null
    for (const move of moves.slice(1)) {
      if (move.from === motif.targets[0]) break
      if (move.to !== motif.targets[0] || move.color !== first.color || !move.captured) continue
      const stillPinned = lineMotifs(new Chess(move.before), first.color).some(item => item.attacker === motif.attacker && item.targets.join(',') === motif.targets.join(','))
      if (stillPinned && captureAssessment(move.before, move.from + move.to + (move.promotion || ''))?.gain > 0) followup = move
      break
    }
    return followup ? [{ ...motif, evidence: { san: followup.san, square: followup.to, ply: moves.indexOf(followup) + 1 } }] : []
  })
  return [...motifs, ...advancedLineMotifs(fen, moves)]
}

export function canNeutralizeAttacker(position, square) {
  for (const capture of position.moves({ verbose: true }).filter(move => move.to === square && move.captured)) {
    position.move(capture)
    const gain = captureValue(capture) - exchangeGain(position, square)
    position.undo()
    if (gain >= 0) return true
  }
  return false
}

export function tacticalMotifs(fen, uci) {
  const before = new Chess(fen)
  const after = new Chess(fen)
  const move = uciMove(after, uci)
  if (!move) return []
  const moved = after.get(move.to)
  if (!moved) return []
  const enemy = move.color === 'w' ? 'b' : 'w'
  const targets = after.board().flat().filter(piece => piece && piece.color === enemy && values[piece.type] >= 3)
    .filter(piece => pieceAttacks(after, move.to, piece.square, moved.type, move.color))
    .sort((a, b) => values[b.type] - values[a.type])
  const king = targets.find(piece => piece.type === 'k')
  const queen = targets.find(piece => piece.type === 'q')
  const motifs = []
  motifs.push(...discoveredMotifs(before, after, move))
  const safeAttacker = !canNeutralizeAttacker(after, move.to)
  if (safeAttacker && king && queen) motifs.push({ type: 'royalFork', label: 'Şah–vezir çatalı', targets: [king.square, queen.square], prize: queen.square })
  else if (safeAttacker && targets.length >= 2) {
    const pair = king ? [king, targets.find(piece => piece.type !== 'k')] : targets.slice(0, 2)
    motifs.push({ type: 'fork', label: 'Çatal', targets: pair.map(piece => piece.square), prize: pair.find(piece => piece.type !== 'k')?.square })
  }
  if (move.captured && values[move.captured] >= 3) motifs.push({ type: 'capture', label: 'Değerli taş alışı', targets: [move.to] })
  const prior = new Set(lineMotifs(before, move.color).map(motif => `${motif.type}:${motif.targets.join(',')}`))
  motifs.push(...lineMotifs(after, move.color).filter(motif =>
    !prior.has(`${motif.type}:${motif.targets.join(',')}`) && !canNeutralizeAttacker(after, motif.attacker)))
  if (after.isCheckmate()) motifs.unshift({ type: 'mate', label: 'Mat', targets: [move.to] })
  return motifs
}

export function scanTactics(fen) {
  const game = new Chess(fen)
  return game.moves({ verbose: true }).map(move => {
    const uci = move.from + move.to + (move.promotion || '')
    const after = new Chess(fen)
    after.move(move)
    const motifs = tacticalMotifs(fen, uci)
    const kind = forcingKind(move, after, game, move.color, motifs, false)
    return { uci, san: move.san, piece: move.piece, kind, motifs }
  }).filter(item => item.kind !== 'Plan')
}

const forcingPriority = { Mat: 100, 'Şah–vezir çatalı': 90, 'Çifte şah': 88, 'Açarak şah': 85, Çatal: 80, Şiş: 75, Açmaz: 70, 'Açarak saldırı': 68, Terfi: 65, Şah: 50, Alış: 40, Tehdit: 30 }

export function tacticalSearchQueue(fen, candidates = [], limit = 2) {
  const known = new Set(candidates.map(candidate => candidate.uci))
  const ranked = scanTactics(fen).filter(item => !known.has(item.uci) && item.motifs.some(motif => !['capture'].includes(motif.type)))
    .sort((a, b) => (forcingPriority[b.kind] || 0) - (forcingPriority[a.kind] || 0) || a.san.localeCompare(b.san))
  const selected = []; const kinds = new Set()
  for (const item of ranked) if (!kinds.has(item.kind)) { selected.push(item); kinds.add(item.kind) }
  return [...selected, ...ranked.filter(item => !selected.includes(item))].slice(0, limit)
}

export function scoreValue(score) {
  if (!score || !Number.isFinite(score.value)) return null
  if (score.type === 'cp') return score.value
  if (score.type === 'mate') return score.value > 0 ? 100000 - score.value : -100000 - score.value
  return null
}

function forcingKind(move, after, before, movingColor, motifs = [], evaluateThreats = true) {
  if (after.isCheckmate()) return 'Mat'
  if (motifs.some(motif => motif.type === 'royalFork')) return 'Şah–vezir çatalı'
  if (motifs.some(motif => motif.type === 'fork')) return 'Çatal'
  const advanced = motifs.find(motif => motif.lesson)
  if (advanced) return advanced.label
  if (motifs.some(motif => motif.type === 'skewer')) return 'Şiş'
  if (motifs.some(motif => motif.type === 'pin')) return 'Açmaz'
  if (after.isCheck()) return 'Şah'
  if (move.captured) return 'Alış'
  if (move.promotion) return 'Terfi'
  if (!evaluateThreats) return 'Plan'
  const enemy = movingColor === 'w' ? 'b' : 'w'
  const previous = new Set(profitableCaptures(before, movingColor).map(item => item.to))
  const targets = profitableCaptures(after, movingColor).filter(item => !previous.has(item.to))
  return targets.length ? 'Tehdit' : 'Plan'
}

const capitalize = text => text ? text[0].toLocaleUpperCase('tr-TR') + text.slice(1) : ''
const sentence = text => text && /[.!?]$/.test(text) ? text : text ? text + '.' : ''

function simpleAction(move) {
  if (!move) return ''
  if (move.san.startsWith('O-O-O')) return 'Uzun rok yapıp şahını c dikeyine alır'
  if (move.san.startsWith('O-O')) return 'Kısa rok yapıp şahını güvene alır'
  if (move.captured) return `${capitalize(names[move.piece])}, ${move.from} karesinden ${move.to} karesindeki ${accusative[move.captured]} alır${move.promotion ? ` ve ${dative[move.promotion]} terfi eder` : ''}`
  if (move.promotion) return `${move.to} karesinde piyonu ${names[move.promotion]} yapar`
  return `${capitalize(accusative[move.piece])} ${move.to} karesine ${move.piece === 'p' ? 'ilerletir' : 'getirir'}`
}

function reason(move, before, after, kind, motifs = [], answer = null, continuation = null, pv = []) {
  if (kind === 'Mat') return `${simpleAction(move)} ve mat eder.`
  const fork = motifs.find(motif => ['royalFork', 'fork'].includes(motif.type))
  if (fork) {
    const targets = fork.targets.map(square => `${square} karesindeki ${dative[after.get(square).type]}`)
    const gain = continuation?.captured && continuation.to === fork.prize
      ? `Rakibin ${answer.san} yanıtından sonra ${continuation.san} ile ${accusative[continuation.captured]} alır.` : ''
    return `${capitalize(names[move.piece])} ${move.to} karesinden ${targets.join(' ve ')} aynı anda saldırır. ${gain}`.trim()
  }
  const advanced = motifs.find(motif => motif.lesson)
  if (advanced) return `${advanced.lesson}${advanced.evidence && !advanced.lesson.includes(advanced.evidence.san) ? ` Hesaplanan devamda ${advanced.evidence.san} alışı kazanç sağlar.` : ''}`
  if (move.captured) {
    const exchange = captureAssessment(before.fen(), move.from + move.to + (move.promotion || ''))
    const explanation = exchangeExplanation(calculatedExchange(before.fen(), pv) || exchange)
    const balance = exchange?.gain < 0 && !explanation ? ' Bu alış, yerel takas hesabında maddi kayıp riski taşıyor.' : ''
    return `${capitalize(simpleAction(move))}.${explanation ? ` ${explanation}` : balance}`
  }
  const line = motifs.find(motif => ['pin', 'skewer'].includes(motif.type))
  if (line) {
    const [front, back] = line.targets
    return line.type === 'pin'
      ? `${line.attacker} karesindeki ${names[after.get(line.attacker).type]}, ${front} karesindeki ${accusative[after.get(front).type]} açmaza alır. ${line.absolute ? `Bu taş şahı açıkta bırakacak yönde hareket edemez.` : `Bu taş çekilirse ${back} karesindeki ${names[after.get(back).type]} hedef olur.`}${line.evidence ? ` Hesaplanan devamda ${line.evidence.san} ile açmazdaki taşı almayı planlar.` : ''}`
      : `${line.attacker} karesindeki ${names[after.get(line.attacker).type]}, ${front} karesindeki ${dative[after.get(front).type]} saldırır. Bu taş çekilince arkasındaki ${back} karesindeki ${names[after.get(back).type]} hedefte kalır.`
  }
  if (move.promotion) return `${capitalize(simpleAction(move))}; taş gücünü artırır.`
  if (move.san.startsWith('O-O')) return `${capitalize(simpleAction(move))}; kaleyi de oyuna katar.`
  if (kind === 'Şah') return `${capitalize(simpleAction(move))} ve şah çekerek rakibi savunmaya zorlar.`
  const enemy = move.color === 'w' ? 'b' : 'w'
  if (loosePieces(before, move.color).some(piece => piece.square === move.from) && !after.isAttacked(move.to, enemy)) {
    return `${move.from} karesindeki ${accusative[move.piece]} ${move.to} karesine taşıyarak saldırıdan kurtarır.`
  }
  const previousTargets = new Set(profitableCaptures(before, move.color, move.from).map(item => item.to))
  const attacked = profitableCaptures(after, move.color, move.to).filter(item => !previousTargets.has(item.to))
  if (attacked.length) return `${capitalize(accusative[move.piece])} ${move.to} karesine getirerek ${attacked[0].to} karesindeki ${dative[attacked[0].captured]} saldırır; bu alış yerel takas hesabında maddi kazanç sağlıyor.`
  const supported = after.board().flat().filter(piece => piece && piece.color === move.color && piece.type !== 'k' && piece.square !== move.to)
    .filter(piece => pieceAttacks(after, move.to, piece.square, after.get(move.to).type, move.color) && !pieceAttacks(before, move.from, piece.square, move.piece, move.color))
    .filter(piece => after.isAttacked(piece.square, enemy) || (move.piece === 'p' && piece.type === 'p'))
    .sort((a, b) => values[b.type] - values[a.type])
  if (supported.length) return `${capitalize(accusative[move.piece])} ${move.to} karesine getirerek ${supported[0].square} karesindeki kendi ${ownDative[supported[0].type]} destek verir.`
  if (move.piece === 'p' && phase(after) === 'oyun sonu' && isPassedPawn(after, move.to)) {
    return `Geçer piyonunu ${move.to} karesine ilerletir; amacı onu terfiye yaklaştırmak.`
  }
  const newCenter = ['d4', 'e4', 'd5', 'e5'].filter(square => square !== move.to &&
    pieceAttacks(after, move.to, square, after.get(move.to).type, move.color) && !pieceAttacks(before, move.from, square, move.piece, move.color))
  if (newCenter.length) {
    const developing = 'nb'.includes(move.piece) && move.from[1] === (move.color === 'w' ? '1' : '8')
    return `${developing ? `${capitalize(accusative[move.piece])} ${move.to} karesine geliştirir` : capitalize(simpleAction(move))}; ${newCenter.slice(0, 2).join(' ve ')} merkez ${newCenter.length > 1 ? 'karelerini' : 'karesini'} kontrol eder.`
  }
  if (move.piece === 'r') {
    const pawns = after.board().flat().filter(piece => piece?.type === 'p' && piece.square[0] === move.to[0])
    if (!pawns.some(piece => piece.color === move.color)) return `Kaleyi ${move.to} karesine getirerek ${move.to[0]} ${pawns.length ? 'yarı açık' : 'açık'} dikeyini kullanır.`
  }
  if (phase(before) === 'oyun sonu' && move.piece === 'k') return `Şahını ${move.to} karesine getirir; oyun sonunda şahını da mücadeleye katar.`
  if (move.piece === 'p') {
    const controls = 'abcdefgh'.split('').flatMap(file => [Number(move.to[1]) + (move.color === 'w' ? 1 : -1)].map(rank => file + rank))
      .filter(square => /^[a-h][1-8]$/.test(square) && pieceAttacks(after, move.to, square, 'p', move.color))
    return `Piyonunu ${move.to} karesine ilerletir${controls.length ? `; ${controls.join(' ve ')} karelerini kontrol eder` : ''}.`
  }
  return sentence(capitalize(simpleAction(move)))
}

function replyPurpose(move) { return move ? simpleAction(move) : '' }

export function playerExplanation(text, own = true) {
  if (!own || !text) return text || ''
  let result = text.replace(/^(Atı|Fili|Kaleyi|Veziri|Piyonu|Şahı) /, piece => ({ 'Atı ': 'Atını ', 'Fili ': 'Filini ', 'Kaleyi ': 'Kaleni ', 'Veziri ': 'Vezirini ', 'Piyonu ': 'Piyonunu ', 'Şahı ': 'Şahını ' })[piece])
  const action = /^(Atını|Filini|Kaleni|Vezirini|Piyonunu|Şahını|Geçer piyonunu)/.test(result)
  if (!action) return result
  result = result.replace('geliştirir; ', 'geliştirerek ').replace('ilerletir; ', 'ilerleterek ').replace('getirir; ', 'getirerek ')
  for (const [from, to] of [['kontrol eder', 'kontrol edebilirsin'], ['destek verir', 'destek verebilirsin'], ['saldırır', 'saldırabilirsin'], ['geliştirir', 'geliştirebilirsin'], ['ilerletir', 'ilerletebilirsin'], ['getirir', 'getirebilirsin'], ['kurtarır', 'kurtarabilirsin'], ['mat eder', 'mat edebilirsin']]) result = result.replaceAll(from, to)
  return result
}

export function briefExplanation(candidate, own = true) {
  if (!candidate) return ''
  if (candidate.kind === 'Mat') return own ? 'Bu hamleyle mat edebilirsin.' : 'Bu hamleyle mat edebilir.'
  if (candidate.captured && candidate.piece) {
    const ownTool = { p: 'piyonunla', n: 'atınla', b: 'filinle', r: 'kalenle', q: 'vezirinle', k: 'şahınla' }
    const theirTool = { p: 'piyonuyla', n: 'atıyla', b: 'filiyle', r: 'kalesiyle', q: 'veziriyle', k: 'şahıyla' }
    return `${candidate.to} karesindeki ${accusative[candidate.captured]} ${(own ? ownTool : theirTool)[candidate.piece]} ${own ? 'alabilirsin' : 'alabilir'}.`
  }
  return playerExplanation(candidate.why, own).split(/(?<=[.!?])\s/)[0]
    .replace(/; bu alış yerel takas hesabında maddi kazanç sağlıyor\./, '. Bu alış kazançlı görünüyor.')
    .replace(/karesindeki kendi /g, 'karesindeki ')
}

export function continuationText(candidate, playerColor, movingColor) {
  if (!candidate?.answer) return ''
  if (candidate.continuation && candidate.why?.includes(candidate.answer) && candidate.why.includes(candidate.continuation)) return ''
  const own = movingColor === playerColor
  if (own) {
    return `Rakip ${candidate.answer} oynarsa${candidate.continuation ? `, sen ${candidate.continuation} ile devam edebilirsin. ${playerExplanation(candidate.continuationWhy)}` : `, sonraki hamleni bu yeni konuma göre seç.`}`
  }
  return `Sen ${candidate.answer} ile karşılık verebilirsin.${candidate.continuation ? ` Ardından rakip ${candidate.continuation} oynayabilir. Rakibin bu devamı: ${candidate.continuationWhy}` : ''}`
}

export function describeLines(fen, lines) {
  return (lines || []).slice(0, 3).map(line => {
    const position = new Chess(fen)
    const before = new Chess(fen)
    const move = uciMove(position, line.pv?.[0])
    if (!move) return null
    const motifs = explainedMotifs(fen, line.pv)
    const beforeAnswer = new Chess(move.after)
    const answer = uciMove(position, line.pv?.[1])
    const continuation = answer && uciMove(position, line.pv?.[2])
    const after = new Chess(move.after)
    const kind = forcingKind(move, after, before, move.color, motifs)
    const why = reason(move, before, after, kind, motifs, answer, continuation, line.pv)
    const continuationWhy = continuation
      ? reason(continuation, new Chess(answer.after), new Chess(continuation.after),
        forcingKind(continuation, new Chess(continuation.after), new Chess(answer.after), continuation.color,
          explainedMotifs(answer.after, line.pv.slice(2))),
        explainedMotifs(answer.after, line.pv.slice(2)), null, null, line.pv.slice(2)) : ''
    return { uci: line.pv[0], san: move.san, from: move.from, to: move.to, kind, why, motifs,
      answer: answer?.san || null, answerWhy: replyPurpose(answer, beforeAnswer), answerUci: line.pv?.[1] || null, answerFrom: answer?.from || null, answerTo: answer?.to || null,
      continuation: continuation?.san || null, continuationWhy, continuationUci: line.pv?.[2] || null, continuationFrom: continuation?.from || null, continuationTo: continuation?.to || null,
      piece: move.piece, captured: move.captured || null, color: move.color, continuationCapture: continuation?.captured || null,
      pv: variationMoves(fen, line.pv).map(item => item.from + item.to + (item.promotion || '')),
      lineText: numberedVariation(fen, line.pv), exchange: move.captured ? captureAssessment(fen, line.pv[0]) : null,
      lineExchange: move.captured ? calculatedExchange(fen, line.pv) : null,
      captureComparison: move.captured ? captureChoiceComparison(fen, line.pv[0]) : null,
      depth: line.depth || 0, score: line.score || null }
  }).filter(Boolean)
}

function lastMoveIntent(position, playerColor, lastMove, best) {
  if (!lastMove?.before || lastMove.color === playerColor || lastMove.after !== position.fen()) return ''
  const before = new Chess(lastMove.before)
  const previous = new Set(profitableCaptures(before, lastMove.color).map(item => item.to))
  const threat = profitableCaptures(position, lastMove.color).find(item => !previous.has(item.to))
  if (!threat) return ''
  const target = position.get(threat.to)
  const start = `Rakibin ${threat.san} alışı ${threat.to} karesindeki ${accusative[target.type]} maddi kayıpla tehdit ediyor.`
  if (!best) return `${start} Henüz doğrulanmış bir savunma veya karşı oyun önerisi yok.`
  const after = new Chess(position.fen())
  const move = uciMove(after, best.uci)
  if (!move) return start
  if (after.isCheck()) return `${start} ${best.san} ile önce şah çekerek rakibi cevap vermeye zorlarsın.`
  const remains = profitableCaptures(after, lastMove.color).some(item => item.to === threat.to && after.get(threat.to)?.color === playerColor)
  if (move.from === threat.to || !remains) return `${start} Ana aday ${best.san}, bu doğrudan alış tehdidini gideriyor.`
  return `${start} Ana aday ${best.san} bu taşı doğrudan korumuyor; motor karşı oyunu tercih ediyor. Taşın hâlâ alınabildiğini hesaba kat.`
}

export function positionIntro(position, playerColor, lastMove, candidates) {
  const myTurn = position.turn() === playerColor
  const best = candidates[0]
  const intent = myTurn ? lastMoveIntent(position, playerColor, lastMove, best) : ''
  if (!best) return { title: myTurn ? 'Konumu değerlendir' : 'Rakibin cevabını öngör', body: intent || 'Konumun hesabı henüz tamamlanmadı.' }
  const tactic = best.motifs?.find(motif => motif.label === best.kind) || best.motifs?.find(motif => motif.type !== 'capture')
  const title = tactic ? `${myTurn ? '' : 'Rakibin '}${tactic.label.toLocaleLowerCase('tr-TR')} ${myTurn ? 'fırsatı' : 'fikri'}`
    : position.isCheck() ? (myTurn ? 'Şah tehdidine cevap' : 'Rakip şahını savunmalı')
      : myTurn ? 'Senin planın' : 'Rakibin planı'
  const lead = myTurn ? `${best.san}: ${playerExplanation(best.why)}` : `Rakip ${best.san} oynayabilir. ${best.why}`
  const body = [intent, lead, continuationText(best, playerColor, position.turn())].filter(Boolean).join(' ')
  let shortIntent = ''
  if (intent) {
    const threat = profitableCaptures(position, lastMove.color).find(item => intent.includes(item.san))
    if (threat) shortIntent = `Rakip ${threat.san} ile taş alabilir. `
    if (intent.includes('doğrudan korumuyor')) shortIntent += 'Öneri savunma yerine karşı oyun kuruyor. '
    else if (intent.includes('önce şah çekerek')) shortIntent += 'Öneri önce şah çekiyor. '
    else if (intent.includes('tehdidini gideriyor')) shortIntent += 'Öneri bu tehdidi gideriyor. '
  }
  const shortLead = myTurn ? `${best.san}: ${briefExplanation(best)}` : `Rakip ${best.san} oynayabilir. ${briefExplanation(best, false)}`
  const shortReply = !shortIntent && best.answer && best.continuation ? (myTurn
    ? `Rakip ${best.answer} oynarsa, ${best.continuation} ile devam edebilirsin.`
    : `Sen ${best.answer} ile karşılık verebilirsin.`) : ''
  return { title: capitalize(title), body, brief: [shortIntent.trim(), shortLead, shortReply].filter(Boolean).join(' ') }
}

export function compareAlternative(best, alternative) {
  if (!alternative) return 'Bu hamle için güvenilir bir hesap bulunamadı.'
  if (best?.uci === alternative.uci) return `${alternative.san} motorun ana önerisi. ${alternative.why}`
  const a = best?.score; const b = alternative.score
  const difference = a?.type === 'cp' && b?.type === 'cp' ? a.value - b.value : null
  const defense = alternative.answer ? `Rakip ${alternative.answer} oynayabilir.${alternative.answerWhy ? ` ${sentence(capitalize(alternative.answerWhy))}` : ''}` : ''
  if (b?.type === 'mate' && b.value < 0) return `${alternative.san} tehlikeli: rakip zorlayıcı bir mat ağı kurabiliyor. ${defense} ${best?.san ? `${best.san} fikrini karşılaştır.` : ''}`.trim()
  if (a?.type === 'mate' && a.value > 0 && b?.type !== 'mate') return `${alternative.san} ile ${best?.san} hamlesinin sunduğu zorlayıcı mat fırsatını kaçırabilirsin. ${defense}`.trim()
  if (difference !== null && difference >= 120) return `${alternative.san} fikri cazip görünse de rakibin en güçlü cevabı konumu belirgin biçimde kötüleştiriyor. ${defense} ${best?.san ? `${best.san} daha sağlam: ${best.why}` : ''}`.trim()
  if (difference !== null && difference >= 45) return `${alternative.san} oynanabilir, ancak ${best?.san} biraz daha güçlü görünüyor. ${alternative.why} ${defense}`.trim()
  return `${alternative.san} makul bir seçenek. ${alternative.why} ${defense}`.trim()
}

export function assessPlayedMove(pending, opponentBest) {
  if (!pending?.best || !opponentBest || pending.move === pending.best.san) return null
  if (pending.best.score?.type !== 'cp' || opponentBest.score?.type !== 'cp') return null
  // UCI scores are relative to the side to move; the second position is the opponent's turn.
  const loss = pending.best.score.value + opponentBest.score.value
  if (loss < 180) return null
  const missedTactic = pending.best.motifs?.some(motif => ['royalFork', 'fork', 'mate'].includes(motif.type))
  const motif = missedTactic ? pending.best.motifs.find(item => ['royalFork', 'fork', 'mate'].includes(item.type))?.label : null
  return { loss, kind: missedTactic ? 'missedTactic' : 'choice', motif,
    text: `${pending.number}. hamlede ${pending.move} yerine ${pending.best.san} fikrini incele: ${pending.best.why}` }
}

export function summary(events) {
  if (!Array.isArray(events)) return { lessons: [], topic: 'Taktik motifleri ve aday hamle hesabı' }
  const lessons = events.slice().sort((a, b) => b.loss - a.loss).slice(0, 3).map(event => event.text)
  const motifCounts = new Map()
  for (const event of events) if (event.motif) motifCounts.set(event.motif, (motifCounts.get(event.motif) || 0) + 1)
  const topMotif = [...motifCounts].sort((a, b) => b[1] - a[1])[0]?.[0]
  return { lessons, topic: topMotif ? `${topMotif} ve zorlayıcı hamle hesabı` : events.some(event => event.kind === 'missedTactic')
    ? 'Çatal ve zorlayıcı hamle hesabı' : 'Aday hamleleri ve rakibin en güçlü cevabını hesaplama' }
}
