import { importantGrades } from './move-grades.js'

const variants = {
  brilliant: [['Harika bir feda; hesap bu fikri destekliyor.', 'Güçlü bir taş fedası buldun.', 'Bu feda hesaplanan devamda iyi çalışıyor.'], ['Rakip güçlü bir feda buldu.', 'Rakibin fedası hesapla destekleniyor.', 'Rakip taş vererek güçlü bir devam buldu.']],
  great: [['Çok iyi seçim; alternatifler belirgin biçimde geride.', 'Kritik devamı buldun.', 'Diğer seçeneklerden çok daha güçlü bir hamle.'], ['Rakip kritik devamı buldu.', 'Rakip diğer seçeneklerden daha güçlü bir hamle seçti.', 'Rakibin seçimi alternatiflerden belirgin biçimde iyi.']],
  good: [['İyi hamle.', 'Makul bir seçim.', 'İyi bir seçim yaptın.'], ['Rakip iyi bir hamle oynadı.', 'Rakibin seçimi makul.', 'Rakip iyi bir devam seçti.']],
  best: [['Hesaplanan en güçlü devamı buldun.', 'Bu hesapta en iyi seçenek.', 'Motorun ilk tercihini oynadın.'], ['Rakip en güçlü devamı buldu.', 'Rakibin seçimi motorun ilk tercihi.', 'Rakip bu hesapta en iyi seçeneği oynadı.']],
  excellent: [['Mükemmel; en iyi seçeneğe çok yakın.', 'Çok güçlü bir seçim.', 'En güçlü devamla arada çok az fark var.'], ['Rakip çok güçlü bir seçim yaptı.', 'Rakibin hamlesi en iyiye çok yakın.', 'Rakip mükemmel bir devam seçti.']],
  book: [['Açılış teorisine uygun.', 'Bu hamle açılış referansında var.', 'Bilinen bir açılış devamı.'], ['Rakip açılış teorisini izliyor.', 'Rakibin hamlesi açılış referansında var.', 'Rakip bilinen bir açılış devamı seçti.']],
  inaccuracy: [['Küçük bir avantaj kaçtı.', 'Daha hassas bir seçim vardı.', 'Burada küçük bir iyileştirme mümkündü.'], ['Rakip küçük bir avantaj bıraktı.', 'Rakip daha hassas oynayabilirdi.', 'Rakibin seçiminde küçük bir eksik var.']],
  mistake: [['Bu seçim konumunu zayıflattı; güçlü cevabı hesapla.', 'Burada bir hata var; rakibin güçlü cevabına hazırlan.', 'Daha sağlam bir devam vardı.'], ['Rakibin hatasını değerlendirecek devamı ara.', 'Rakip konumunu zayıflattı.', 'Rakip daha sağlam oynayabilirdi.']],
  missed: [['Taktik fırsatı kaçtı.', 'Daha güçlü bir taktik devam vardı.', 'Bir taktik fırsatını değerlendiremedin.'], ['Rakip taktik fırsatını kaçırdı.', 'Rakip daha güçlü bir taktik devamı seçmedi.', 'Rakip bir fırsatı değerlendirmedi.']],
  blunder: [['Büyük hata; rakibin en güçlü cevabını hesapla.', 'Ciddi bir hata; rakibin güçlü cevabına hazırlan.', 'Bu seçim ciddi kayba yol açıyor.'], ['Rakip büyük hata yaptı; açığı değerlendiren devamı ara.', 'Rakip ciddi bir hata yaptı.', 'Büyük hata rakipten geldi; güçlü devamı ara.']]
}

// Formatting and suppression are independent of the grade's actual meaning.
// Only speech that really starts enters the repetition memory.
export function createSpeechEditor(getPreferences, options = {}) {
  const now = options.now || Date.now
  const counts = new Map()
  const recent = new Map()
  const texts = []
  return {
    prepare(item) {
      if (item.historical || item.kind === 'manual' || item.editorPrepared) return item
      const preferences = getPreferences()
      const routine = item.channel === 'grades' && !importantGrades.has(item.gradeCode) && !item.checkmate
      if (routine && preferences.speechDetail === 'critical') return null
      const meaning = item.variationGroup || (item.channel === 'suggestions' ? item.text.trim() : null)
      const previous = meaning && recent.get(meaning)
      if (preferences.speechDetail !== 'all' && previous && now() - previous.at < 10000 &&
        (routine || item.channel === 'suggestions')) return null
      const choices = !item.checkmate && variants[item.gradeCode]?.[item.own ? 0 : 1]
      let text = item.text
      if (choices) {
        const offset = counts.get(meaning) || 0
        const ordered = choices.slice(offset % choices.length).concat(choices.slice(0, offset % choices.length))
        text = ordered.find(choice => !texts.slice(-6).includes(choice)) || ordered[0]
      }
      return { ...item, text, editorPrepared: true, editorMeaning: meaning }
    },
    started(item) {
      if (item.historical || item.kind === 'manual') return
      if (item.editorMeaning) {
        recent.set(item.editorMeaning, { at: now() })
        counts.set(item.editorMeaning, (counts.get(item.editorMeaning) || 0) + 1)
      }
      texts.push(item.text)
      if (texts.length > 12) texts.shift()
      if (recent.size > 100) recent.delete(recent.keys().next().value)
      if (counts.size > 100) counts.delete(counts.keys().next().value)
    },
    reset() { counts.clear(); recent.clear(); texts.length = 0 }
  }
}
