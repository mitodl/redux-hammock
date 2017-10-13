// @flow
import { assert } from 'chai'
import R from 'ramda'

import {
  withUsername,
  updateStateByUsername,
} from './util'

describe('utils', () => {
  describe('withUsername', () => {
    let TYPE = 'TYPE'
    it('should return an action creator, given a type', () => {
      let creator = withUsername(TYPE)
      assert.isFunction(creator)
    })

    it('should add a username and a payload', () => {
      let creator = withUsername(TYPE)
      let action = creator('username', { my: 'payload' })
      assert.deepEqual(action, {
        type: TYPE,
        payload: { my: 'payload' },
        meta: 'username'
      })
    })
  })

  describe('updateStateByUsername', () => {
    it('should namespace the update under the username', () => {
      let state = {}
      assert.deepEqual(updateStateByUsername(state, 'foobar', { potato: 'bread' }), {
        foobar: {
          potato: 'bread'
        }
      })
    })

    it('should leave stuff already on the state intact', () => {
      let state = { potato: 'bread' }
      assert.deepEqual(updateStateByUsername(state, 'foobar', { rice: 'bread' }), {
        foobar: {
          rice: 'bread'
        },
        potato: 'bread'
      })
    })

    it('should update over the old state for the username', () => {
      let state = { foobar: { potato: 'pancake' } }
      assert.deepEqual(updateStateByUsername(state, 'foobar', { potato: 'bread' }), {
        foobar: {
          potato: 'bread'
        }
      })
    })

    it('should deeply merge the update with the current state', () => {
      let state = { foobar: { existing: 'state' } }
      assert.deepEqual(updateStateByUsername(state, 'foobar', { potato: 'bread' }), {
        foobar: {
          existing: 'state',
          potato: 'bread'
        }
      })
    })
  })
})
