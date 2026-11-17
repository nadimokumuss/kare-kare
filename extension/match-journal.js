import { Chess } from 'chess.js'
import { positiveGrades, gradeLabels } from './move-grades.js'
import { phaseOf } from './coach-core.js'

export const journalKey = 'kareKareMatchJournalV1'
export const journalMethod = 'kk-grades-v2-stockfish19-lite-16-1800'
const results = new Set(['*', '1-0', '0-1', '1/2-1/2'])
const limit = 100
const normalProfile = value => /^[a-z0-9_-]{1,50}$/.test(String(value || '').toLowerCase()) ? String(value).toLowerCase() : 'yerel-profil'
export const stableMatchId = path => {
  const match = String(path || '').replace(/^\/tr(?=\/)/, '').match(/^\/game\/(?:(live|daily)\/)?(\d+)\/?$/)
  return match ? `${match[1] === 'daily' ? 'daily' : 'live'}:${match[2]}` : null
}
const isPrefix = (a, b) => a.length <= b.length && a.every((value, index) => value === b[index])

export function journalSession(previous, { path, profile, moves, result = '*', newGame = false }, makeId = () => crypto.randomUUID()) {
  const stable = stableMatchId(path)
  const owner = normalProfile(profile)
  const related = previous?.profile === owner && /^bot:[\w-]{1,100}$/.test(previous.id || '') && Array.isArray(previous.moves) &&
    (isPrefix(previous.moves, moves) || isPrefix(moves, previous.moves))
  const restarted = previous?.moves?.length > 0 && moves.length === 0 && result === '*'
  const id = stable || (!newGame && related && !restarted ? previous.id : `bot:${makeId()}`)
  return { id, profile: owner, moves: related && !restarted && previous.moves.length > moves.length ? previous.moves : [...moves], result, version: 1 }
}

export function compactMatch(input) {
  if (!input || !/^(?:bot:[\w-]{1,100}|(?:live|daily):\d+)$/.test(input.id || '') || !['w', 'b'].includes(input.color) ||
      !Array.isArray(input.moves) || input.moves.length > 1200 || !results.has(input.result || '*')) throw new Error('Maç kaydı geçersiz')
  const game = new Chess()
  const history = []
  for (const san of input.moves) {
    if (typeof san !== 'string' || san === '--') throw new Error('Hamle kaydı geçersiz')
    const move = game.move(san)
    history.push(move)
  }
  const byPly = new Map()
  for (const grade of input.grades || []) {
    const move = history[grade.ply - 1]
    if (!move || move.color !== input.color || grade.color !== move.color || grade.san !== move.san || !Object.hasOwn(gradeLabels, grade.code) ||
        (grade.beforeFen && grade.beforeFen !== move.before) || (grade.afterFen && grade.afterFen !== move.after) ||
        !Number.isFinite(grade.depth) || grade.depth < 10) continue
    const motifs = grade.best?.motifs || []
    const mate = grade.best?.score?.type === 'mate' && grade.best.score.value > 0 && grade.best.score.value <= 5
    const opportunity = grade.code !== 'correction' && grade.legalCount !== 1 && (mate || motifs.some(motif => motif.prize || motif.evidence))
    byPly.set(grade.ply, { ply: grade.ply, code: grade.code, loss: Math.max(0, Math.min(100000, Number(grade.loss) || 0)), depth: grade.depth, assessedAt: Math.max(0, Math.min(1e15, Number(grade.assessedAt) || 0)),
      phase: phaseOf(move.before), opportunity: !!opportunity, converted: opportunity ? positiveGrades.has(grade.code) : null })
  }
  const ownMoves = history.filter(move => move.color === input.color).length
  const result = game.isCheckmate() ? (game.turn() === 'w' ? '0-1' : '1-0') : game.isDraw() ? '1/2-1/2' : input.result || '*'
  const finished = result !== '*' && ownMoves > 0 && history.length > 0
  const meta = input.metadata || {}
  return { schema: 1, id: input.id, profile: normalProfile(input.profile), color: input.color, mode: ['bot', 'live', 'daily'].includes(input.mode) ? input.mode : 'bot',
    moves: history.map(move => move.san), result, finished, ownMoves, grades: [...byPly.values()], method: journalMethod,
    coachVersion: String(input.coachVersion || '').slice(0, 20),
    metadata: { opponent: typeof meta.opponent === 'string' ? meta.opponent.slice(0, 60) : null,
      opponentRating: Number.isFinite(meta.opponentRating) && meta.opponentRating > 0 && meta.opponentRating < 4000 ? meta.opponentRating : null,
      timeControl: typeof meta.timeControl === 'string' && /^\d{1,6}(?:\+\d{1,5})?$/.test(meta.timeControl) ? meta.timeControl : null },
    assistance: { ...Object.fromEntries(Object.entries(input.assistance || {}).filter(([key, value]) => /^[a-z][a-zA-Z0-9]{0,30}$/.test(key) && Number.isFinite(value)).map(([key, value]) => [key, Math.max(0, Math.min(100000, value))])),
      settings: Array.isArray(input.assistance?.settings) ? [...new Set(input.assistance.settings.filter(value => typeof value === 'string').map(value => value.slice(0, 250)))].slice(-20) : [] },
    planState: input.planState || null }
}

function mergeMatch(previous, next, at) {
  if (!previous) return { ...next, startedAt: at, updatedAt: at, endedAt: next.finished ? at : null, ordinal: null }
  if (previous.color !== next.color && previous.finished) throw new Error('Tamamlanan maçın oyuncu rengi değiştirilemez')
  if (!isPrefix(previous.moves, next.moves) && !isPrefix(next.moves, previous.moves)) throw new Error('Aynı maçın hamle geçmişi çelişiyor')
  const longer = previous.moves.length > next.moves.length ? previous : next
  const keepOld = previous.color === next.color
  const grades = new Map(keepOld ? previous.grades.map(grade => [grade.ply, grade]) : [])
  for (const grade of next.grades) {
    const old = grades.get(grade.ply)
    if (!old || grade.code === 'correction' || (next.moves.length >= previous.moves.length && old.code !== 'correction' &&
      (grade.depth > old.depth || (grade.depth === old.depth && grade.assessedAt >= old.assessedAt)))) grades.set(grade.ply, grade)
  }
  const completed = previous.finished ? previous : next.finished ? next : null
  const assistance = { ...previous.assistance }
  for (const [key, count] of Object.entries(next.assistance)) if (Number.isFinite(count)) assistance[key] = Math.max(Number(assistance[key]) || 0, Math.max(0, count))
  assistance.settings = [...new Set([...(previous.assistance.settings || []), ...(next.assistance.settings || [])])].slice(-20)
  return { ...previous, ...next, ...longer, color: next.color, ownMoves: longer.moves.filter((_, index) => (index % 2 ? 'b' : 'w') === next.color).length, grades: [...grades.values()], assistance,
    planState: next.planState || previous.planState, metadata: Object.fromEntries(Object.entries(next.metadata).map(([key, value]) => [key, value ?? previous.metadata[key]])),
    result: completed?.result || '*', finished: !!completed, ordinal: previous.ordinal, startedAt: previous.startedAt,
    endedAt: previous.endedAt || (completed ? at : null), updatedAt: at }
}

export function createMatchStore(storage, options = {}) {
  const locked = options.withLock || (work => work())
  const now = options.now || Date.now
  let pending = Promise.resolve()
  const read = async () => {
    const value = (await storage.get(journalKey))[journalKey]
    return value?.schema === 1 && Array.isArray(value.matches) && value.totals ? value : { schema: 1, matches: [], totals: {} }
  }
  const transaction = work => {
    const request = pending.catch(() => {}).then(() => locked(async () => work(await read())))
    pending = request.catch(() => {})
    return request
  }
  return {
    save(input) {
      const snapshot = compactMatch(input)
      return transaction(async db => {
        const index = db.matches.findIndex(match => match.id === snapshot.id && match.profile === snapshot.profile)
        const merged = mergeMatch(db.matches[index], snapshot, now())
        const newlyCompleted = merged.finished && !merged.ordinal
        if (merged.finished && !merged.ordinal) {
          const counter = `profile:${merged.profile}`
          db.totals[counter] = (Number.isSafeInteger(db.totals[counter]) ? db.totals[counter] : 0) + 1
          merged.ordinal = db.totals[counter]
        }
        if (index >= 0) db.matches[index] = merged
        else db.matches.push(merged)
        // Preserve the most recent 100 completed games and 8 active games per profile.
        const profiles = new Set(db.matches.map(match => match.profile))
        db.matches = [...profiles].flatMap(profile => {
          const games = db.matches.filter(match => match.profile === profile)
          return [...games.filter(match => match.finished).sort((a, b) => b.ordinal - a.ordinal).slice(0, limit),
            ...games.filter(match => !match.finished).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8)]
        })
        await storage.set({ [journalKey]: db })
        return { ...merged, newMilestone: !!newlyCompleted && merged.ordinal % 10 === 0 }
      })
    },
    async list(profile) { await pending; const db = await read(); const owner = normalProfile(profile); return { matches: db.matches.filter(match => match.profile === owner), total: db.totals[`profile:${owner}`] || 0, profile: owner } },
    clear(profile) { return transaction(async db => { const owner = normalProfile(profile); db.matches = db.matches.filter(match => match.profile !== owner); delete db.totals[`profile:${owner}`]; await storage.set({ [journalKey]: db }) }) }
  }
}

function metrics(matches) {
  const counts = Object.fromEntries(Object.keys(gradeLabels).map(code => [code, 0]))
  const phases = Object.fromEntries(['açılış', 'oyun ortası', 'oyun sonu'].map(phase => [phase, { total: 0, errors: 0, graded: 0 }]))
  let own = 0, covered = 0, graded = 0, opportunities = 0, converted = 0, strong = 0
  for (const match of matches) {
    own += match.ownMoves
    const game = new Chess()
    for (const san of match.moves) { const before = game.fen(); const move = game.move(san); if (move.color === match.color) phases[phaseOf(before)].total++ }
    for (const grade of match.grades) {
      covered++; counts[grade.code]++
      if (grade.code === 'correction') continue
      graded++; phases[grade.phase].graded++
      if (['mistake', 'blunder'].includes(grade.code)) phases[grade.phase].errors++
      if (positiveGrades.has(grade.code)) strong++
      if (grade.opportunity) { opportunities++; if (grade.converted) converted++ }
    }
  }
  const rate = value => graded ? value / graded * 100 : null
  return { games: matches.length, ownMoves: own, graded, coverage: own ? Math.min(100, covered / own * 100) : 0, counts,
    errorsPer100: rate(counts.mistake + counts.blunder), blundersPer100: rate(counts.blunder), strongPercent: rate(strong),
    opportunities, converted, opportunityPercent: opportunities ? converted / opportunities * 100 : null, phases }
}

export function developmentReport({ matches, total, profile }) {
  const completed = matches.filter(match => match.finished && Number.isInteger(match.ordinal)).sort((a, b) => a.ordinal - b.ordinal)
  const latest = completed.slice(-10)
  const boundary = Math.floor(total / 10) * 10
  const block = (from, to) => completed.filter(match => match.ordinal >= from && match.ordinal <= to)
  const currentBlock = boundary >= 10 ? block(boundary - 9, boundary) : []
  const previousBlock = boundary >= 20 ? block(boundary - 19, boundary - 10) : []
  const rolling = metrics(latest)
  const current = metrics(currentBlock)
  const previous = metrics(previousBlock)
  const ready = current.games === 10 && previous.games === 10
  const warnings = []
  const comparisonGames = [...previousBlock, ...currentBlock]
  if (ready && (current.coverage < 70 || previous.coverage < 70 || Math.abs(current.coverage - previous.coverage) > 15)) warnings.push('Analiz kapsamı düşük veya iki dönem arasında belirgin biçimde farklı; gelişim yorumu sınırlı.')
  if (new Set(comparisonGames.map(match => match.method)).size > 1) warnings.push('Değerlendirme yöntemi değişti; dönemler doğrudan karşılaştırılamıyor.')
  const summarize = list => ({ modes: list.map(match => match.mode).sort(), timeControls: list.map(match => match.metadata.timeControl).filter(Boolean).sort(),
    rating: list.some(match => match.metadata.opponentRating) ? list.filter(match => match.metadata.opponentRating).reduce((sum, match) => sum + match.metadata.opponentRating, 0) / list.filter(match => match.metadata.opponentRating).length : null })
  const a = summarize(currentBlock), b = summarize(previousBlock)
  if (ready) {
    if (a.modes.join(',') !== b.modes.join(',')) warnings.push('Bot/canlı/günlük oyun dağılımı değişti.')
    if (!comparisonGames.every(match => match.metadata.timeControl)) warnings.push('Bazı maçların süre bilgisi bilinmiyor.')
    else if (a.timeControls.sort().join(',') !== b.timeControls.sort().join(',')) warnings.push('Oyun süreleri değişti.')
    if (comparisonGames.some(match => match.metadata.opponentRating === null)) warnings.push('Bazı rakip seviyeleri bilinmiyor.')
    if (a.rating === null || b.rating === null) warnings.push('Rakip seviyeleri yeterince bilinmiyor.')
    else if (Math.abs(a.rating - b.rating) >= 150) warnings.push('Ortalama rakip seviyesi belirgin biçimde değişti.')
    if (new Set(comparisonGames.map(match => JSON.stringify([...(match.assistance?.settings || [])].sort()))).size > 1 || comparisonGames.some(match => match.assistance?.settings?.length > 1)) warnings.push('Koç yardım ayarları değişti; okuma/ok istekleri yardımın gerçekten kullanıldığını kanıtlamaz.')
  }
  const reliable = ready && current.graded > 0 && previous.graded > 0 && !warnings.some(text => /kapsamı|yöntemi/.test(text))
  let interpretation = total < 10 ? `İlk ölçüm için ${10 - total} tamamlanan maç daha gerekiyor.`
    : !ready ? `Son ${rolling.games} maçın özeti hazır. ${total < 20 ? 'İlk dönem karşılaştırması 20. maçta oluşur.' : 'İki tam dönem için gerekli kayıtlar bulunamadı.'}`
      : !reliable ? 'İki dönem hazır; veri kapsamı veya değerlendirme yöntemi güvenilir bir gelişim yorumu için yeterli değil.'
        : current.errorsPer100 < previous.errorsPer100 - 1 ? 'Değerlendirilen hamlelerde hata sıklığın önceki döneme göre azaldı. Bu bir gelişim işaretidir; tek başına beceri ölçümü değildir.'
          : current.errorsPer100 > previous.errorsPer100 + 1 ? 'Değerlendirilen hamlelerde hata sıklığın önceki döneme göre arttı. Rakip, süre ve yardım koşullarını da değerlendir.'
            : 'Değerlendirilen hamlelerde hata sıklığı iki dönemde benzer.'
  const phaseChanges = Object.keys(current.phases).map(phase => {
    const a = current.phases[phase], b = previous.phases[phase]
    const enough = reliable && a.graded >= 10 && b.graded >= 10 && a.graded / a.total >= 0.7 && b.graded / b.total >= 0.7
    const difference = enough ? a.errors / a.graded * 100 - b.errors / b.graded * 100 : null
    return { phase, difference, text: !enough ? `${phase}: dönem yorumu için yeterli analiz kapsamı yok.` : `${phase}: hata sıklığı ${difference < -2 ? 'azaldı' : difference > 2 ? 'arttı' : 'benzer kaldı'}.` }
  })
  return { schema: 1, profile, total, retained: completed.length, rolling, current, previous, ready, reliable, warnings, interpretation, phaseChanges,
    conditions: { current: a, previous: b }, recent: latest.map(match => ({ id: match.id, ordinal: match.ordinal, result: match.result, color: match.color, moves: match.moves, metadata: match.metadata, ownMoves: match.ownMoves,
      graded: match.grades.length, version: match.coachVersion, assistance: match.assistance })),
    currentRange: boundary >= 10 ? [boundary - 9, boundary] : null, previousRange: boundary >= 20 ? [boundary - 19, boundary - 10] : null,
    nextMilestone: (Math.floor(total / 10) + 1) * 10, boundary,
    note: 'Oranlar yeterli hesapla değerlendirilen kendi hamlelerine dayanır. Koç düzeltmeleri oyuncu hatası sayılmaz. Kayıt bu sürümden itibaren başlar; önceki oyunlar kendiliğinden eklenmez.' }
}
