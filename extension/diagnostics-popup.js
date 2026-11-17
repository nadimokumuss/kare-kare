import { diagnosticKey } from './diagnostics.js'

const $ = id => document.getElementById(id)
const value = (id, text) => { $(id).textContent = text ?? '—' }
const display = entry => {
  value('time', entry.at ? new Date(entry.at).toLocaleString() : '—')
  value('route', entry.route)
  value('access', entry.access)
  value('board', entry.board ? `${entry.board}${entry.pieceCount ? ` (${entry.pieceCount} pieces)` : ''}` : null)
  value('moves', Number.isInteger(entry.moveCount) ? String(entry.moveCount) : null)
  value('engine', entry.engine)
  value('speech', entry.speechState)
  value('speech-error', entry.speechError || 'None')
  value('speech-connection', entry.speechTransport ? `${entry.speechTransport.connected ? 'Connected' : 'Disconnected'} • ${entry.speechTransport.connections} connections • ${entry.speechVoiceCount ?? '—'} local Turkish voices` : null)
  value('stage', entry.stage)
  value('error', entry.error || 'None')
}

async function main() {
  value('version', chrome.runtime.getManifest().version)
  try {
    const response = await fetch(chrome.runtime.getURL('review-config.json'))
    const config = await response.json()
    value('accounts', config.accounts.join(', '))
    value('window', `${config.from} – ${config.until}`)
    const saved = await chrome.storage.local.get(diagnosticKey)
    const records = Array.isArray(saved[diagnosticKey]) ? saved[diagnosticKey] : []
    const latest = records.at(-1)
    if (!latest) return
    display(latest)
    $('notice').textContent = `${records.length} local check${records.length === 1 ? '' : 's'} stored. Last observed page is shown; it may be from another tab.`
    $('export').disabled = false
    $('export').addEventListener('click', () => {
      const report = { version: chrome.runtime.getManifest().version, config, exportedAt: new Date().toISOString(), records }
      const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `kare-kare-diagnostics-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 30000)
      $('notice').textContent = 'Diagnostic report downloaded.'
    })
  } catch (error) {
    $('notice').textContent = `Diagnostics unavailable: ${error.message}`
  }
}

main()
