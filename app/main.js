const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');

function resolveFfmpeg() {
  try {
    const staticPath = require('ffmpeg-static');
    if (staticPath && fs.existsSync(staticPath)) return staticPath;
  } catch (_) {}
  return 'ffmpeg';
}

const FFMPEG_BIN = resolveFfmpeg();
const proxyJobs = new Map();

function getProxyCacheDir() {
  const dir = path.join(app.getPath('userData'), 'proxy-cache');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function buildProxy(srcPath, sender) {
  if (!srcPath || !fs.existsSync(srcPath)) {
    return Promise.resolve({ ok: false, error: 'Файл не найден на диске' });
  }
  const st = fs.statSync(srcPath);
  const hash = crypto
    .createHash('sha1')
    .update(`${srcPath}|${st.size}|${Math.floor(st.mtimeMs)}`)
    .digest('hex')
    .slice(0, 20);
  const outPath = path.join(getProxyCacheDir(), `${hash}_540p_intra.mp4`);

  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1024) {
    return Promise.resolve({ ok: true, proxyPath: outPath, cached: true });
  }
  if (proxyJobs.has(outPath)) return proxyJobs.get(outPath);

  const tmpPath = outPath + '.tmp.mp4';
  const job = new Promise((resolve) => {
    const args = [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      '-i', srcPath,
      '-an',
      '-vf', "scale='min(960,iw)':'min(540,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-g', '1',
      '-keyint_min', '1',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      tmpPath,
    ];
    let errBuf = '';
    const proc = spawn(FFMPEG_BIN, args, { windowsHide: true });
    proc.stderr.on('data', (d) => { errBuf += d.toString(); });
    proc.on('error', (err) => {
      proxyJobs.delete(outPath);
      resolve({ ok: false, error: err.message });
    });
    proc.on('close', (code) => {
      proxyJobs.delete(outPath);
      if (code === 0 && fs.existsSync(tmpPath)) {
        try {
          fs.renameSync(tmpPath, outPath);
          if (sender && !sender.isDestroyed()) {
            sender.send('vm:proxy-progress', { srcPath, proxyPath: outPath, done: true });
          }
          resolve({ ok: true, proxyPath: outPath, cached: false });
          return;
        } catch (e) {
          resolve({ ok: false, error: e.message });
          return;
        }
      }
      try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {}
      resolve({ ok: false, error: errBuf.trim() || `ffmpeg код ${code}` });
    });
  });

  proxyJobs.set(outPath, job);
  return job;
}

ipcMain.handle('vm:ensure-proxy', (ev, filePath) => buildProxy(filePath, ev.sender));

function createWindow() {
  const win = new BrowserWindow({
    width: 1520,
    height: 940,
    backgroundColor: '#0b0c10',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
