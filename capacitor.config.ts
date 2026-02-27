import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "cl.lz.capacitaqr",
  appName: "LZ Capacita QR",
  webDir: "dist",
  server: {
    url: "https://lz-capacita-qr.vercel.app", // <- si usas otro dominio, cámbialo aquí
    cleartext: false,
  },
};

export default config;