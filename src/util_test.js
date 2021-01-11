// @flow
import { assert } from 'chai'

import {
  withUsername,
  updateStateByUsername,
  renameBy
} from './util'

describe('utils', () => {
  describe('withUsername', () => {
    const TYPE = 'TYPE'
    it('should return an action creator, given a type', () => {
      const creator = withUsername(TYPE)
      assert.isFunction(creator)
    })

    it('should add a username and a payload', () => {
      const creator = withUsername(TYPE)
      const action = creator('username', { my: 'payload' })
      assert.deepEqual(action, {
        type: TYPE,
        payload: { my: 'payload' },
        meta: 'username'
      })
    })
  })

  describe('updateStateByUsername', () => {
    it('should namespace the update under the username', () => {
      const state = {}
      assert.deepEqual(updateStateByUsername(state, 'foobar', { potato: 'bread' }), {
        foobar: {
          potato: 'bread'
        }
      })
    })

    it('should leave stuff already on the state intact', () => {
      const state = { potato: 'bread' }
      assert.deepEqual(updateStateByUsername(state, 'foobar', { rice: 'bread' }), {
        foobar: {
          rice: 'bread'
        },
        potato: 'bread'
      })
    })

    it('should update over the old state for the username', () => {
      const state = { foobar: { potato: 'pancake' } }
      assert.deepEqual(updateStateByUsername(state, 'foobar', { potato: 'bread' }), {
        foobar: {
          potato: 'bread'
        }
      })
    })

    it('should deeply merge the update with the current state', () => {
      const state = { foobar: { existing: 'state' } }
      assert.deepEqual(updateStateByUsername(state, 'foobar', { potato: 'bread' }), {
        foobar: {
          existing: 'state',
          potato: 'bread'
        }
      })
    })
  })

  describe('renameBy', () => {
    it('should rename only top-level keys based on a function', () => {
      const value = {
        a: '1',
        b: {
          c: 2
        }
      }
      const renameByAppending = renameBy((key) => `${key}Renamed`)
      assert.deepEqual(renameByAppending(value), {
        aRenamed: '1',
        bRenamed: {
          c: 2
        }
      })
    })
  })
})
