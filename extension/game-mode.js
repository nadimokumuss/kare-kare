// Live pages are deliberately excluded from the default manifest and build.
// A separately built, account-limited package can enable this adapter later.
const compiledLiveEnabled = typeof __KARE_LIVE_ENABLED__ !== 'undefined' && __KARE_LIVE_ENABLED__ === true
const compiledLiveAccounts = typeof __KARE_LIVE_ACCOUNTS__ !== 'undefined' ? __KARE_LIVE_ACCOUNTS__ : []
const compiledLiveFrom = typeof __KARE_LIVE_FROM__ !== 'undefined' ? __KARE_LIVE_FROM__ : ''
const compiledLiveUntil = typeof __KARE_LIVE_UNTIL__ !== 'undefined' ? __KARE_LIVE_UNTIL__ : ''

export const liveConfig = Object.freeze({
  enabled: compiledLiveEnabled,
  accounts: compiledLiveAccounts,
  from: compiledLiveFrom,
  until: compiledLiveUntil
})

// These accounts belong to the project owner and are never eligible for the
// separate Chess.com reviewer build, even if a build configuration includes them.
export const ownerAccounts = Object.freeze(['chessofmakekek', 'staretzosima', 'ivanofchess'])

export function gameMode(pathname, config = liveConfig) {
  const path = String(pathname || '').replace(/^\/tr(?=\/)/, '')
  if (/^\/play\/computer(?:\/|$)/.test(path)) return 'bot'
  if (!config.enabled) return null
  if (/^\/(?:play\/online|game\/live|play\/live)(?:\/|\.html$|$)/.test(path)) return 'live'
  // Chess.com's current Play flow can open a live game at /game/<numeric-id>.
  if (/^\/game\/\d+\/?$/.test(path)) return 'live'
  if (/^\/(?:play\/daily|game\/daily)(?:\/|\.html$|$)/.test(path)) return 'daily'
  return null
}

export function liveAccountAllowed(account, now = new Date(), config = liveConfig) {
  if (!config.enabled || !account || !Array.isArray(config.accounts)) return false
  const normalized = String(account).toLowerCase()
  if (ownerAccounts.includes(normalized) || !config.accounts.includes(normalized)) return false
  const starts = Date.parse(config.from)
  const expires = Date.parse(config.until)
  return Number.isFinite(starts) && Number.isFinite(expires) && starts <= now.getTime() && now.getTime() <= expires
}

// Chess.com may replace the header while the lobby turns into a game. Keep an
// account verified in this document until a different account is observed.
export function reviewAccess(observedAccount, verifiedAccount, now = new Date(), config = liveConfig) {
  const observed = observedAccount ? String(observedAccount).toLowerCase() : null
  const account = observed || verifiedAccount
  const allowed = liveAccountAllowed(account, now, config)
  return { allowed, verifiedAccount: allowed ? account : null,
    reason: !account ? 'account_not_detected' : !allowed ? 'account_not_listed_or_expired' : 'allowed' }
}

export function boardSelectors(mode) {
  if (mode === 'bot') return ['#board-play-computer']
  if (mode === 'live' || mode === 'daily') return ['wc-chess-board', 'chess-board', '[id^="board-"].board', '.board-layout-main .board']
  return []
}
