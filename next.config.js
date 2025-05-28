
/** @type {import('next').NextConfig} */
const nextConfig = {
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
  // Temporarily remove webpack customization to isolate the reloading issue
  // webpack: (config, { isServer, webpack }) => {
  //   if (!config.resolve) {
  //     config.resolve = {};
  //   }
  //   config.resolve.alias = {
  //     ...(config.resolve.alias || {}),
  //     'react': require('path').resolve('./node_modules/react'),
  //     'react-dom': require('path').resolve('./node_modules/react-dom'),
  //   };
  //   return config;
  // },
};

module.exports = nextConfig;
