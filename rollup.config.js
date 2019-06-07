import commonjs from 'rollup-plugin-commonjs';
import nodeResolve from 'rollup-plugin-node-resolve';
import { terser } from "rollup-plugin-terser";

export default {
    input: './dist/base.js',
    output: {
        file: './dist/base.bundle.js',
        format: 'iife',
        name: 'lithtml'
    },
    plugins: [
        nodeResolve({
            mainFields: ['jsnext', 'jsnext:main', 'main']
        }),
        commonjs({
            extensions: ['.js', '.json']
        }),
        terser()
    ]
};
