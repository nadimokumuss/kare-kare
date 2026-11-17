// This is an isolated browser fixture. It never joins a real game or uses OS TTS.
export async function run({ game, render, key, wait, until, check }) {
  const result = document.querySelector('#integration-result')
  const forkMoves = 'e4 c6 d4 d5 e5 Bf5 g4 Bxc2 Qxc2 e6 Nf3 b5 Be3 h5 gxh5 Rxh5 Nbd2 Qe7 O-O-O a6 Be2 Rh3 Ng5 Rh4 Nxe6 Qxe6 Nf3 Rh3 Ng5 Qd7 e6 fxe6 Qg6+ Ke7 Qf7+ Kd8 Nxe6+ Kc8 Qxf8+ Kb7'.split(' ')
  const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  const set = (element, value, type = 'change') => { element.value = value; element.dispatchEvent(new Event(type)) }
  const stroke = (panel, rank) => document.querySelector(`#kk-board-arrows [data-layer="candidates"] line[data-rank="${rank}"]`)?.getAttribute('stroke')
  const activeLine = (from, to) => document.querySelector(`#kk-board-arrows [data-layer="narration"] line[data-from="${from}"][data-to="${to}"]`)
  try {
    await until(() => document.querySelector('.kk-move'), 'panel candidates')
    const panel = document.querySelector('#kare-kare-coach'), board = document.querySelector('#board-play-computer')
    const $ = selector => panel.querySelector(selector)
    if (localStorage.getItem('fixture-panel-stage') === 'reload') {
      render(forkMoves)
      await until(() => $('.kk-move')?.textContent.includes('Nc5+'), 'restored fork')
      await wait(400)
      check($('.kk-panel-width').value === '400' && $('.kk-text-size').value === '17', 'saved sizing')
      check(panel.dataset.theme === 'light' && $('.kk-narration-mode').value === 'all', 'saved appearance')
      check(panel.dataset.placement === 'right' && !overlap(panel.getBoundingClientRect(), board.getBoundingClientRect()), 'restored safe placement')
      $('.kk-context-tab[data-context="comment"]').click()
      await key(' ')
      fixtureHoldSpeech = true
      await key('a')
      await until(() => activeLine('e6', 'c5'), 'final narrated fork')
      fixtureHoldSpeech=false;fixtureActive.finish();await wait(160);$('.kk-body').scrollTop=0;
      const firstCard=$('.kk-card-1').getBoundingClientRect(),footer=$('.kk-footer').getBoundingClientRect();check(firstCard.top>panel.getBoundingClientRect().top&&firstCard.bottom<=footer.top+1,'primary candidate visible without scrolling');
      check(fixtureErrors.length === 0, 'runtime errors after reload')
      result.textContent = JSON.stringify({ passed: true, sidePlacement: true, blockedSidebarFallback: true, leftPlacement: true, flipOrientation: true,
        tabNavigation: true, appearanceSaved: true, rankColors: true, speechArrows: true, sequentialTargets: true, conditionalReply: true,
        stopAndLateEvents: true, independentArrowSwitch: true, exclusiveNarration: true, shortcutMatrix: 12, uniformActorLabels: true, boardRedrawRecovery: true, hiddenMovesProtected: true, collapsedCritical: true, modeFiltering: true, errors: fixtureErrors })
      document.body.dataset.integration = 'passed'
      return
    }
    await until(() => panel.dataset.placement === 'right', 'focus right placement')
    check(Math.abs(panel.getBoundingClientRect().width - 360) < 1, 'default width')
    check(!overlap(panel.getBoundingClientRect(), board.getBoundingClientRect()), 'board is unobscured')
    set($('.kk-panel-width'), '420', 'input'); set($('.kk-text-size'), '18', 'input'); set($('.kk-theme'), 'light')
    await until(() => Math.abs(panel.getBoundingClientRect().width - 420) < 1, 'resized panel')
    check(getComputedStyle($('.kk-message')).fontSize === '18px', 'readable font scaling')
    const native = document.createElement('aside'); native.className = 'board-layout-sidebar'; native.style.cssText = 'position:fixed;left:550px;top:50px;width:620px;height:850px;background:#384238'; document.body.append(native)
    await until(() => panel.dataset.placement === 'below', 'normal sidebar fallback')
    check(panel.getBoundingClientRect().top > board.getBoundingClientRect().bottom, 'fallback below board')
    const originalTop = panel.getBoundingClientRect().top + scrollY
    window.scrollTo(0, 700); await wait(120)
    check(Math.abs(panel.getBoundingClientRect().top + scrollY - originalTop) < 2, 'fallback does not drift on scroll')
    check(!overlap(panel.getBoundingClientRect(), board.getBoundingClientRect()), 'scroll preserves separation')
    window.scrollTo(0, 0); native.remove()
    await until(() => panel.dataset.placement === 'right', 'focus restored')
    board.style.marginLeft = '600px'; set($('.kk-panel-side'), 'left')
    await until(() => panel.dataset.placement === 'left', 'left preference')
    check(panel.getBoundingClientRect().right < board.getBoundingClientRect().left, 'left avoids board')
    board.style.marginLeft = ''; set($('.kk-panel-side'), 'auto'); set($('.kk-panel-width'), '360', 'input')
    await until(() => panel.dataset.placement === 'right', 'right after layout reset')
    const focusButton=$('[data-context="plan"]');focusButton.focus();board.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));check(document.activeElement!==focusButton,'board returns focus for shortcuts');
    for (const section of ['plan', 'opponent', 'comment']) {
      $(`[data-context="${section}"]`).click()
      check($(`[data-context="${section}"]`).getAttribute('aria-selected') === 'true', 'selected tab ' + section)
      check($('#kk-current-explanation').getAttribute('aria-labelledby') === `kk-tab-${section}`, 'tab accessibility')
    }
    // Every requested key must work with the idle arrows both off and on.
    const drainSpeech = async () => { for (let n = 0; n < 30 && fixtureActive; n++) { fixtureActive.finish(); await wait(15) } }
    fixtureHoldSpeech = true
    for (const enabled of [false, true]) {
      if (($('.kk-arrows').getAttribute('aria-pressed') === 'true') !== enabled) await key(' ')
      for (const letter of ['a','s','d','q','w','e']) {
        await key(letter)
        let seen = false
        for (let n = 0; n < 30 && fixtureActive; n++) {
          if (document.querySelector('#kk-board-arrows [data-layer="narration"] [data-from]')) seen = true
          check(!document.querySelector('#kk-board-arrows [data-layer="candidates"]'), 'exclusive layer ' + letter)
          fixtureActive.finish(); await wait(15)
        }
        check(seen, 'narrated move available ' + letter + ' idle=' + enabled)
        check(!!document.querySelector('#kk-board-arrows [data-layer="candidates"]') === enabled, 'restored idle state ' + letter)
      }
    }
    await key(' '); check(!document.querySelector('#kk-board-arrows'), 'matrix ends with idle arrows off')
    render(forkMoves)
    await until(() => $('.kk-move')?.textContent.includes('Nc5+'), 'fork board analysis')
    await wait(500)
    await key(' ')
    check(stroke(panel, 1) === '#d6f263' && stroke(panel, 2) === '#68d4e9' && stroke(panel, 3) === '#ffa96a', 'preserved rank colors')
    board.classList.add('flipped'); render(game.history())
    await until(() => document.querySelector('#kk-board-arrows [data-layer="candidates"] line[data-from="e6"]')?.getAttribute('x1') === '350', 'black-facing arrow')
    board.classList.remove('flipped'); render(game.history()); await wait(250)
    fixtureHoldSpeech = true
    await key('a'); await until(() => activeLine('e6', 'c5'), 'spoken first move')
    const first = fixtureActive
    board.replaceChildren(...[...board.children].filter(node => node.id !== 'kk-board-arrows'))
    await until(() => activeLine('e6', 'c5'), 'narration survives same-position board DOM replacement')
    check(!document.querySelector('#kk-board-arrows [data-layer="candidates"]'), 'unspoken candidates completely hidden')
    check(document.querySelector('#kk-board-arrows [data-actor="self"]').textContent === 'Sen', 'self first-step label')
    $('.kk-minimize').click()
    check(getComputedStyle($('.kk-body')).display === 'none', 'collapsed body')
    check($('.kk-urgent').getBoundingClientRect().height > 0 && $('.kk-audio-status').getBoundingClientRect().height > 0, 'critical and audio visible')
    $('.kk-minimize').click()
    first.finish()
    await until(() => document.querySelector('#kk-board-arrows [data-layer="narration"] [data-target="b7"]') && document.querySelector('#kk-board-arrows [data-layer="narration"] [data-target="d7"]'), 'spoken fork targets')
    first.emit({ type: 'event', id: first.id, event: 'start' }); await wait(40)
    check(!activeLine('e6', 'c5'), 'late first start cannot overwrite targets')
    fixtureActive.finish(); await until(() => activeLine('b7', 'c7'), 'conditional reply')
    check(!activeLine('b7', 'c7').hasAttribute('stroke-dasharray') && document.querySelector('#kk-board-arrows [data-actor="opponent"]').textContent === 'Rakip · 2', 'same solid shape and opponent badge')
    fixtureActive.finish(); await until(() => activeLine('c5', 'd7'), 'spoken third step')
    check(activeLine('c5', 'd7').getAttribute('stroke') === '#d6f263' && activeLine('c5', 'd7').getAttribute('data-step') === '3', 'own continuation retains primary color')
    check(document.querySelector('#kk-board-arrows [data-actor="self"][data-step="3"]').textContent === 'Sen · 3', 'same step-label format')
    await key(' ')
    check(activeLine('c5', 'd7') && !document.querySelector('#kk-board-arrows [data-layer="candidates"]'), 'turning idle arrows off preserves current narration')
    await drainSpeech()
    check(!document.querySelector('#kk-board-arrows'), 'narration finishes with idle arrows off')
    await key('w')
    for (let n = 0; n < 20 && fixtureActive && !document.querySelector('#kk-board-arrows [data-from]'); n++) { fixtureActive.finish(); await wait(15) }
    check(document.querySelector('#kk-board-arrows [data-layer="narration"]'), 'plan draws with idle arrows off')
    const narrativeBefore = document.querySelector('#kk-board-arrows [data-layer="narration"]').innerHTML
    await key(' ')
    check(document.querySelector('#kk-board-arrows [data-layer="narration"]').innerHTML === narrativeBefore && !document.querySelector('#kk-board-arrows [data-layer="candidates"]'), 'turning idle arrows on does not replace narration')
    await drainSpeech()
    check(stroke(panel, 1) === '#d6f263', 'idle candidates restored after natural completion')
    await key('q'); await key('c')
    check(document.querySelector('#kk-board-arrows [data-layer="candidates"]') && !document.querySelector('#kk-board-arrows [data-layer="narration"] [data-from]'), 'stop restores enabled idle arrows')
    await key(' ')
    await key('a');await until(()=>activeLine('e6','c5'),'replay source');await key('c');await key('v');await until(()=>activeLine('e6','c5'),'current replay visuals');await key('c');
    // Checkbox values use checked, rather than their text value.
    $('.kk-hide-moves').checked = true; $('.kk-hide-moves').dispatchEvent(new Event('change')); await wait(40)
    await key('q'); check(!document.querySelector('#kk-board-arrows'), 'hidden hint has no arrows')
    const currentText = fixtureActive?.text || ''
    check(!/ce beş|c5|at ce/.test(currentText), 'hidden hint speech has no move')
    await key('a'); await until(() => activeLine('e6', 'c5'), 'explicit candidate can reveal its own arrows')
    await key('c'); check(!document.querySelector('#kk-board-arrows'), 'stop clears explicit reveal')
    $('.kk-hide-moves').checked = false; $('.kk-hide-moves').dispatchEvent(new Event('change'))
    render([]); await until(() => $('.kk-move')?.textContent.includes('e4'), 'quiet position')
    set($('.kk-narration-mode'), 'off'); await key('a'); check(!document.querySelector('#kk-board-arrows [data-layer="narration"] line'),'off mode has no narration'); await key('c');
    set($('.kk-narration-mode'), 'tactics'); await key('a')
    check(!document.querySelector('#kk-board-arrows [data-layer="narration"] line'), 'quiet move excluded in tactical mode')
    await key('c'); set($('.kk-narration-mode'), 'all'); await key('a'); await until(() => activeLine('e2', 'e4'), 'all mode includes quiet move')
    const old = fixtureActive; render(['e4']); await until(() => $('.kk-move')?.textContent.includes('e5'), 'next position')
    old.emit({ type: 'event', id: old.id, event: 'start' }); old.emit({ type: 'event', id: old.id, event: 'end' }); await wait(60)
    check(!document.querySelector('#kk-board-arrows [data-layer="narration"] line'), 'new board rejects old speech events')
    set($('.kk-panel-width'), '400', 'input'); set($('.kk-text-size'), '17', 'input'); set($('.kk-theme'), 'light'); set($('.kk-panel-side'), 'auto')
    await wait(80)
    check(fixtureErrors.length === 0, 'runtime errors before reload')
    localStorage.setItem('fixture-panel-stage', 'reload'); location.reload()
  } catch (error) {
    result.textContent = JSON.stringify({ passed: false, error: error.message, errors: fixtureErrors, speech: fixtureActive?.text, placement: document.querySelector('#kare-kare-coach')?.dataset.placement })
    document.body.dataset.integration = 'failed'
  }
}
