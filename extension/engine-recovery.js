export async function withEngineRecovery(run, isCurrent, restart) {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!isCurrent()) throw new Error('Yeni konum geldi')
    try { return await run() } catch (error) {
      if (error.message === 'Yeni konum geldi' || !isCurrent() || attempt === 1) throw error
      restart()
    }
  }
}
