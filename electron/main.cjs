// Electron main process. Kept as .cjs (CommonJS) so it works under
// package.json "type":"module" without a separate compilation step.
//
// Dev:  npm run dev:electron  → starts Vite + waits for it, then opens Electron
//       pointing at http://localhost:5173
// Prod: npm run build:electron → Vite build → electron-builder packages it
//       Loads dist/index.html from the packaged app via file://

'use strict'
const { app, BrowserWindow, shell } = require('electron')
const path = require('path')

const DEV_URL = process.env.VITE_DEV_SERVER_URL

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    title: 'ThreeJ',
    backgroundColor: '#07070f',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // Allow loading local resources (WASM, assets) from file://
      // Rapier WASM is base64-inlined so this is a belt-and-suspenders guard.
      webSecurity: !DEV_URL,
    },
  })

  if (DEV_URL) {
    win.loadURL(DEV_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Open external links in the OS browser, not in the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
