/** @type {import('next').NextConfig} */
const config = {
  // Išjungti router cache admin puslapiams
  experimental: {
    staleTimes: {
      dynamic: 0,  // 0 sekundžių - visada gauti naujus duomenis
      static: 0,
    },
  },
  async headers() {
    return [
      {
        source: '/t/:slug*',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=10, stale-while-revalidate=30' },
        ],
      },
      {
        // Admin puslapiai — be cache
        source: '/tournament/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
    ]
  },
}

module.exports = config
