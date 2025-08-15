import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
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
  
  // Webpack configuration to handle source maps and WebSocket dependencies
  webpack: (config, { dev, isServer }) => {
    // Completely disable source maps
    config.devtool = false
    
    // Handle WebSocket dependency for serverless functions
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push({
        'ws': 'ws',
        'bufferutil': 'bufferutil',
        'utf-8-validate': 'utf-8-validate',
      })
    }
    
    return config
  },
  
  // Experimental features for better serverless compatibility
  experimental: {
    serverComponentsExternalPackages: ['ws'],
  },
};

export default nextConfig;
