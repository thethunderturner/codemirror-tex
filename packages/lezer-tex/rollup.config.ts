// rollup.config.js
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { RollupOptions } from 'rollup';
import { terser } from 'rollup-plugin-terser';
import { codepointTransformer } from './tools/transformers';

const external = [
  '@codemirror/state',
  '@codemirror/view',
  '@codemirror/language',
  '@codemirror/commands',
  '@codemirror/search',
  '@codemirror/lint',
  '@codemirror/autocomplete',
  '@lezer/highlight',
  '@lezer/lr',
  'codemirror'
];

export default {
  input: 'src/index.ts',
  external,
  plugins: [
    nodeResolve(),
    typescript({
      lib: ['esnext'],
      target: 'es6',
      tsconfig: 'tsconfig.build.json',
      transformers: {
        before: [codepointTransformer],
      },
    }),
    terser(),
  ],
} as RollupOptions;
