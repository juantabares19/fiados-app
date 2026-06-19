import type { NextConfig } from "next";

// Headers de seguridad aplicados a todas las respuestas.
// CSP conservador: restringe marcos, <base> y plugins (anti-clickjacking e
// inyección) sin limitar script-src/style-src, para no romper Next/Tailwind/PWA.
// Un CSP completo de script-src es una mejora futura (requiere prueba en navegador).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;