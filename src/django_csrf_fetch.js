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
  const response = await fetch(input, formatJSONRequest(init))
  const text = await response.text()

  const jsonFriendlyText = handleEmptyJSON(text)
  const json = JSON.parse(jsonFriendlyText)
  if (!response.ok) {
    return Promise.reject({
      ...json,
      errorStatusCode: response.status,
    })
  }

  return json
}
