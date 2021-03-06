import { assert } from 'chai'
import sinon from 'sinon'
import camelCase from 'lodash.camelcase'
import R from 'ramda'
import configureTestStore from 'redux-asserts'
import fetchMock from 'fetch-mock'

import {
  FETCH_PROCESSING,
  FETCH_SUCCESS,
  FETCH_FAILURE,
  GET,
  POST,
  PATCH,
  DELETE,
  INITIAL_STATE
} from './constants'
import {
  requestActionType,
  successActionType,
  failureActionType,
  clearActionType,
  deriveAction,
  deriveActions,
  deriveReducer,
  deriveReducers,
  deriveVerbFuncs,
  makeFetchFunc
} from './hammock'
import * as actionUtils from './util'

describe('redux REST', () => {
  let sandbox, store, dispatchThen

  const checkForVerbs = (endpoint, cb) => endpoint.verbs.forEach(cb)

  describe('action type derivation functions', () => {
    [
      requestActionType,
      successActionType,
      failureActionType,
      clearActionType
    ].forEach(actionDeriver => {
      it(`should accept any number of arguments (${actionDeriver.name})`, () => {
        [
          [],
          ['hi'],
          ['hello', 'there'],
          ['that', 'is', 'great']
        ].forEach(argSet => {
          const derivedType = actionDeriver(...argSet)
          argSet.forEach(str => {
            assert.include(derivedType, R.toUpper(str))
          })
        })
      })
    })

    it('should produce a sensible result', () => {
      [
        [requestActionType, 'REQUEST_FOOBAR'],
        [successActionType, 'RECEIVE_FOOBAR_SUCCESS'],
        [failureActionType, 'RECEIVE_FOOBAR_FAILURE'],
        [clearActionType, 'CLEAR_FOOBAR']
      ].forEach(([deriver, expectation]) => {
        assert.equal(deriver('foobar'), expectation)
      })
    })

    it('should snake_case a camelCase name', () => {
      [
        [requestActionType, 'REQUEST_FOO_BAR'],
        [successActionType, 'RECEIVE_FOO_BAR_SUCCESS'],
        [failureActionType, 'RECEIVE_FOO_BAR_FAILURE'],
        [clearActionType, 'CLEAR_FOO_BAR']
      ].forEach(([deriver, expectation]) => {
        assert.equal(deriver('fooBar'), expectation)
      })
    })
  })

  describe('makeFetchFunc', () => {
    let endpoint

    beforeEach(() => {
      endpoint = {
        getUrl: '/get',
        postUrl: '/post',
        patchUrl: '/patch',
        deleteUrl: '/delete',
        otherUrl: '/other'
      }
      fetchMock.mock('/get', {})
      fetchMock.mock('/post', {})
      fetchMock.mock('/patch', {})
      fetchMock.mock('/delete', {})
      fetchMock.mock('/other', {})
      sandbox = sinon.createSandbox()
    })

    afterEach(() => {
      sandbox.restore()
      fetchMock.restore()
    })

    it('should default to window.fetch', () => {
      const fetchWrapper = makeFetchFunc(endpoint, GET)
      fetchWrapper()
      assert(fetchMock.called())
    })

    it('should use endpoint.fetchFunc, if provided', () => {
      endpoint.fetchFunc = sandbox.stub()
      const fetchWrapper = makeFetchFunc(endpoint, GET)
      fetchWrapper()
      assert(endpoint.fetchFunc.called)
    });

    [GET, POST, PATCH, DELETE, 'other'].forEach(verb => {
      it(`should call the endpoint.${camelCase(verb)}Url function, if provided`, () => {
        const key = `${camelCase(verb)}Url`
        endpoint[key] = sandbox.stub().returns(`/${camelCase(verb)}`)
        makeFetchFunc(endpoint, verb)()
        assert(endpoint[key].called)
      })
    })
  })

  describe('action derivation', () => {
    let endpoint

    beforeEach(() => {
      sandbox = sinon.createSandbox()
      store = configureTestStore(R.identity)
      dispatchThen = store.createDispatchThen(state => state)

      endpoint = {
        name: 'foobar',
        getFunc: sandbox.stub(),
        postFunc: sandbox.stub(),
        otherFunc: sandbox.stub(),
        verbs: [GET, POST, 'other']
      }
    })

    afterEach(() => {
      sandbox.restore()
    })

    const checkActionTypes = (derived, verb) => {
      assert.equal(derived.requestType, `REQUEST_${R.toUpper(verb)}_FOOBAR`)
      assert.equal(derived.successType, `RECEIVE_${R.toUpper(verb)}_FOOBAR_SUCCESS`)
      assert.equal(derived.failureType, `RECEIVE_${R.toUpper(verb)}_FOOBAR_FAILURE`)
    }

    describe('deriveAction', () => {
      it('should return a function', () => {
        const derived = deriveAction(endpoint, GET)
        assert.isFunction(derived.action)
      })

      it('should define appropriate action types', () => {
        checkForVerbs(endpoint, verb => {
          const derived = deriveAction(endpoint, verb)
          checkActionTypes(derived, verb)
        })
      })

      it('should dispatch actions when the request succeeds', () => {
        const derived = deriveAction(endpoint, GET)
        endpoint.getFunc.returns(Promise.resolve())

        return dispatchThen(derived.action(), [
          derived.requestType,
          derived.successType
        ]).then(() => {
          assert(endpoint.getFunc.called)
        })
      })

      it('should dispatch actions when the request fails', () => {
        const derived = deriveAction(endpoint, GET)
        endpoint.getFunc.returns(Error())

        return dispatchThen(derived.action(), [
          derived.requestType,
          derived.failureType
        ]).catch(() => {
          assert(endpoint.getFunc.called)
        })
      });

      [
        ['args'],
        ['args', 'aaargs'],
        ['args', 'aaargs', 'aaaargs']
      ].forEach(args => {
        it(`should pass any arguments to the fetch function (${args.length} args)`, () => {
          const derived = deriveAction(endpoint, GET)
          endpoint.getFunc.returns(Promise.resolve())
          return dispatchThen(derived.action(args), [
            derived.requestType,
            derived.successType
          ]).then(() => {
            assert.deepEqual(endpoint.getFunc.args[0][0], args)
          })
        })
      })

      it('should allow for username-based namespacing, when the flag is set', () => {
        endpoint.namespaceOnUsername = true
        endpoint.getFunc.returns(Promise.resolve(['data']))

        const withUsernameReturnStub = sandbox.stub()
        withUsernameReturnStub.returns({ type: 'TESTING_WITH_USERNAME' })
        const withUsernameStub = sandbox.stub(actionUtils, 'withUsername')
        withUsernameStub.returns(withUsernameReturnStub)

        const derived = deriveAction(endpoint, GET)
        return dispatchThen(derived.action('username'), [
          'TESTING_WITH_USERNAME',
          'TESTING_WITH_USERNAME'
        ]).then(() => {
          assert.deepEqual(withUsernameReturnStub.args, [
            ['username'],
            ['username', ['data']]
          ])
        })
      })
    })

    describe('deriveActions', () => {
      it('should derive an action for each HTTP verb', () => {
        const actions = deriveActions(endpoint)
        checkForVerbs(endpoint, verb => {
          assert.isFunction(actions[camelCase(verb)])
        })
      })

      it('should have action types defined', () => {
        const actions = deriveActions(endpoint)
        checkForVerbs(endpoint, verb => {
          checkActionTypes(actions[camelCase(verb)], verb)
        })
      })

      it('should include an action type to clear the store', () => {
        const actions = deriveActions(endpoint)
        assert.equal(actions.clearType, `CLEAR_${R.toUpper(endpoint.name)}`)
        assert.isFunction(actions.clear)
      })
    })
  })

  describe('reducer derivation', () => {
    let endpoint, actions

    beforeEach(() => {
      endpoint = {
        name: 'foobar',
        verbs: [GET, POST, 'other']
      }

      actions = deriveActions(endpoint)
    })

    const checkForActionTypes = (action, cb) => {
      [
        action.requestType,
        action.successType,
        action.failureType
      ].forEach(cb)
    }

    describe('deriveReducer', () => {
      it('should define a function for each action type on the corresponding action', () => {
        checkForVerbs(endpoint, verb => {
          const action = actions[camelCase(verb)]
          const reducer = deriveReducer(endpoint, action, verb)

          checkForActionTypes(action, type => {
            assert.isFunction(reducer[type])
          })
        })
      })

      it('should represent a request in flight', () => {
        checkForVerbs(endpoint, verb => {
          const action = actions[camelCase(verb)]
          const reducer = deriveReducer(endpoint, action, verb)
          const result = reducer[action.requestType]({}, { type: 'ACTION', payload: 'ignored' })
          assert.deepEqual(result, {
            [`${camelCase(verb)}Status`]: FETCH_PROCESSING,
            loaded: false,
            processing: true
          })
        })
      })

      it('should represent success', () => {
        checkForVerbs(endpoint, verb => {
          const action = actions[camelCase(verb)]
          const reducer = deriveReducer(endpoint, action, verb)
          const result = reducer[action.successType](
            {}, { type: 'ACTION', payload: { some: 'DATA' } }
          )
          assert.deepEqual(result, {
            [`${camelCase(verb)}Status`]: FETCH_SUCCESS,
            loaded: true,
            processing: false,
            data: { some: 'DATA' }
          })
        })
      })

      it('should represent failure', () => {
        checkForVerbs(endpoint, verb => {
          const action = actions[camelCase(verb)]
          const reducer = deriveReducer(endpoint, action, verb)
          const result = reducer[action.failureType](
            {}, { type: 'ACTION', payload: { some: 'ERROR' } }
          )
          assert.deepEqual(result, {
            [`${camelCase(verb)}Status`]: FETCH_FAILURE,
            loaded: true,
            processing: false,
            error: { some: 'ERROR' }
          })
        })
      })
    })

    describe('deriveReducers', () => {
      it('should clear itself', () => {
        const reducer = deriveReducers(endpoint, actions)
        const result = reducer({}, { type: actions.clearType })
        assert.deepEqual(result, INITIAL_STATE)
      })

      it('should use an INITIAL_STATE prop on the Endpoint, if present', () => {
        endpoint.initialState = {
          extraProp: 'HI',
          wow: 'yeah...'
        }

        const reducer = deriveReducers(endpoint, actions)
        const result = reducer({}, { type: actions.clearType })
        assert.deepEqual(result, endpoint.initialState)
      })

      it('should return a function', () => {
        const reducer = deriveReducers(endpoint, actions)
        assert.isFunction(reducer)
      })

      it('should return a different state for all defined action types', () => {
        const reducer = deriveReducers(endpoint, actions)

        checkForVerbs(endpoint, verb => {
          const action = actions[camelCase(verb)]
          checkForActionTypes(action, type => {
            const result = reducer({}, { type: type, payload: 'SOME_DATA' })
            assert.notDeepEqual(result, {})
          })
        })
      })

      it('should include any extraActions', () => {
        endpoint.extraActions = {
          MY_NEW_ACTION_TYPE: () => ({ not: 'legit' })
        }

        const reducer = deriveReducers(endpoint, actions)
        const result = reducer({}, { type: 'MY_NEW_ACTION_TYPE' })
        assert.deepEqual(result, { not: 'legit' })
      })

      it('should no-op if reducer for an action type is not present', () => {
        const reducer = deriveReducers(endpoint, actions)

        const initialState = { initial: 'State' }
        const result = reducer(initialState, { type: '❤❤❤❤❤', payload: '<3<3<3<3<3' })
        assert.equal(result, initialState)
      })

      it('should namespace on username, if flag is set', () => {
        endpoint.namespaceOnUsername = true
        const actions = deriveActions(endpoint)
        const reducer = deriveReducers(endpoint, actions)

        const result = reducer({}, { meta: 'username', payload: 'foobar', type: actions.get.successType })
        assert.deepEqual(result, {
          username: {
            getStatus: 'FETCH_SUCCESS',
            data: 'foobar',
            loaded: true,
            processing: false
          }
        })
      })
    })

    describe('deriveVerbFuncs', () => {
      const verbFuncs = {
        one: () => 1,
        two: () => 2
      }

      it('should populate verbs', () => {
        const derived = deriveVerbFuncs(verbFuncs)

        assert.deepEqual(derived.verbs, ['one', 'two'])
      })

      it('should rename verb funcs', () => {
        const derived = deriveVerbFuncs(verbFuncs)

        assert.equal(derived.oneFunc(), 1)
        assert.equal(derived.twoFunc(), 2)
      })
    })
  })
})
