const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'public', 'index.html'));
}

ipcMain.handle('dialog:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'WriteTron Documents', extensions: ['wtron'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  return { filePath, content };
});

ipcMain.handle('dialog:save', async (_event, { content, filePath }) => {
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
});

ipcMain.handle('dialog:save-as', async (_event, { content }) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'WriteTron Documents', extensions: ['wtron'] }],
    defaultPath: 'Untitled.wtron',
  });
  if (res.canceled) return null;
  fs.writeFileSync(res.filePath, content, 'utf-8');
  return res.filePath;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
