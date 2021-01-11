import chai, { assert } from 'chai'
import fetchMock from 'fetch-mock'
import sinon from 'sinon'
import chaiAsPromised from 'chai-as-promised'
import jsdomGlobal from 'jsdom-global'

import {
  getCookie,
  fetchJSONWithCSRF,
  fetchWithCSRF,
  csrfSafeMethod
} from './django_csrf_fetch'

chai.use(chaiAsPromised)

describe('django csrf fetch tests', function () {
  this.timeout(5000) // eslint-disable-line no-invalid-this

  let sandbox, cleanup

  beforeEach(() => {
    sandbox = sinon.createSandbox()
    cleanup = jsdomGlobal()
  })

  afterEach(() => {
    sandbox.restore()
    cleanup()
  })

  describe('fetch functions', () => {
    const CSRF_TOKEN = 'asdf'

    afterEach(() => {
      fetchMock.restore()
    })

    describe('fetchWithCSRF', () => {
      beforeEach(() => {
        document.cookie = `csrftoken=${CSRF_TOKEN}`
      })

      it('fetches and populates appropriate headers for GET', () => {
        const body = 'body'

        fetchMock.mock('/url', (url, opts) => {
          assert.deepEqual(opts, {
            credentials: 'same-origin',
            headers: {},
            body: body,
            method: 'GET'
          })

          return {
            status: 200,
            body: 'Some text'
          }
        })

        return fetchWithCSRF('/url', {
          body: body
        }).then(responseBody => {
          assert.equal(responseBody, 'Some text')
        })
      })

      for (const method of ['PATCH', 'PUT', 'POST']) {
        it(`fetches and populates appropriate headers for ${method}`, () => {
          const body = 'body'

          fetchMock.mock('/url', (url, opts) => {
            assert.deepEqual(opts, {
              credentials: 'same-origin',
              headers: {
                'X-CSRFToken': CSRF_TOKEN
              },
              body: body,
              method: method
            })

            return {
              status: 200,
              body: 'Some text'
            }
          })

          return fetchWithCSRF('/url', {
            body,
            method
          }).then(responseBody => {
            assert.equal(responseBody, 'Some text')
          })
        })
      }

      for (const statusCode of [300, 400, 500]) {
        it(`rejects the promise if the status code is ${statusCode}`, () => {
          fetchMock.get('/url', statusCode)
          return assert.isRejected(fetchWithCSRF('/url'))
        })
      }
    })

    describe('fetchJSONWithCSRF', () => {
      it('fetches and populates appropriate headers for JSON', () => {
        document.cookie = `csrftoken=${CSRF_TOKEN}`
        const expectedJSON = { data: true }

        fetchMock.mock('/url', (url, opts) => {
          assert.deepEqual(opts, {
            credentials: 'same-origin',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              'X-CSRFToken': CSRF_TOKEN
            },
            body: JSON.stringify(expectedJSON),
            method: 'PATCH'
          })
          return {
            status: 200,
            body: '{"json": "here"}'
          }
        })

        return fetchJSONWithCSRF('/url', {
          method: 'PATCH',
          body: JSON.stringify(expectedJSON)
        }).then(responseBody => {
          assert.deepEqual(responseBody, {
            json: 'here'
          })
        })
      })

      it('handles responses with no data', () => {
        document.cookie = `csrftoken=${CSRF_TOKEN}`
        const expectedJSON = { data: true }

        fetchMock.mock('/url', (url, opts) => {
          assert.deepEqual(opts, {
            credentials: 'same-origin',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              'X-CSRFToken': CSRF_TOKEN
            },
            body: JSON.stringify(expectedJSON),
            method: 'PATCH'
          })
          return {
            status: 200,
            body: '{}'
          }
        })

        return fetchJSONWithCSRF('/url', {
          method: 'PATCH',
          body: JSON.stringify(expectedJSON)
        }).then(responseBody => {
          assert.deepEqual(responseBody, {})
        })
      })

      for (const statusCode of [300, 400, 500]) {
        it(`rejects the promise if the status code is ${statusCode}`, () => {
          fetchMock.mock('/url', {
            status: statusCode,
            body: JSON.stringify({
              error: 'an error'
            })
          })

          return assert.isRejected(fetchJSONWithCSRF('/url')).then(responseBody => {
            assert.deepEqual(responseBody, {
              error: 'an error',
              errorStatusCode: statusCode
            })
          })
        })
      }

      it('handles invalid JSON', () => {
        fetchMock.mock('/url', {
          status: 500,
          body: ''
        })

        return assert.isRejected(fetchJSONWithCSRF('/url')).then(responseBody => {
          assert.equal(responseBody.errorStatusCode, 500)
          assert.equal(responseBody.error.type, 'invalid-json')
          assert.include(responseBody.error.message, 'invalid json response body at /url reason: Unexpected end of JSON input')
        })
      })
    })
  })

  describe('getCookie', () => {
    it('gets a cookie', () => {
      document.cookie = 'key=cookie'
      assert.equal('cookie', getCookie('key'))
    })

    it('handles multiple cookies correctly', () => {
      document.cookie = 'key1=cookie1'
      document.cookie = 'key2=cookie2'
      assert.equal('cookie1', getCookie('key1'))
      assert.equal('cookie2', getCookie('key2'))
    })

    it('returns null if cookie not found', () => {
      document.cookie = 'key1=cookie1'
      assert.isNull(getCookie('unknown'))
    })

    it('returns null if document.cookie is null or undefined', () => {
      document.cookie = null
      assert.isNull(getCookie('unknown'))
    })

    it('returns null if document.cookie is an empty string', () => {
      document.cookie = ''
      assert.isNull(getCookie('beepboop'))
    })
  })

  describe('csrfSafeMethod', () => {
    it('knows safe methods', () => {
      ['GET', 'HEAD', 'OPTIONS', 'TRACE'].forEach(verb => {
        assert.ok(csrfSafeMethod(verb))
      })
    })

    it('knows unsafe methods', () => {
      ['PATCH', 'PUT', 'DELETE', 'POST'].forEach(verb => {
        assert.ok(!csrfSafeMethod(verb))
      })
    })
  })
})
