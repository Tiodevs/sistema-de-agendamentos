import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Imagem Docker (NEXT_OUTPUT=standalone): servidor Node autocontido em .next/standalone.
  // Na Vercel e no dev local nada muda.
  ...(process.env.NEXT_OUTPUT === 'standalone'
    ? { output: 'standalone', outputFileTracingRoot: path.join(__dirname, '../..') }
    : {}),
  transpilePackages: ['gsap', '@gsap/react'],
  sassOptions: {
    silenceDeprecations: ['legacy-js-api'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
};

export default nextConfig;
