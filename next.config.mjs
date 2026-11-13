/** @type {import('next').NextConfig} */
const nextConfig = {
  // libSQL loads a native module for local files; keep it out of the bundle
  serverExternalPackages: ['@libsql/client', 'libsql'],
  experimental: {
    serverActions: { bodySizeLimit: '5mb' },
  },
};

export default nextConfig;
