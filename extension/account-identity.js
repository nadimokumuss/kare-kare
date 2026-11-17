// Read only site navigation identity. Game-player headers may link to the
// opponent and must never be treated as the signed-in account.
export function signedInAccount(doc) {
  const identity = doc.querySelector('#notifications-request[username]')?.getAttribute('username')
  if (identity && /^[a-z0-9_-]{3,25}$/i.test(identity)) return identity.toLowerCase()
  const links = doc.querySelectorAll('nav a[href*="/member/"], .nav-menu a[href*="/member/"]')
  for (const link of links) {
    const match = link.getAttribute('href')?.match(/\/member\/([^/?#]+)/i)
    if (!match) continue
    try {
      const account = decodeURIComponent(match[1]).toLowerCase()
      if (/^[a-z0-9_-]{3,25}$/.test(account)) return account
    } catch { /* Ignore a malformed profile link. */ }
  }
  return null
}
