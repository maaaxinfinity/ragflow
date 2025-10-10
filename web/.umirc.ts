import path from 'path';
import TerserPlugin from 'terser-webpack-plugin';
import { defineConfig } from 'umi';
import { appName } from './src/conf.json';
import routes from './src/routes';
const ESLintPlugin = require('eslint-webpack-plugin');

export default defineConfig({
  title: appName,
  outputPath: 'dist',
  alias: { '@parent': path.resolve(__dirname, '../') },
  npmClient: 'npm',
  base: '/',
  routes,
  publicPath: '/',
  esbuildMinifyIIFE: true,
  icons: {},
  hash: true,
  favicons: ['/logo.svg'],
  headScripts: [{ src: '/iconfont.js', defer: true }],
  clickToComponent: {},
  history: {
    type: 'browser',
  },
  plugins: [
    '@react-dev-inspector/umi4-plugin',
    '@umijs/plugins/dist/tailwindcss',
  ],
  jsMinifier: 'none', // Fixed the issue that the page displayed an error after packaging lexical with terser
  lessLoader: {
    modifyVars: {
      hack: `true; @import "~@/less/index.less";`,
    },
  },
  devtool: 'source-map',
  copy: [
    { from: 'src/conf.json', to: 'dist/conf.json' },
    { from: 'node_modules/monaco-editor/min/vs/', to: 'dist/vs/' },
  ],
  // 代理配置：本地开发时使用，生产环境通过外部 Nginx 直接访问 rag.limitee.cn
  proxy:
    process.env.NODE_ENV === 'development' && !process.env.PRODUCTION_PROXY
      ? [
          {
            context: ['/api', '/v1'],
            target: process.env.BACKEND_URL || 'http://127.0.0.1:9380/',
            changeOrigin: true,
            ws: true,
            logger: console,
          },
        ]
      : undefined,

  chainWebpack(memo, args) {
    memo.module.rule('markdown').test(/\.md$/).type('asset/source');

    memo.optimization.minimizer('terser').use(TerserPlugin); // Fixed the issue that the page displayed an error after packaging lexical with terser

    // memo.plugin('eslint').use(ESLintPlugin, [
    //   {
    //     extensions: ['js', 'ts', 'tsx'],
    //     failOnError: true,
    //     exclude: ['**/node_modules/**', '**/mfsu**', '**/mfsu-virtual-entry**'],
    //     files: ['src/**/*.{js,ts,tsx}'],
    //   },
    // ]);

    return memo;
  },
  tailwindcss: {},
});
