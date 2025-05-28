
import type { NextConfig } from 'next';
import path from 'path'; // Ensure path is imported for resolving node_modules

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer, webpack }) => {
    // For server-side builds, treat 'canvas' as an external module
    // This helps prevent "Module not found: Can't resolve 'canvas'" errors,
    // especially when using libraries like Konva that might have Node.js-specific paths.
    if (isServer) {
      if (!config.externals) {
        config.externals = [];
      }
      config.externals.push('canvas'); 
    }

    // Ensure that all modules resolve to the project's single instances of React and ReactDOM.
    // This is critical for preventing errors like "Cannot read properties of undefined (reading 'ReactCurrentOwner')"
    // which often arise from multiple React instances.
    if (!config.resolve) {
      config.resolve = {};
    }
    config.resolve.alias = {
      ...(config.resolve.alias || {}), // Preserve any existing aliases
      react: path.resolve('./node_modules/react'),
      'react-dom': path.resolve('./node_modules/react-dom'),
    };
    
    return config;
  },
};

export default nextConfig;
