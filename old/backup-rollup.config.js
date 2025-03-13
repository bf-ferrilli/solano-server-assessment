// rollup.config.js
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import alias from '@rollup/plugin-alias';
// import { terser } from 'rollup-plugin-terser'; // optional minification

export default {
  input: 'src/main.js',
  output: {
    file: 'dist/bundle.js',
    format: 'esm', // output as ES module
    sourcemap: true,
    inlineDynamicImports: true
  },
  plugins: [
    // This alias maps bare specifiers for icons to a relative path
    alias({
      entries: [
        { find: '@rhds/icons/standard/', replacement: './node_modules/@rhds/icons/standard/' }
      ]
    }),
    resolve(),   // resolves bare imports from node_modules
    commonjs()
    // terser()   // optional: enable if you wish to minify the bundle
  ]
};