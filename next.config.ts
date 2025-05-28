
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
    // This is critical for preventing errors like "Cannot read properties of undefined (reading 'ReactCurrentOwner')"
    // which often arise from multiple React instances.
    if (!config.resolve) {
      config.resolve = {};
    }
    if (typeof config.resolve.alias !== 'object' || config.resolve.alias === null) {
        config.resolve.alias = {}; // Initialize if not an object
    }
    
    // Assign React and React-DOM aliases. Using Object.assign to modify the existing alias object.
    Object.assign(config.resolve.alias, {
        react: path.resolve('./node_modules/react'),
        'react-dom': path.resolve('./node_modules/react-dom'),
    });
    
    return config;
  },
};

export default nextConfig;
