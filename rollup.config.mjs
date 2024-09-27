import babel from 'rollup-plugin-babel'

const babelConfig = {
  presets: [
    'flow',
    ['env', { modules: false }]
  ],
  plugins: [
    'transform-object-rest-spread',
    'external-helpers',
    'transform-runtime'
  ],
  babelrc: false,
  exclude: 'node_modules/**',
  runtimeHelpers: true
}

const externals = [
  'isomorphic-fetch',
  'lodash.snakecase',
  'ramda',
  'redux-actions',
  'lodash.merge'
]

export default [
  {
    input: 'src/hammock.js',
    output: {
      file: 'hammock.js',
      format: 'cjs'
    },
    plugins: [
      babel(babelConfig)
    ],
    external: externals
  },
  {
    input: 'src/django_csrf_fetch.js',
    output: {
      file: 'django_csrf_fetch.js',
      format: 'cjs'
    },
    plugins: [
      babel(babelConfig)
    ],
    external: externals
  },
  {
    input: 'src/constants.js',
    output: {
      file: 'constants.js',
      format: 'cjs'
    },
    plugins: [
      babel(babelConfig)
    ],
    external: externals
  }
]
