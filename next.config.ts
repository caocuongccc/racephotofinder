/** @type {import('next').NextConfig} */
const nextConfig = {
  // experimental: {
  //   serverComponentsExternalPackages: ['googleapis'],
  // },
  turbopack: {}, // Empty turbopack config to acknowledge Turbopack usage
  webpack: (config) => {
    config.externals.push({
      "utf-8-validate": "commonjs utf-8-validate",
      bufferutil: "commonjs bufferutil",
    });
    return config;
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
};

module.exports = nextConfig;
