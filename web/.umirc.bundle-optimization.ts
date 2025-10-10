/**
 * UmiJS Bundle 优化配置
 *
 * 优化目标:
 * - Bundle 体积减少 30%+
 * - 首屏加载时间 <2.5s
 * - 按需加载组件
 *
 * 使用方法:
 * 1. 将此文件内容合并到 .umirc.ts
 * 2. 或者在 .umirc.ts 中导入: import bundleOptimization from './.umirc.bundle-optimization';
 */

export default {
  // ==================== 代码分割 ====================

  // 1. 动态导入（路由懒加载）
  dynamicImport: {
    loading: '@/components/PageLoading', // 加载组件
  },

  // 2. Chunk 分割策略
  chunks: ['vendors', 'umi'],

  chainWebpack(config: any) {
    // 优化 splitChunks
    config.optimization.splitChunks({
      chunks: 'all',
      minSize: 30000, // 最小分割大小 30KB
      minChunks: 1, // 最小引用次数
      maxAsyncRequests: 6, // 最大异步请求数
      maxInitialRequests: 4, // 最大初始请求数
      automaticNameDelimiter: '~',

      cacheGroups: {
        // 1. 核心框架（React、UmiJS）
        framework: {
          test: /[\\/]node_modules[\\/](react|react-dom|@umijs)[\\/]/,
          name: 'framework',
          priority: 40,
          reuseExistingChunk: true,
        },

        // 2. UI 组件库（Ant Design、Radix UI）
        ui: {
          test: /[\\/]node_modules[\\/](antd|@ant-design|@radix-ui)[\\/]/,
          name: 'ui',
          priority: 30,
          reuseExistingChunk: true,
        },

        // 3. React Query + Zustand（状态管理）
        state: {
          test: /[\\/]node_modules[\\/](@tanstack|zustand)[\\/]/,
          name: 'state',
          priority: 25,
          reuseExistingChunk: true,
        },

        // 4. 工具库（lodash、ahooks 等）
        libs: {
          test: /[\\/]node_modules[\\/](lodash|ahooks|dayjs|uuid)[\\/]/,
          name: 'libs',
          priority: 20,
          reuseExistingChunk: true,
        },

        // 5. 图标库
        icons: {
          test: /[\\/]node_modules[\\/](lucide-react|@ant-design\/icons)[\\/]/,
          name: 'icons',
          priority: 15,
          reuseExistingChunk: true,
        },

        // 6. 其他第三方库
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
          reuseExistingChunk: true,
        },

        // 7. 公共代码
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
          name: 'common',
        },
      },
    });

    // ==================== 性能优化 ====================

    // 1. 生产环境优化
    if (process.env.NODE_ENV === 'production') {
      // 移除 console
      config.optimization.minimizer('terser').tap((args: any) => {
        args[0].terserOptions.compress.drop_console = true;
        args[0].terserOptions.compress.drop_debugger = true;
        return args;
      });

      // 提取 CSS
      config.plugin('extract-css').tap(() => [
        {
          filename: 'css/[name].[contenthash:8].css',
          chunkFilename: 'css/[name].[contenthash:8].chunk.css',
        },
      ]);
    }

    // 2. 模块解析优化
    config.resolve.alias.set('@', require('path').resolve(__dirname, 'src'));

    // 3. 缓存优化
    config.cache({
      type: 'filesystem',
      buildDependencies: {
        config: [__filename],
      },
    });

    return config;
  },

  // ==================== 构建优化 ====================

  // 1. esbuild 压缩（更快）
  esbuild: {},

  // 2. Tree Shaking
  jsMinifier: 'esbuild',
  cssMinifier: 'esbuild',

  // 3. 忽略 moment.js 本地化（减少 bundle 体积）
  ignoreMomentLocale: true,

  // 4. 预加载关键资源
  links: [{ rel: 'preconnect', href: 'https://fonts.googleapis.com' }],

  // 5. 压缩选项
  terserOptions: {
    compress: {
      drop_console: process.env.NODE_ENV === 'production',
      drop_debugger: true,
      pure_funcs: ['console.log'], // 移除特定函数
    },
  },

  // ==================== 资源优化 ====================

  // 1. 图片优化
  chainWebpack(config: any) {
    config.module
      .rule('images')
      .test(/\.(gif|png|jpe?g|svg)$/i)
      .use('image-webpack-loader')
      .loader('image-webpack-loader')
      .options({
        mozjpeg: {
          progressive: true,
          quality: 65,
        },
        optipng: {
          enabled: false,
        },
        pngquant: {
          quality: [0.65, 0.9],
          speed: 4,
        },
        gifsicle: {
          interlaced: false,
        },
      });

    return config;
  },

  // ==================== 分析工具 ====================

  // Bundle 分析（开发时启用）
  // analyze: {
  //   analyzerMode: 'server',
  //   analyzerPort: 8888,
  //   openAnalyzer: true,
  // },
};

/**
 * 路由懒加载示例
 *
 * 在 pages 中使用动态导入:
 *
 * ```typescript
 * import { lazy } from 'react';
 *
 * // 懒加载组件
 * const FreeChatPage = lazy(() => import('./pages/free-chat'));
 *
 * // 或在路由配置中
 * export default {
 *   routes: [
 *     {
 *       path: '/free-chat',
 *       component: '@/pages/free-chat',  // 自动懒加载
 *     },
 *   ],
 * };
 * ```
 */

/**
 * 组件懒加载示例
 *
 * ```typescript
 * import { lazy, Suspense } from 'react';
 *
 * const HeavyComponent = lazy(() => import('./components/HeavyComponent'));
 *
 * function MyPage() {
 *   return (
 *     <Suspense fallback={<Spin />}>
 *       <HeavyComponent />
 *     </Suspense>
 *   );
 * }
 * ```
 */

/**
 * 预期优化效果
 *
 * 优化前:
 * - main.js: ~2.5MB
 * - vendors.js: ~1.5MB
 * - 总体积: ~4MB
 * - 首屏加载: ~4s
 *
 * 优化后:
 * - framework.js: ~500KB (React + Umi)
 * - ui.js: ~800KB (Ant Design)
 * - state.js: ~200KB (React Query)
 * - main.js: ~300KB (业务代码)
 * - 其他按需加载
 * - 总初始体积: ~1.8MB (减少 55%)
 * - 首屏加载: <2.5s (提升 38%)
 */
