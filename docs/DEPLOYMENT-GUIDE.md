# 小会计 部署指南

## 📋 目录

1. [系统要求](#系统要求)
2. [开发环境部署](#开发环境部署)
3. [生产环境构建](#生产环境构建)
4. [数据库迁移](#数据库迁移)
5. [配置说明](#配置说明)
6. [故障排除](#故障排除)
7. [性能调优](#性能调优)

---

## 系统要求

### 最低配置
- **操作系统**：Windows 10 (64-bit)
- **处理器**：Intel Core i3 或同等性能
- **内存**：4GB RAM
- **磁盘空间**：500MB 可用空间
- **显示器**：1366x768 分辨率

### 推荐配置
- **操作系统**：Windows 10/11 (64-bit)
- **处理器**：Intel Core i5 或更高
- **内存**：8GB RAM 或更高
- **磁盘空间**：1GB 可用空间
- **显示器**：1920x1080 分辨率或更高

### 软件依赖
- Node.js 18.x 或更高（仅开发环境）
- npm 9.x 或更高（仅开发环境）

---

## 开发环境部署

### 1. 克隆代码仓库

```bash
git clone https://github.com/xiaokuaiji/xiaokuaiji.git
cd xiaokuaiji
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

创建 `.env` 文件（可选）：

```env
# 数据库配置
DB_PATH=./xiaokuaiji.db

# 服务器配置
PORT=5173
API_PORT=3000

# 日志级别
LOG_LEVEL=info
```

### 4. 启动开发服务器

```bash
npm run dev
```

这将同时启动：
- Vite 开发服务器（前端）：http://localhost:5173
- Express API 服务器（后端）：http://localhost:3000
- Electron 桌面应用

### 5. 验证安装

1. 浏览器自动打开 Electron 窗口
2. 查看控制台输出，确认无错误
3. 检查数据库文件是否创建：`xiaokuaiji.db`

---

## 生产环境构建

### 1. 构建前端和后端

```bash
npm run build
```

这将：
- 使用 Vite 构建前端资源到 `dist/` 目录
- 使用 esbuild 打包后端代码到 `dist/server.js`

### 2. 构建 Electron 应用

```bash
npm run build:exe
```

这将：
- 执行 `npm run build`
- 使用 electron-builder 打包为 Windows 可执行文件
- 输出到 `release/` 目录

### 3. 构建产物

构建完成后，`release/` 目录包含：
- `小会计 7.1.0.exe` - 便携版可执行文件
- 或其他配置的安装包格式

### 4. 测试构建产物

```bash
cd release
.\小会计 7.1.0.exe
```

验证：
1. 应用正常启动
2. 数据库自动创建
3. 所有功能正常工作

---

## 数据库迁移

v7.0+ 版本引入了自动迁移机制。

### 自动迁移

系统启动时会自动检测数据库版本并执行 `server/migrations/upgrade-v7.0.sql`。

---

## 配置说明

### 数据库配置

v7.0+ 支持两种数据库存储模式：

1. **便携模式**（优先）：程序同级目录的 `data` 文件夹。
2. **系统模式**（默认）：`%APPDATA%\xiaokuaiji\xiaokuaiji.db`。

---

## 性能调优

详细性能优化说明请参阅 [PERFORMANCE-OPTIMIZATION.md](./PERFORMANCE-OPTIMIZATION.md)
