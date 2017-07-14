# Redux-Hammock

[![Build
Status](https://travis-ci.org/mitodl/redux-hammock.svg?branch=master)](https://travis-ci.org/mitodl/redux-hammock)

Hammock is a library which allows you to abstract away some details and
boilerplate when using redux and fetch with REST endpoints. You just write
a little configuration object and hammock generates actions and a reducer
for you!

## Motivation

`hammock` is designed to abstract away the boilerplate involved in using
`fetch` and `redux-thunk` to manage communication with a REST API from
a JS frontend application. Consider the following (trivial) example of
a `user` API:

```js
const fetchUserInfo = id => fetch(`/api/v0/user/${id}`)

const REQUEST_GET_USER = 'REQUEST_GET_USER'
const requestGetUser = () => ({ type: REQUEST_GET_USER })

const RECEIVE_GET_USER_SUCCESS = 'RECEIVE_GET_USER_SUCCESS'
const receiveGetUserSuccess = response => (
  { type: RECEIVE_GET_USER_SUCCESS, payload: response }
)

const RECEIVE_GET_USER_FAILURE = 'RECEIVE_GET_USER_FAILURE'
const receiveGetUserFailure = response => (
  { type: RECEIVE_GET_USER_FAILURE, payload: response }
)

const getUser = id => {
  return dispatch => {
    dispatch(requestGetUser())
    return fetchUserInfo(id).then(
      response => dispatch(receiveGetUserSuccess(response)),
      response => dispatch(receiveGetUserFailure(response))
    )
  }
}

const INITIAL_USER_STATE = {
  userInfo: {},
  fetchStatus: undefined,
}

const userReducer = (state = INITIAL_USER_STATE, action) => {
  switch (action.type) {
    case REQUEST_GET_USER:
      return Object.assign({}, state, { fetchStatus: 'PROCESSING' })
    case RECEIVE_GET_USER_SUCCESS:
      return Object.assign({}, state, { fetchStatus: 'SUCCESS', userInfo: action.payload })
    case RECEIVE_GET_USER_FAILURE:
      return Object.assign({}, state, { fetchStatus: 'FAILURE' })
    default:
      return state
  }
}
```

Simple enough, right? We have some actions for indicating the request is
in-flight, one for success, one for failure. When we want to make
a request, we call `dispatch(getUser(id))`, and if the request goes
through (i.e. if the `fetch` call resolves) we'll get our user information
in our store, so we can display in a React view layer or similar.

This works, and is actually fine, but consider the case where we have four
different APIs we need to communicate with, or ten, or fifteen. We'll have
almost this exact same set of functions, with associated nearly identical
tests, for each API. Yuck! That's a lot of boilerplate. We can cut down
a little bit on this using utilities like
[redux-actions](https://github.com/acdlite/redux-actions), but we've still
got to write down all that code for each reducer.

If we look a little closer, we can see that the only parts of this whole
setup which are particular to this API are the URL and the name. So
wouldn't it be nice if, instead, we could write something like:

```js
const userEndpoint = {
  name: 'user',
  verbs: [ 'GET' ],
  getUrl: id => `/api/v0/user/${id}`
}
```

Coincidentally this is exactly what `hammock` lets you do! Great!

## Installation

To install hammock you can just do:

```
npm install --save redux-hammock
```

`hammock` assumes that you already have your reducer set up to use the
redux-thunk middleware, as described
[here](https://github.com/gaearon/redux-thunk#installation). 

## Usage and API

As hinted above, to use `hammock` you declare an object (of type
`Endpoint`) which is used to automatically generate action types, action
creators, a reducer, and a `redux-thunk` async action creator which wraps
a call to `fetch` (along the lines of the example above).

### Endpoint declaration

There a few properties that are a required, and a few optional ones which
can be used if more customization is required.

#### name

`String`: the name for the API, used to name the reducer and also any derived
actions.

#### verbs

`[String]`: the HTTP verbs the endpoint supports. Currently `GET`, `PATCH`, and
`POST` are supported.

#### ${verb}Url

`String|Function`: This is either a string, or a function which returns
a string, which is used to get the URL to `fetch` for a particular HTTP `verb`
(e.g. `{ getUrl: '/api/v0/example' }`). If a function is provided, the
arguments passed to the async action creator are passed through, making it easy
to use with a REST API to `GET` or `PATCH` a particular record.

Example:

```js
const getEndpoint = {
  name: 'user',
  verbs: [ 'GET' ],
  getUrl: id => `/api/v0/user/${id}`
}
```

#### ${verb}Func (optional)

`Function`: This is a function which is used to issue a `verb` request. If
this option is passed, the `${verb}Url` parameter is no longer necessary.
This may be useful if you need to do some specialized error handling for
a particular endpoint, or if special editing needs to happen immediately
before the request is issued.

#### fetchFunc (optional)

`Function`: If a nonstandard `fetch` implementation or wrapper is necessary
(for instance to deal with CSRF tokens or similar) a `fetchFunc` can be passed,
which will be used instead of `window.fetch`.

#### initialState (optional)

`Object`: by default `hammock` will generate a sensible default empty
state for you. This property can be used if you want custom control, for
instance you need a property other than those defined on the `RestType`
type, or you need to use a custom starting placeholder value (like an
empty string instead of `undefined`).

### Generating actions and reducers

`hammock` exports two functions (`deriveReducers` and `deriveActions`)
which both take an `Endpoint` and return and reducer and an object holding
action creators, respectively. The reducer can be treated like a normal
Redux reducer, combined with others using `combineReducers`, etc. The
actions object will have a property for each supported HTTP verb defined
on it. For our `user` example above, this would look like:

```js
// fetch a user object
dispatch(userActions.get(userId))
```

The async action creator function also has the relevant action types
defined on it as properties, at `actions.${verb}.requestType`,
`successType`, and `failureType`, as a convenience for testing and
debugging. Again, for our `user` example this would look like:

```js
userActions.get.requestType // REQUEST_GET_USER
userActions.get.successType // RECEIVE_GET_USER_SUCCESS
userActions.get.failureType // RECEIVE_GET_USER_FAILURE
```

It's up to you how to organize the created actions. On strategy is to
stick them all on one object, under the same keys as the stores, so that
you just import an `actions` object in your redux container files and do
something like `actions.user.get(userId)`. Another option would be to
declare the actions alongside the reducers, in separate files. It's up to
you!
