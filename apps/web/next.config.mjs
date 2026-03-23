import withBundleAnalyzer from '@next/bundle-analyzer';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

const createNextConfig = (phase) => ({
  reactStrictMode: true,
  output: 'standalone',
  // Keep dev/build artifacts separate so `next build` does not corrupt an active `next dev`.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'thirdwx.qlogo.cn',
      },
      {
        protocol: 'https',
        hostname: 'wx.qlogo.cn',
      },
      {
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_CDN_HOST || 'localhost',
      },
    ],
  },
});

export default (phase) =>
  withBundleAnalyzer({
    enabled: process.env.ANALYZE === 'true',
  })(createNextConfig(phase));
