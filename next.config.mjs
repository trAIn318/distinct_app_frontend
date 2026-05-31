/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img1.wsimg.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // /products fue renombrado a /courses — mantenemos el redirect para no romper enlaces
  async redirects() {
    return [
      {
        source: '/products',
        destination: '/courses',
        permanent: true,
      },
      {
        source: '/products/:path*',
        destination: '/courses/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
