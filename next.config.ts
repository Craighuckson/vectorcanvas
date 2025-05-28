
import type { NextConfig } from 'next';
import path from 'path'; // Ensure path is imported for resolving node_modules

const nextConfig: NextConfig = {
  /* config options here */
  // typescript: {
  //   ignoreBuildErrors: true, // Temporarily commented out for diagnostics
  // },
  // eslint: {
  //   ignoreDuringBuilds: true, // Temporarily commented out for diagnostics
  // },
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
    // 'canvas' is now a direct dependency, so externalizing it might not be necessary
    // and could potentially complicate the server build.
    // if (isServer) {
    //   if (!config.externals) {
    //     config.externals = [];
    //   }
    //   const externals = config.externals as Array<string | RegExp | Record<string, string> | ((...args: any[]) => any)>;
    //   if (!externals.some(ext => typeof ext === 'string' && ext === 'canvas')) {
    //      externals.push('canvas');
    //   }
    // }

    // Ensure that all modules resolve to the project's single instances of React and ReactDOM.
    if (!config.resolve) {
      config.resolve = {};
    }
    config.resolve.alias = {
      ...(config.resolve.alias || {}), // Spread existing aliases
      'react': path.resolve('./node_modules/react'),
      'react-dom': path.resolve('./node_modules/react-dom'),
    };
    
    return config;
  },
};

export default nextConfig;
