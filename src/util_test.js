// @flow
import { assert } from 'chai'
import R from 'ramda'

import {
  S,
  withUsername,
  updateStateByUsername,
  parseJSON,
  filterE
} from './util'

const assertIsLeft = (e, val) => {
  assert(e.isLeft, 'should be left')
  assert.deepEqual(e.value, val)
}

const assertIsRight = (e, val) => {
  assert(e.isRight, 'should be right')
  assert.deepEqual(e.value, val)
}

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

  describe('parseJSON', () => {
    it('returns Left({}) if handed bad JSON', () => {
      assertIsLeft(parseJSON(''), {})
      assertIsLeft(parseJSON('[[[['), {})
      assertIsLeft(parseJSON('@#R@#FASDF'), {})
    })

    it('returns Right(Object) if handed good JSON', () => {
      let testObj = { foo: [
        'bar', 'baz'
      ]}
      assertIsRight(parseJSON(JSON.stringify(testObj)), testObj)
    })
  })

  describe('filterE', () => {
    let left = S.Left(2)
    let right = S.Right(4)
    it('returns a Left if passed one, regardless of predicate', () => {
      assertIsLeft(filterE(x => x === 2, left), 2)
      assertIsLeft(filterE(x => x !== 2, left), 2)
    })

    it('returns a Left if predicate(right.value) === false', () => {
      assertIsLeft(filterE(x => x === 2, right), 4)
      assertIsLeft(filterE(R.isNil, right), 4)
    })

    it('returns a Right if predicate(right.value) === true', () => {
      assertIsRight(filterE(x => x === 4, right), 4)
      assertIsRight(filterE(x => x % 2 === 0, right), 4)
    })
  })
})
