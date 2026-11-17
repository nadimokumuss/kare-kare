import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultShortcuts, keyLabel, normalizeKey, shortcutAction, validateShortcuts } from '../extension/keyboard-controls.js'

const key = value => ({ key: value, target: { closest: () => null } })

test('every default task has one unique key and works without modifiers even while the panel is collapsed', () => {
  assert.equal(validateShortcuts(defaultShortcuts).error, null)
  for (const [action, value] of Object.entries(defaultShortcuts)) assert.equal(shortcutAction(key(value)), action)
  assert.equal(shortcutAction(key(' ')), 'arrows')
  assert.equal(shortcutAction(key('Q')), 'comment')
  assert.equal(shortcutAction(key('x')), null)
  assert.equal(shortcutAction(key('z')), null)
  assert.equal(keyLabel(' '), 'Boşluk')
})

test('typing, composing, key repeat, form buttons and shadow-root inputs never trigger coaching', () => {
  for (const flag of ['repeat', 'isComposing', 'ctrlKey', 'metaKey', 'altKey', 'shiftKey', 'defaultPrevented']) assert.equal(shortcutAction({ ...key('q'), [flag]: true }), null, flag)
  assert.equal(shortcutAction({ ...key('q'), target: { closest: () => ({}) } }), null)
  assert.equal(shortcutAction({ ...key('q'), composedPath: () => [{ isContentEditable: true }] }), null)
  assert.equal(shortcutAction(key('q'), defaultShortcuts, false), null)
})

test('custom single-key maps support Turkish keys, swapping, disabling and persistent validation', () => {
  const swapped = { ...defaultShortcuts, comment: 'w', plan: 'q', hint: 'ş', details: '' }
  assert.equal(validateShortcuts(swapped).error, null)
  assert.equal(shortcutAction(key('Ş'), swapped), 'hint')
  assert.equal(shortcutAction(key('g'), swapped), null)
  assert.equal(normalizeKey('İ'), 'i')
  assert.ok(validateShortcuts({ ...defaultShortcuts, stop: 'x' }).error)
  assert.ok(validateShortcuts({ ...defaultShortcuts, comment: 'w' }).error)
  assert.ok(validateShortcuts({ ...defaultShortcuts, comment: 'Alt+Q' }).error)
})
