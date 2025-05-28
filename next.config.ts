
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
      // Ensure 'canvas' is added only if not already present
      // Type assertion for externals array
      const externals = config.externals as Array<string | RegExp | Record<string, string> | ((...args: any[]) => any)>;
      if (!externals.some(ext => typeof ext === 'string' && ext === 'canvas')) {
         externals.push('canvas');
      }
    }

    // Ensure that all modules resolve to the project's single instances of React and ReactDOM.
    if (!config.resolve) {
      config.resolve = {};
    }
    
    // Safely set/override React and React-DOM aliases
    // This preserves any existing aliases Next.js might have set.
    config.resolve.alias = {
      ...(config.resolve.alias || {}), // Spread existing aliases
      'react': path.resolve('./node_modules/react'),
      'react-dom': path.resolve('./node_modules/react-dom'),
    };
    
    return config;
  },
};

export default nextConfig;
