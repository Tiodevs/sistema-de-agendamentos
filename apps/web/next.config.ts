/** @type {import('next').NextConfig} */
const nextConfig = {
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
