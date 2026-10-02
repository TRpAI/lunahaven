# 栖月账本 (Qiyue Ledger)

> **极简高效 · 单用户私有沙盒 · Local-First 架构 · 汽车看板与全场景个人资产账本**

栖月账本 (Qiyue Ledger) 是一款专为个人打造的高性能私有化财务与生活资产管理系统。采用 **Local-First（本地优先）** 架构设计，保障 100% 数据私密性；同时提供 **Cloudflare D1 边缘云端无服务器数据库同步** 与 **微软 OneDrive 定时增量备份**，兼具极致的离线体验与多端灾备能力。

---

## ✨ 核心功能模块

### 1. 🚗 汽车运行看板与出行维保档案
- **多车型支持**：兼容纯电动车 (EV / kWh)、燃油车 (92#/95#/98# / 柴油) 及插电混动 (PHEV)。
- **补能与能耗精算**：记录加油/充电表显里程与单价，自动连续测算百公里能耗（L/100km 或 kWh/100km）及每公里行驶成本。
- **健康度与维保预警**：根据最新表显里程与时间周期，自动监测保养剩余里程、车险到期与年检周期预警。
- **能耗与费用走势图**：直观展示阶段性能耗走势折线图与累计用车支出（能源 vs 维保）构成。

### 2. 💼 薪酬、五险一金与加班工时中心
- **全税种五险一金精算**：内置中国标准社保公积金计算模型（养老、医疗、失业、工伤、生育、公积金及大病附加），支持自定义基数与上下限。
- **税前扣减与专项扣除**：支持子女教育、继续教育、住房贷款/租金、赡养老人等专项附加扣除与个税预扣预缴倒算。
- **加班工时与调休池**：记录工作日 (1.5x)、周末 (2.0x)、法定节假日 (3.0x) 加班工时，支持「转加班费」或「转入调休池抵扣」。
- **薪酬与工时自动勾稽核对**：自动将加班工时折算金额与工资条实发加班费进行月度交叉比对，自动标记差额与吻合状态。

### 3. 🛍️ 综合支出与五大支出分类
- **日常生活**：餐饮美食、居家物业、日用百货、穿戴服饰、交通出行等。
- **医疗健康**：门诊就医、住院治疗、体检筛查、药品耗材等。
- **人情往来**：随礼备忘、红包收支、礼尚往来平账跟踪。
- **教育专项**：学杂费、课外培优、兴趣特长、书籍硬件等。
- **旅游度假**：机票火车、酒店住宿、景区门票、餐饮租车等。

### 4. 🛡️ 安全鉴权与隐私保护
- **单用户私密主密码**：采用 **PBKDF2-SHA256 (100,000 次哈希迭代 + 唯一随机 Salt)** 高强度加密鉴权。
- **二步验证 (2FA / TOTP)**：基于 RFC 6238 国际标准，支持 Google Authenticator、Apple 密码验证器、1Password、Bitwarden 等，附带应急备用恢复码。
- **一键防窥模式**：支持一键将界面所有金额与敏感数字替换为掩码 (`••••`)。
- **无操作自动锁屏**：支持设定闲置 1~60 分钟自动锁屏保护隐私，刷新页面保持已验证登录状态。

### 5. 💾 灾备、导出与多端同步
- **Cloudflare D1 边缘同步**：一键双向增量同步至 Cloudflare D1 Serverless SQLite 数据库。
- **OneDrive 定时增量备份**：前端直连 Microsoft Graph API，定时自动上传 JSON 增量快照并支持历史快照一键恢复。
- **CSV 专业报表批量导出**：一键生成标准 UTF-8 BOM CSV 电子表格，无缝兼容 Microsoft Excel 与 Apple Numbers。
- **全量 JSON 冷备份**：随时一键打包导出全部底层数据，便于本地存储与跨设备迁移。
- **PWA 渐进式应用支持**：支持添加到手机桌面与 PC 客户端，支持完全离线运行。

---

## 🏗️ 系统架构设计

```
┌────────────────────────────────────────────────────────────────────────┐
│                        前端展现层 (React SPA / PWA)                     │
│   Dashboard · Salary & Overtime · Expenses · Vehicle · Analytics       │
├───────────────────────────────────┬────────────────────────────────────┤
│           本地优先存储层 (Local-First)         │            安全与鉴权层             │
│   ┌─────────────────────────────┐ │ ┌────────────────────────────────┐ │
│   │ 浏览器 IndexedDB (异步主存储) │ │ │ PBKDF2-SHA256 主密码鉴权       │ │
│   │ • salaries   • overtimes    │ │ │ RFC 6238 动态口令 (TOTP 2FA)   │ │
│   │ • expenses   • vehicles     │ │ │ 应急备用恢复码管理               │ │
│   │ • fuels      • maintenances │ │ └────────────────────────────────┘ │
│   │ • gifts      • settings     │ │                                    │
│   └─────────────────────────────┘ │                                    │
│   ┌─────────────────────────────┐ │                                    │
│   │ LocalStorage (极速冷启动缓存)│ │                                    │
│   └─────────────────────────────┘ │                                    │
├───────────────────────────────────┴────────────────────────────────────┤
│                       云端灾备与外部集成层                              │
│   ┌─────────────────────────────┐   ┌────────────────────────────────┐ │
│   │ Cloudflare Workers (API)    │   │ Microsoft Graph API (直连)     │ │
│   │        ↓                    │   │        ↓                       │ │
│   │ Cloudflare D1 (SQLite 边缘库)│   │ OneDrive 云端增量快照与轮转    │ │
│   └─────────────────────────────┘   └────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### 核心技术栈
- **前端核心**：React 18、TypeScript、Vite
- **样式体系**：Tailwind CSS、Lucide Icons
- **图表组件**：自研轻量 Canvas / SVG 图表渲染引擎（折线图、环形图、柱状图、热力图）
- **安全算法**：Web Crypto API（SubtleCrypto PBKDF2-SHA256、HMAC-SHA1 TOTP）
- **本地存储**：Native Promise-based IndexedDB Engine + LocalStorage
- **云端服务**：Cloudflare Workers (Edge Functions) + Cloudflare D1 (Serverless SQL)

---

## 🚀 部署指南

### 平台选型推荐

| 部署方案 | 适用场景 | 成本 | 复杂度 | 推荐指数 |
| :--- | :--- | :--- | :--- | :--- |
| **Cloudflare Pages + Workers + D1** | 全球极速 CDN、全自动多端云同步、自动化备份 | **完全免费** | 低 | ⭐⭐⭐⭐⭐ (强烈推荐) |
| **Vercel / Netlify / GitHub Pages** | 纯静态托管、单机离线使用、配合 OneDrive 备份 | **完全免费** | 极低 | ⭐⭐⭐⭐ |
| **私有云 VPS / Docker / Nginx** | 个人私有 NAS、私有云服务器内网部署 | 自备服务器 | 中 | ⭐⭐⭐⭐ |

---

### 方案一：Cloudflare Pages + Workers + D1 全栈部署 (最推荐)

#### 第一步：创建 Cloudflare D1 数据库
1. 安装并登录 Wrangler CLI：
   ```bash
   npm install -g wrangler
   npx wrangler login
   ```
2. 创建 D1 数据库实例：
   ```bash
   npx wrangler d1 create qiyue_ledger_d1
   ```
   *控制台会输出 `database_id`，例如：`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`。*

3. 将得到的 `database_id` 填入 `worker/wrangler.toml` 文件中：
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "qiyue_ledger_d1"
   database_id = "你的_DATABASE_ID"
   ```

4. 执行数据库结构迁移（初始化数据表）：
   ```bash
   cd worker
   npx wrangler d1 migrations apply qiyue_ledger_d1 --remote
   ```

#### 第二步：部署 Cloudflare Worker 后端 API
1. 设置 API 访问通信密钥（可选，推荐设置以保障安全性）：
   ```bash
   npx wrangler secret put API_TOKEN
   # 提示输入自定义强密码密钥，例如: my_secure_sync_token_2026
   ```

2. 部署 Worker：
   ```bash
   npm run deploy
   ```
   *部署完成后将获得 Worker 接口地址，例如：`https://qiyue-ledger-api.your-name.workers.dev`。*

#### 第三步：部署前端到 Cloudflare Pages
1. 在 Cloudflare Dashboard 中进入 **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**。
2. 配置构建参数：
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Node.js Version**: `>= 18.0.0`
3. 点击 **Save and Deploy** 完成发布！

---

### 方案二：Vercel / Netlify 一键部署 (纯前端静态模式)

由于本系统采用 **Local-First 架构**，前端应用完全可作为独立的纯静态 SPA 运行。

1. Fork 本仓库至个人 GitHub。
2. 登录 [Vercel](https://vercel.com) 或 [Netlify](https://www.netlify.com)。
3. 导入 GitHub 仓库，构建设置：
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. 部署完成后即可访问！
   *(可在设置中随时绑定个人 OneDrive 或后续再配置 Cloudflare Worker API)*

---

### 方案三：Docker 容器化 / 自建 Nginx 部署

#### 1. 构建 Docker 镜像
项目根目录下运行：
```bash
docker build -t qiyue-ledger:latest .
```

#### 2. 运行容器
```bash
docker run -d \
  --name qiyue-ledger \
  -p 8080:80 \
  --restart always \
  qiyue-ledger:latest
```
访问 `http://localhost:8080` 即可使用。

#### 参考 `Dockerfile`
```dockerfile
# Build Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production Stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### 参考 `nginx.conf`
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip 压缩支持
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源长期缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 🛠️ 本地开发与调试

### 前端开发运行
```bash
# 1. 安装项目依赖
npm install

# 2. 启动本地 Vite 开发服务器 (默认端口: 3000)
npm run dev

# 3. 校验 TypeScript 类型与语法检查
npm run lint

# 4. 构建生产产物
npm run build
```

### Worker 模拟本地调试
```bash
cd worker
npm install

# 启动本地 Miniflare 边缘模拟环境 (含本地 D1 SQLite)
npm run dev

# 对本地开发数据库执行迁移
npx wrangler d1 migrations apply qiyue_ledger_d1 --local
```

---

## 🔐 数据安全与隐私保障说明

1. **零第三方打扰**：无任何外部打点、用户追踪或数据分析 SDK。
2. **端到端主密码鉴权**：明文密码不以任何形式持久化，仅保存 PBKDF2 密文字符串及随机盐值。
3. **OneDrive 个人云直连**：OneDrive 同步授权 Access Token 仅保存在本机浏览器沙盒内，由浏览器直连微软官方 Microsoft Graph API，不经过任何中间服务器。
4. **Cloudflare D1 专属隔离**：云端数据存储在用户自行创建的 Cloudflare D1 边缘数据库中，完全归用户本人所有。

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源协议发布。
