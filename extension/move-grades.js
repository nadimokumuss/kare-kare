import { Chess } from 'chess.js'

export const gradeLabels = Object.freeze({ brilliant: 'Harika', great: 'Çok iyi', book: 'Kitap', best: 'En iyi',
  excellent: 'Mükemmel', good: 'İyi', inaccuracy: 'Yanlışlık', mistake: 'Hata', missed: 'Kaçırılan hamle', blunder: 'Büyük hata', correction: 'Koç düzeltmesi' })
export const positiveGrades = new Set(['brilliant', 'great', 'book', 'best', 'excellent', 'good'])
export const negativeGrades = new Set(['inaccuracy', 'mistake', 'missed', 'blunder'])
export const importantGrades = new Set(['brilliant', 'great', 'mistake', 'missed', 'blunder', 'correction'])
export const gradeThresholds = Object.freeze({ excellent: 15, good: 55, inaccuracy: 100, mistake: 200 })

// A small, authored reference, not a downloaded opening database. Every match
// carries its named line. Unknown theory is deliberately left unclassified.
export const openingLines = Object.freeze([
  ['İtalyan Açılışı', 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3'],
  ['İspanyol Açılışı', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7'],
  ['İskoç Açılışı', 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4'],
  ['Rus Savunması', 'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4'],
  ['Viyana Oyunu', 'e4 e5 Nc3 Nf6 Bc4 Nc6'],
  ['Sicilya Savunması', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6'],
  ['Sicilya: Kapalı Sistem', 'e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7'],
  ['Fransız Savunması', 'e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7'],
  ['Fransız: İlerleme', 'e4 e6 d4 d5 e5 c5 c3 Nc6'],
  ['Caro–Kann Savunması', 'e4 c6 d4 d5 e5 Bf5 Nf3 e6'],
  ['Caro–Kann: Klasik', 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5'],
  ['İskandinav Savunması', 'e4 d5 exd5 Qxd5 Nc3 Qa5'],
  ['Pirc Savunması', 'e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7'],
  ['Vezir Gambiti: Reddedilen', 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7'],
  ['Slav Savunması', 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4'],
  ['Vezir Gambiti: Kabul Edilen', 'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6'],
  ['Şah Hint Savunması', 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6'],
  ['Nimzo Hint Savunması', 'd4 Nf6 c4 e6 Nc3 Bb4'],
  ['İngiliz Açılışı', 'c4 e5 Nc3 Nf6 Nf3 Nc6'],
  ['Réti Açılışı', 'Nf3 d5 g3 Nf6 Bg2 e6 O-O']
])
const positionKey = fen => fen.split(' ').slice(0, 4).join(' ')
let book = null
export function bookReference(fen, uci) {
  if (Number(fen?.split(' ')[5]) > 10) return null
  if (!book) {
    book = new Map()
    for (const [name, line] of openingLines) {
      const game = new Chess()
      for (const san of line.split(' ')) {
        const before = positionKey(game.fen())
        const move = game.move(san)
        const key = `${before}:${move.from}${move.to}${move.promotion || ''}`
        if (!book.has(key)) book.set(key, { name, source: 'Kare Kare yerel açılış referansı' })
      }
    }
  }
  try { return book.get(`${positionKey(fen)}:${uci}`) || null } catch { return null }
}

export function ordinaryGrade({ loss, forced, bestMove, gap, beforeValue, afterValue, alternativeValue, tactical, sacrifice, book: opening }) {
  if (loss > gradeThresholds.good) {
    const stillDecisive = beforeValue > 650 && afterValue > 650
    if (loss >= gradeThresholds.mistake && !stillDecisive) return 'blunder'
    if (tactical && beforeValue >= 150 && loss >= 100 && !stillDecisive) return 'missed'
    return loss >= gradeThresholds.inaccuracy ? 'mistake' : 'inaccuracy'
  }
  if (forced) return 'good'
  if (bestMove && loss <= 15 && sacrifice && Number.isFinite(alternativeValue) && alternativeValue < 650 && afterValue >= 0) return 'brilliant'
  if (bestMove && loss <= 25 && gap >= 100) return 'great'
  if (opening) return 'book'
  if (bestMove) return 'best'
  return loss <= gradeThresholds.excellent ? 'excellent' : 'good'
}

export function gradeCue(code, own, mate = false) {
  if (mate) return own ? 'Matı tamamladın.' : 'Rakip matı tamamladı.'
  const ownCues = {
    brilliant: 'Harika bir feda; hesaplanan devam bu fikri destekliyor.', great: 'Çok iyi seçim; diğer devamlar belirgin biçimde daha zayıftı.',
    book: 'Açılış teorisine uygun.', best: 'Hesaplanan en güçlü devamı buldun.', excellent: 'Mükemmel; en güçlü seçeneğe çok yakın.',
    good: 'İyi hamle.', inaccuracy: 'Küçük bir avantaj kaçtı.', mistake: 'Bu hamle konumunu zayıflattı; güçlü cevabı hesapla.',
    missed: 'Daha güçlü bir taktik fırsatı kaçtı.', blunder: 'Büyük hata; rakibin en güçlü cevabını hesapla.',
    correction: 'Önceki koç önerisini düzeltiyorum; yeni hesap rakibin zorunlu matını gösterdi.'
  }
  const enemyCues = {
    brilliant: 'Rakip güçlü bir feda buldu.', great: 'Rakip kritik devamı buldu.', book: 'Rakip açılış teorisini izliyor.',
    best: 'Rakip hesaplanan en güçlü devamı oynadı.', excellent: 'Rakibin seçimi en güçlü devamın gücüne çok yakın.', good: 'Rakip iyi bir hamle oynadı.',
    inaccuracy: 'Rakip küçük bir avantaj bıraktı.', mistake: 'Rakibin hatasını değerlendirecek devamı ara.',
    missed: 'Rakip taktik fırsatını kaçırdı.', blunder: 'Rakip büyük hata yaptı; açığı değerlendiren devamı ara.', correction: ownCues.correction
  }
  return (own ? ownCues : enemyCues)[code] || ''
}
