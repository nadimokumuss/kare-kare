export const diagnosticKey = 'kareKareReviewDiagnosticsV1'

// Keep a small, local trail of review checks. Never record cookies, page text,
// URLs with query strings, or data from a board on an unauthorized account.
export function createDiagnosticReporter(enabled, storage, route) {
  if (!enabled) return () => Promise.resolve()
  const currentRoute = () => typeof route === 'function' ? route() : route
  let snapshot = { route: currentRoute(), stage: 'starting' }
  let last = ''
  let pending = Promise.resolve()
  return patch => {
    snapshot = { ...snapshot, ...patch, route: currentRoute() }
    const signature = JSON.stringify(snapshot)
    if (signature === last) return pending
    last = signature
    const entry = { at: new Date().toISOString(), ...snapshot }
    pending = pending.then(async () => {
      const saved = await storage.get(diagnosticKey)
      const records = Array.isArray(saved[diagnosticKey]) ? saved[diagnosticKey] : []
      await storage.set({ [diagnosticKey]: [...records.slice(-39), entry] })
    }).catch(() => {})
    return pending
  }
}
