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
  const serverPath = path.join(__dirname, 'server.ts');
  
  if (isDev) {
    serverProcess = spawn('npx', ['tsx', serverPath], {
      shell: true,
      env: { ...process.env, NODE_ENV: 'development' }
    });
  } else {
    // 生产环境下，由于是打包后的，我们可能需要使用 node 直接运行或者通过 electron 运行环境
    // 注意：在 portable 模式下，process.execPath 指向的是解压后的临时目录
    serverProcess = spawn(process.execPath, [serverPath], {
      env: { ...process.env, NODE_ENV: 'production', ELECTRON_RUN_AS_NODE: '1' }
    });
  }

  serverProcess.stdout.on('data', (data) => {
    console.log(`Server: ${data}`);
    if (data.toString().includes('Server running on')) {
      const portMatch = data.toString().match(/http:\/\/localhost:(\d+)/);
      const port = portMatch ? portMatch[1] : '5173';
      mainWindow.loadURL(`http://localhost:${port}`);
    }
  });

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
