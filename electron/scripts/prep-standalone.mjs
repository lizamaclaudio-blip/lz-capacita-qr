// electron/scripts/prep-standalone.mjs
import fs from "fs/promises";
import path from "path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(standaloneDir))) {
    throw new Error("No existe .next/standalone. Ejecuta primero: npm run build");
  }

  // Copiar .next/static -> .next/standalone/.next/static
  const staticSrc = path.join(root, ".next", "static");
  const staticDest = path.join(standaloneDir, ".next", "static");
  if (await exists(staticSrc)) {
    await fs.mkdir(path.dirname(staticDest), { recursive: true });
    await fs.cp(staticSrc, staticDest, { recursive: true, force: true });
  }

  // Copiar public -> .next/standalone/public
  const publicSrc = path.join(root, "public");
  const publicDest = path.join(standaloneDir, "public");
  if (await exists(publicSrc)) {
    await fs.cp(publicSrc, publicDest, { recursive: true, force: true });
  }

  console.log("✅ Standalone preparado: static + public copiados.");
}

main().catch((e) => {
  console.error("❌ Error preparando standalone:", e);
  process.exit(1);
});