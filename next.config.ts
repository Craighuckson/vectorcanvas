
import type { NextConfig } from 'next';

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
    if (isServer) {
      // For packages that depend on `canvas` (like Konva) but are used client-side
      // with next/dynamic, this can prevent "Module not found: Can't resolve 'canvas'"
      // errors during the server build.
      if (!config.externals) {
        config.externals = [];
      }
      // Workaround for https://github.com/konvajs/konva/issues/1558
      // Treat 'canvas' as an external module on the server.
      config.externals.push('canvas'); 
    }
    return config;
  },
};

export default nextConfig;
