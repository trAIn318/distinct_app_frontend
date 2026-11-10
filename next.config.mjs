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
  // Los PDF de los white papers se descargan libremente, pero no deben
  // indexarse: si Google indexa el PDF, ese PDF compite en resultados con la
  // página del paper, que es la que tiene que posicionar y la que lleva al
  // resto del sitio (sección 7 de la ficha). Esto no impide descargarlo.
  async headers() {
    return [
      {
        source: '/insights/pdf/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex' }],
      },
    ];
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
