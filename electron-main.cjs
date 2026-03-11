const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "小会计 - 氧化加工厂财务管理系统",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Start the Node.js server
  // In development, we use tsx server.ts
  // In production, we'll need to handle it differently.
  // For simplicity, let's just start the server.ts using tsx or node depending on env
  
  const isDev = process.env.NODE_ENV !== 'production';
  const serverPath = isDev 
    ? path.join(__dirname, 'server.ts') 
    : path.join(__dirname, 'dist', 'server.js');
  
  const port = 5173;

  if (isDev) {
    // In dev, Vite is usually running already on 5173, but we also start our server on another port?
    // Actually, in dev we want to hit Vite dev server.
    mainWindow.loadURL('http://localhost:5173');
    serverProcess = spawn('npx', ['tsx', serverPath], {
      shell: true,
      env: { ...process.env, NODE_ENV: 'development', PORT: 3001 } // Use different port for API in dev?
    });
    // But wait, the app is hardcoded to use /api/... which goes to the same origin.
    // In dev, Vite proxies /api to the server.
  } else {
    // Production: Start the bundled server and load from it
    serverProcess = spawn(process.execPath, [serverPath], {
      env: { ...process.env, NODE_ENV: 'production', ELECTRON_RUN_AS_NODE: '1', PORT: port }
    });

    serverProcess.stdout.on('data', (data) => {
      console.log(`Server: ${data}`);
      if (data.toString().includes(`http://localhost:${port}`)) {
        mainWindow.loadURL(`http://localhost:${port}`);
      }
    });
  }

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server Error: ${data}`);
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
    if (serverProcess) serverProcess.kill();
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

process.on('exit', () => {
  if (serverProcess) serverProcess.kill();
});
