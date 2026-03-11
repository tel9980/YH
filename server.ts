import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import session from "express-session";
import fs from "fs";

// 1. 基础环境配置 (Environment)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === "production";

// 2. 数据存储策略 (Storage)
const getStoragePath = () => {
  const exeDir = path.dirname(process.execPath);
  const localDataPath = path.join(exeDir, "data");
  if (isProduction && fs.existsSync(localDataPath)) return localDataPath;
  return isProduction 
    ? path.join(process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share"), "xiaokuaiji")
    : __dirname;
};

const userDataPath = getStoragePath();
if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
const dbPath = path.join(userDataPath, "xiaokuaiji.db");
const db = new Database(dbPath);

// 3. 核心服务初始化 (Initialization)
const initApp = async () => {
  const app = express();
  const PORT = process.env.PORT || 5173;

  // 3.1 数据库迁移 (Migration)
  const { MigrationManager } = await import("./server/migrations/migrationManager.js");
  const migrationManager = new MigrationManager(db);
  await migrationManager.runMigrations();
  await migrationManager.loadManufacturingAccounts();

  // 3.2 基础中间件 (Middleware)
  app.use(express.json());
  app.use(cookieParser());
  app.use(session({
    secret: "xiaokuaiji-secret",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
  }));

  // 3.3 路由挂载 (Routing)
  const { createV7Routes } = await import("./server/routes/v7-api.js");
  const { createBusinessRoutes } = await import("./server/routes/business-api.js");
  const { createSystemRoutes } = await import("./server/routes/system-api.js");
  const { createAuthRoutes } = await import("./server/routes/auth-api.js");

  app.use("/api/v7", createV7Routes(db));
  app.use("/api", createBusinessRoutes(db));
  app.use("/api/system", createSystemRoutes(db));
  app.use("/api/auth", createAuthRoutes());
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // 3.4 静态资源与生产环境处理 (Static Files)
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(path.join(__dirname, 'index.html')) ? __dirname : path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  // 4. 启动服务 (Server Start)
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`------------------------------------------`);
    console.log(`🚀 小会计 v7.3 - 服务启动成功`);
    console.log(`🌐 访问地址: http://localhost:${PORT}`);
    console.log(`🗄️ 数据库: ${dbPath}`);
    console.log(`------------------------------------------`);
  });
};

initApp().catch(err => {
  console.error("❌ 服务启动失败:", err);
  process.exit(1);
});
