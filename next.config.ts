import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Enable standalone output for Docker
  output: 'standalone',
  
  // Disable source maps to fix the invalid source map error
  productionBrowserSourceMaps: false,
  
  // Turbopack configuration (stable)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  
  // Webpack configuration to handle source maps
  webpack: (config, { dev, isServer }) => {
    // Completely disable source maps
    config.devtool = false
    return config
  },
};

export default nextConfig;
