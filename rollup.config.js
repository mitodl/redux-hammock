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
    entry: 'src/hammock.js',
    format: 'cjs',
    dest: 'hammock.js',
    plugins: [
      babel(babelConfig)
    ],
    external: externals
  },
  {
    entry: 'src/django_csrf_fetch.js',
    format: 'cjs',
    dest: 'django_csrf_fetch.js',
    plugins: [
      babel(babelConfig)
    ],
    external: externals
  },
  {
    entry: 'src/constants.js',
    format: 'cjs',
    dest: 'constants.js',
    plugins: [
      babel(babelConfig)
    ],
    external: externals
  }
]
