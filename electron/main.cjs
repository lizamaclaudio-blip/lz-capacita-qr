// electron/main.cjs
const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

let win;
let nextProc;

const isDev = !app.isPackaged;

// En producción uso un puerto menos típico para evitar choques
const PROD_PORT = process.env.PREVENCIONQR_PORT || "3210";

function createWindow(url) {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
  });

  win.loadURL(url);

  if (isDev) {
    win.webContents.openDevTools({ mode: "detach" });
  }
}

async function startNextProdServer() {
  // Dentro del paquete, Electron pone tu app en:
  // process.resourcesPath/app/...
  const serverJs = path.join(process.resourcesPath, "app", ".next", "standalone", "server.js");

  if (!fs.existsSync(serverJs)) {
    throw new Error(
      "No encontré server.js de Next standalone. ¿Ejecutaste npm run dist (que hace build+prep)?\n" +
        `Ruta esperada: ${serverJs}`
    );
  }

  const cwd = path.dirname(serverJs);

  nextProc = spawn(process.execPath, [serverJs], {
    cwd,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: PROD_PORT,
      HOSTNAME: "127.0.0.1",
    },
    stdio: "inherit",
    windowsHide: true,
  });

  // Espera corta para que el servidor levante
  await new Promise((r) => setTimeout(r, 1500));
}

app.whenReady().then(async () => {
  if (isDev) {
    createWindow("http://localhost:3000");
  } else {
    await startNextProdServer();
    createWindow(`http://127.0.0.1:${PROD_PORT}`);
  }
});

app.on("before-quit", () => {
  if (nextProc) nextProc.kill();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});