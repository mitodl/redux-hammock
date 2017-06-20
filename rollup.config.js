import babel from 'rollup-plugin-babel'

const babelConfig = {
  presets: [
    'flow',
    ['env', { modules: false }]
  ],
  plugins: [
    'transform-object-rest-spread',
    'external-helpers'
  ],
  babelrc: false,
  exclude: 'node_modules/**'
}

export default [
  {
    entry: 'src/hammock.js',
    format: 'cjs',
    dest: 'dist/hammock.js',
    plugins: [
      babel(babelConfig)
    ]
  }
]
