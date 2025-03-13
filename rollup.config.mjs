import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import alias from '@rollup/plugin-alias';
import resolvePlugin from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import postcss from 'rollup-plugin-postcss';
import terser from '@rollup/plugin-terser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
  input: 'src/main.js',
  output: {
    file: 'dist/bundle.js',
    format: 'esm',
    sourcemap: true,
  },
  plugins: [
    // Process CSS so it's not interpreted as JavaScript
    postcss({
      extract: false,
      modules: false,
      inject: true,
      sourceMap: true,
    }),
    // Use alias to remap both "@rhds/elements" and "@rhds/elements/" to the correct absolute path
    alias({
      entries: [
        { find: '@rhds/elements', replacement: resolve(__dirname, 'node_modules/@rhds/elements') },
        { find: '@rhds/elements/', replacement: resolve(__dirname, 'node_modules/@rhds/elements') + '/' }
      ],
      customResolver: resolvePlugin({
        browser: true,
        extensions: ['.js', '.mjs', '.json']
      })
    }),
    // Resolve modules from node_modules with browser field enabled
    resolvePlugin({
      browser: true,
      extensions: ['.js', '.mjs', '.json']
    }),
    commonjs(),
    terser()
  ],
  external: []
};