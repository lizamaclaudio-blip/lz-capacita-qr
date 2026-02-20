const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: true, // ✅ APAGADO PARA DEMO
});

module.exports = withPWA({
  // tu config actual
});