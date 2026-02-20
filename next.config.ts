const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development" || process.env.VERCEL === "1"
});

module.exports = withPWA({
  // tu config actual
});