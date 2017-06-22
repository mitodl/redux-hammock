// @flow
/* global fetch */
import 'isomorphic-fetch'
import R from 'ramda'

import { S, parseJSON, filterE } from './util'

const firstOrNull = R.compose(
  R.defaultTo(null),
  R.head
)

export const getCookie: (n: string) => string|null = R.compose(
  firstOrNull,
  name => (
    (document.cookie || '')
    .split(';')
    .map(cookie => cookie.trim())
    .filter(cookie => cookie.substring(0, name.length + 1) === `${name}=`)
    .map(cookie => decodeURIComponent(cookie.substring(name.length + 1)))
  )
)

// returns true for HTTP methods that do not require CSRF protection
export const csrfSafeMethod = (method: string): boolean => (
  /^(GET|HEAD|OPTIONS|TRACE)$/.test(method)
)

const headers = R.merge({ headers: {} })

const method = R.merge({ method: 'GET' })

const credentials = R.merge({ credentials: 'same-origin' })

const setWith = R.curry((path, valFunc, obj) => (
  R.set(path, valFunc(), obj)
))

const csrfToken = R.unless(
  R.compose(csrfSafeMethod, R.prop('method')),
  setWith(
    R.lensPath(['headers', 'X-CSRFToken']),
    () => getCookie('csrftoken')
  )
)

const jsonHeaders = R.merge({ headers: {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}})

const formatRequest = R.compose(
  csrfToken, credentials, method, headers
)

const formatJSONRequest = R.compose(formatRequest, jsonHeaders)

export const fetchWithCSRF = async (path: string, init: Object = {}): Promise<*> => {
  let response = await fetch(path, formatRequest(init))
  let text = await response.text()

  if (response.status < 200 || response.status >= 300) {
    return Promise.reject([text, response.status]) // eslint-disable-line
  }
  return text
}

// resolveEither :: Either -> Promise
// if the Either is a Left, returns Promise.reject(val)
// if the Either is a Right, returns Promise.resolve(val)
// where val is the unwrapped value in the Either
const resolveEither = S.either(
  val => Promise.reject(val),
  val => Promise.resolve(val)
)

const handleEmptyJSON = json => (
  json.length === 0 ? JSON.stringify({}) : json
)

/**
 * Calls to fetch but does a few other things:
 *  - turn cookies on for this domain
 *  - set headers to handle JSON properly
 *  - handle CSRF
 *  - non 2xx status codes will reject the promise returned
 *  - response JSON is returned in place of response
 */
export const fetchJSONWithCSRF = async (input: string, init: Object = {}): Promise<*> => {
  let response = await fetch(input, formatJSONRequest(init))
  let text = await response.text()

  // Here we use the `parseJSON` function, which returns an Either.
  // Left records an error parsing the JSON, and Right success. `filterE` will turn a Right
  // into a Left based on a boolean function (similar to filtering a Maybe), and we use `bimap`
  // to merge an error code into a Left. The `resolveEither` function above will resolve a Right
  // and reject a Left.
  return R.compose(
    resolveEither,
    S.bimap(
      R.merge({ errorStatusCode: response.status }),
      R.identity
    ),
    filterE(() => response.ok),
    parseJSON,
    handleEmptyJSON
  )(text)
}
