// @flow
/* global fetch */
import { createAction } from 'redux-actions'
import R from 'ramda'
import snakeCase from 'lodash.snakecase'
import 'isomorphic-fetch'

import type { Action, ActionType, Dispatcher } from './reduxTypes'
import type { Endpoint } from './restTypes'
import {
  FETCH_PROCESSING,
  FETCH_SUCCESS,
  FETCH_FAILURE,
  GET,
  PATCH,
  POST,
  DELETE,
  INITIAL_STATE
} from './constants'
import { withUsername, updateStateByUsername } from './util'

const actionize = R.compose(R.toUpper, R.join('_'), R.map(snakeCase))

export const requestActionType = (...xs: string[]) => `REQUEST_${actionize(xs)}`

export const successActionType = (...xs: string[]) => `RECEIVE_${actionize(xs)}_SUCCESS`

export const failureActionType = (...xs: string[]) => `RECEIVE_${actionize(xs)}_FAILURE`

export const clearActionType = (...xs: string[]) => `CLEAR_${actionize(xs)}`

const defaultRESTPrefixes = { GET, PATCH, POST, DELETE }

const getPrefixForEndpoint = (verb, endpoint) => (
  R.propOr(defaultRESTPrefixes[verb], `${R.toLower(verb)}Prefix`, endpoint)
)

const getUrl = (endpoint: Endpoint, verb: string) => (
  endpoint[`${R.toLower(verb)}Url`]
)

const simpleOptions = () => ({})

const getMakeOptions = (endpoint: Endpoint, verb: string) => (
  endpoint[`${R.toLower(verb)}Options`] || simpleOptions
)

export function makeFetchFunc (endpoint: Endpoint, verb: string): (...args: any) => Promise<*> {
  let url = getUrl(endpoint, verb)
  let options = getMakeOptions(endpoint, verb)
  let fetchImplementation = endpoint.fetchFunc || fetch
  return (...args) => {
    return fetchImplementation(
      typeof url === 'function'
      ? url(...args)
      : url,
      options(...args)
    )
  }
}

type DerivedAction = {
  action: (...params: any) => Dispatcher<*>,
  requestType: ActionType,
  successType: ActionType,
  failureType: ActionType,
}

// we can derive an action from an Endpoint object and an HTTP verb
// this returns an object containing the derived REST action (which
// is an async action suitable for use with redux-thunk), and all the
// derived action types.
export const deriveAction = (endpoint: Endpoint, verb: string): DerivedAction => {
  const prefix = getPrefixForEndpoint(verb, endpoint)

  const requestType = requestActionType(prefix, endpoint.name)
  const successType = successActionType(prefix, endpoint.name)
  const failureType = failureActionType(prefix, endpoint.name)

  const createActionFunc = endpoint.namespaceOnUsername
    ? withUsername
    : createAction

  const requestAction = createActionFunc(requestType)
  const successAction = createActionFunc(successType)
  const failureAction = createActionFunc(failureType)

  const fetchFunc = R.propOr(
    makeFetchFunc(endpoint, verb),
    `${R.toLower(verb)}Func`,
    endpoint
  )

  return {
    action: (...params) => {
      return (dispatch: Function): Promise<*> => {
        dispatch(requestAction(...params))
        return fetchFunc(...params).then(data => {
          if (endpoint.namespaceOnUsername) {
            // params[0] is the username, in this case
            dispatch(successAction(params[0], data))
          } else {
            dispatch(successAction(data))
          }
          return Promise.resolve(data)
        }, error => {
          if (endpoint.namespaceOnUsername) {
            dispatch(failureAction(params[0], error))
          } else {
            dispatch(failureAction(error))
          }
          return Promise.reject(error)
        })
      }
    },
    requestType,
    successType,
    failureType
  }
}

// here we loop through the HTTP verbs that an Endpoint implements, and
// for each one we derive an action. The derived action types are stuck on
// the function object, as a convenience.
export const deriveActions = (endpoint: Endpoint) => {
  let actions = {}
  endpoint.verbs.forEach(verb => {
    const {
      action,
      requestType,
      successType,
      failureType
    } = deriveAction(endpoint, verb)

    let lverb = R.toLower(verb)

    actions[lverb] = action
    actions[lverb].requestType = requestType
    actions[lverb].successType = successType
    actions[lverb].failureType = failureType
  })
  let clearType = clearActionType(endpoint.name)
  actions.clearType = clearType
  if (endpoint.namespaceOnUsername) {
    actions.clear = withUsername(clearType)
  } else {
    actions.clear = createAction(clearType)
  }
  return actions
}

// a reducer may be derived on the basis of an Endpoint object, an already
// derived REST action, and an HTTP verb
// A reducer, in this case, is an Object<type, Function>, where type is an
// action type defined on the previously derived action, and the Function has
// the type State -> Action -> State
//
// so the type of the function overall could be rendered
// deriveReducer :: Endpoint -> Action -> String -> Object String (State -> Action -> State)
export const deriveReducer = (endpoint: Endpoint, action: Function, verb: string) => {
  let fetchStatus = `${R.toLower(verb)}Status`

  let successHandler = R.propOr(R.identity, `${R.toLower(verb)}SuccessHandler`, endpoint)

  let updateFunc = (state, action, update) => {
    if (endpoint.namespaceOnUsername) {
      return updateStateByUsername(
        state,
        action.meta,
        { ...endpoint.usernameInitialState, ...update }
      )
    } else {
      return { ...state, ...update }
    }
  }

  return {
    [action.requestType]: (state: Object, action: Action<any, any>) => (
      updateFunc(state, action, {
        [fetchStatus]: FETCH_PROCESSING,
        loaded: false,
        processing: endpoint.checkNoSpinner ? action.payload : true
      })
    ),
    [action.successType]: (state: Object, action: Action<any, any>) => (
      updateFunc(state, action, {
        [fetchStatus]: FETCH_SUCCESS,
        data: successHandler(action.payload, state.data),
        loaded: true,
        processing: false
      })
    ),
    [action.failureType]: (state: Object, action: Action<any, any>) => (
      updateFunc(state, action, {
        [fetchStatus]: FETCH_FAILURE,
        error: action.payload,
        loaded: true,
        processing: false
      })
    )
  }
}

export const deriveReducers = (endpoint: Endpoint, actions: Function) => {
  let initialState = R.propOr(INITIAL_STATE, 'initialState', endpoint)

  const reducers = R.reduce(R.merge, {}, [
    ...endpoint.verbs.map(verb => deriveReducer(endpoint, actions[R.toLower(verb)], verb)),
    R.propOr({}, 'extraActions', endpoint),
    { [actions.clearType]: () => initialState }
  ])

  return (state: Object = initialState, action: Action<any, any>) => (
    R.has(action.type, reducers) ? reducers[action.type](state, action) : state
  )
}
