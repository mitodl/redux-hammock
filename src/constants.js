// @flow
import type { RestState } from './restTypes'

export const GET = 'GET'
export const PATCH = 'PATCH'
export const POST = 'POST'

export const FETCH_PROCESSING = 'FETCH_PROCESSING'
export const FETCH_SUCCESS = 'FETCH_SUCCESS'
export const FETCH_FAILURE = 'FETCH_FAILURE'

export const INITIAL_STATE: RestState<*> = {
  loaded: false,
  processing: false
}
