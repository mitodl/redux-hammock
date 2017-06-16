// @flow
import R from 'ramda'
import { createAction } from 'redux-actions'
import merge from 'lodash.merge'
import { create, env } from 'sanctuary'

import type { ActionType } from './reduxTypes'

export const S = create({ checkTypes: false, env: env })
// returns an action creator that takes (username, payload) as it's arguments
// the 'meta' field on the returned action holds the username
//
// type alias Type :: String
// type alias Username :: String
// type class Payload a
// type UsernameAction a = { type :: Type, meta :: Username, payload :: Payload a }
// withUsername :: Payload a => Type -> (Username -> a -> UsernameAction a)
export const withUsername = (type: ActionType, payloadFunc: Function = R.nthArg(1)) => (
  createAction(type, payloadFunc, R.identity)
)

export const updateStateByUsername = (state: Object, username: string, update: Object) => (
  merge({}, state, { [username]: update })
)

// parseJSON :: String -> Either Object Object
// A Right value indicates the JSON parsed successfully,
// a Left value indicates the JSON was malformed (a Left contains
// an empty object)
export const parseJSON = S.encaseEither(() => ({}), JSON.parse)

// filterE :: (Either -> Boolean) -> Either -> Either
// filterE takes a function f and an either E(v).
// if the Either is a Left, it returns it.
// if the f(v) === true, it returns, E. Else,
// if returns Left(v).
export const filterE = R.curry((predicate, either) => S.either(
  S.Left,
  right => predicate(right) ? S.Right(right) : S.Left(right),
  either
))
