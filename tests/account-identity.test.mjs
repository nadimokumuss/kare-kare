import test from 'node:test'
import assert from 'node:assert/strict'
import { signedInAccount } from '../extension/account-identity.js'

test('reviewer identity comes from site navigation, not a game-player header', () => {
  const link = value => ({ getAttribute: () => value })
  const doc = {
    querySelector: () => null,
    querySelectorAll(selector) {
      assert.equal(selector.includes('header'), false)
      return [link('/member/hisaycheese')]
    }
  }
  assert.equal(signedInAccount(doc), 'hisaycheese')
})

test('a dedicated signed-in username takes precedence over profile links', () => {
  const doc = {
    querySelector: () => ({ getAttribute: () => 'hisaycheese' }),
    querySelectorAll: () => [{ getAttribute: () => '/member/opponent' }]
  }
  assert.equal(signedInAccount(doc), 'hisaycheese')
})
