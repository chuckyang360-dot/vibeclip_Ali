# 阿里云 ECS 部署（Vibe Clip / 维播vibeclip_ali）

本目录提供 **单台 ECS** 上的参考编排：**Nginx** 作为公网入口，**后端容器**由仓库既有 `backend/Dockerfile` 构建，**前端**为宿主机构建后的 **`frontend/dist`** 静态资源（由 Nginx 挂载，非多阶段合并镜像）。

> **不包含**：AI Gateway 接入、阿里云 OSS 存储实现、HTTPS 证书自动签发。仅预留环境变量与 Nginx 443 注释块。  
> **未改动**：业务代码、Railway / Vercel、数据库表结构。

## 生产上线前必填项

1. **`deploy/aliyun/.env`** 必须由 **`deploy/aliyun/.env.example`** 复制生成后再逐行填写，勿将含密钥的 `.env` 提交到版本库。
2. **`DATABASE_URL`** 在生产环境**必须**填写 **阿里云 RDS PostgreSQL** 连接串；不要用空连接上线。
3. **`SECRET_KEY`** **必须**设为**强随机字符串**，**禁止留空**，否则 JWT 与签名不安全。
4. **`frontend/dist`** 必须在执行 **`docker compose up`** 之前已存在（在仓库 `frontend/` 目录完成构建）。
5. 前端生产构建时**必须**设置 **`VITE_API_BASE_URL=https://api.vibeclip.cn`**（与模式 A 的 API 子域一致）。
6. **ECS 安全组勿对公网开放 8000**；仅 Nginx 对外暴露 80/443（及受限的 22）。
7. **生产不建议使用 SQLite**；请使用 RDS 等托管关系型数据库。
8. 当前阶段仍可使用 **`STORAGE_PROVIDER=r2`** + **`AI_PROVIDER=direct_xai`**；后续再按需切换 **`STORAGE_PROVIDER=oss`** + **`AI_PROVIDER=gateway`**（需代码与运维配合）。
9. 容器内 **`generated/`** 等本地目录**不是**生产主存储；生产资产应进入 **R2** 或后续 **OSS**。

## 推荐架构

| 组件 | 说明 |
|------|------|
| ECS | 运行 Docker Compose：Nginx + backend |
| Nginx | 监听 80/443，静态前端 + 反代 API |
| 容器 backend | FastAPI + Uvicorn，仅容器网络可达，不绑定宿主机业务端口 |
| 阿里云 RDS | **PostgreSQL**（或兼容的托管库），通过 `DATABASE_URL` 连接 |
| 对象存储 | 现阶段 **Cloudflare R2**（`STORAGE_PROVIDER=r2`）；OSS 为后续预留 |

## 域名模式

### 模式 A（推荐）

- **www.vibeclip.cn** → Nginx 根站点，托管 `frontend/dist`（SPA）。
- **api.vibeclip.cn** → Nginx 反代到 `backend:8000`。

### 模式 B（单域 + 路径）

- **vibeclip.cn** 同时托管前端与 API：静态走 `/`，API 走 **`/api/`** 前缀反代到后端。
- 实现要点：在 `nginx.conf` 的前端 `server` 中增加：

```nginx
location /api/ {
    proxy_pass http://vibe_backend;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 60s;
    proxy_send_timeout 600s;
    proxy_read_timeout 600s;
}
```

生产构建前端时需设置 **`VITE_API_BASE_URL`** 与实际 API 访问方式一致（例如同源的 `https://vibeclip.cn` 若前后端统一走 443，或仍指向独立 `api` 子域）。

## 部署流程概要

1. **准备 ECS**：安装 Docker Engine 与 Docker Compose 插件；安全组放行 **80**、**443**；**22** 建议仅信任个人 IP。
2. **准备 RDS**：创建 PostgreSQL 实例，白名单允许 ECS 内网访问，得到连接串。
3. **代码**：将本仓库同步至 ECS（或 CI 产物），**不要**依赖 `vibe clip-前端framer/`。
4. **前端构建**（在仓库 `frontend/` 目录）：

   ```bash
   cd frontend
   npm ci
   export VITE_API_BASE_URL=https://api.vibeclip.cn
   npm run build
   ```

   构建产物目录为 **`frontend/dist`**（Vite 默认）。

5. **后端环境**：进入 `deploy/aliyun/`，复制环境模板并填写：

   ```bash
   cd deploy/aliyun
   cp .env.example .env
   ```

   编辑 `.env`：`DATABASE_URL`、`SECRET_KEY`、`CORS_*`、`R2_*`、`XAI_*` 等。

6. **启动**（必须在 **`deploy/aliyun`** 目录执行，且 **`frontend/dist` 已存在**）：

   ```bash
   docker compose up -d --build
   ```

7. **HTTPS（可选）**：申请证书（如 Let’s Encrypt 或阿里云 SSL），挂载到 Nginx 容器，并取消 `nginx.conf` 末尾注释的 `listen 443 ssl` 两段 `server`，同时在 `docker-compose.yml` 的 `nginx` 服务上增加证书目录只读挂载。

## GitHub 自动部署（推荐）

本仓库已提供 GitHub Actions 工作流：

- `.github/workflows/deploy-aliyun.yml`
- `deploy/aliyun/deploy-from-github.sh`

触发方式：

- push 到 `main` 分支自动部署。
- 在 GitHub Actions 页面手动点击 `workflow_dispatch` 也可部署。

### ECS 首次准备

在 ECS 上选择一个固定目录保存仓库，例如：

```bash
sudo mkdir -p /opt/vibeclip_ali
sudo chown -R "$USER":"$USER" /opt/vibeclip_ali
git clone https://github.com/chuckyang360-dot/vibeclip_Ali.git /opt/vibeclip_ali
cd /opt/vibeclip_ali/deploy/aliyun
cp .env.example .env
```

然后填写 `deploy/aliyun/.env` 中的生产环境变量。该文件只保存在 ECS，不提交到 GitHub。

确认 ECS 上具备：

- `git`
- `node` / `npm`
- Docker Engine
- Docker Compose 插件，即 `docker compose`

如果 GitHub 仓库是私有仓库，ECS 还需要具备拉取该仓库的权限。推荐在 GitHub 仓库中配置只读 Deploy Key，并把对应私钥放到 ECS 用户的 `~/.ssh/`，确认在 ECS 上执行 `git fetch origin main` 能成功。

### GitHub Secrets

在 GitHub 仓库 `Settings -> Secrets and variables -> Actions` 中添加：

| Secret | 必填 | 说明 |
|--------|------|------|
| `ALIYUN_ECS_HOST` | 是 | ECS 公网 IP 或域名 |
| `ALIYUN_ECS_USER` | 是 | SSH 用户，例如 `admin` |
| `ALIYUN_ECS_SSH_KEY` | 是 | 可登录 ECS 的私钥内容 |
| `ALIYUN_ECS_PORT` | 否 | SSH 端口，默认 `22` |
| `ALIYUN_APP_DIR` | 否 | ECS 上仓库目录，默认 `/opt/vibeclip_ali` |
| `ALIYUN_DEPLOY_BRANCH` | 否 | 部署分支，默认 `main` |
| `ALIYUN_VITE_API_BASE_URL` | 否 | 前端构建时的 API 地址；为空则读取 ECS 上 `deploy/aliyun/.env` 的 `API_BASE_URL` |

### 自动部署做什么

GitHub Actions SSH 到 ECS 后，会执行：

```bash
cd /opt/vibeclip_ali
git fetch origin main
git reset --hard origin/main
cd frontend
npm ci
VITE_API_BASE_URL=<API 地址> npm run build
cd ../deploy/aliyun
docker compose up -d --build
```

注意：`git reset --hard origin/main` 会让 ECS 上的仓库代码与 GitHub `main` 完全一致。生产密钥必须放在未跟踪的 `deploy/aliyun/.env` 中，不要直接改 tracked 文件当作线上配置。

## 前端构建说明

- **来源**：宿主机执行 `npm run build`，生成 **`frontend/dist`**。
- **Compose**：`nginx` 服务将 **`../../frontend/dist`** 只读挂载到 `/usr/share/nginx/html`。
- **API 地址**：通过构建期变量 **`VITE_API_BASE_URL`** 指向 **`https://api.vibeclip.cn`**（模式 A）。

未在 compose 中做前端多阶段构建；若需单镜像交付，可在后续迭代自定义 Dockerfile。

## 后端启动说明

- 镜像由 **`../../backend`** 与仓库内 **`Dockerfile`** 构建（与 `docker-compose.yml` 中 `context` 一致）。
- 容器内默认：`uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}`。
- 环境变量来自 **`deploy/aliyun/.env`**（`env_file`），**compose 文件内不含密钥**。

## 域名解析

在 DNS 控制台为模式 A 配置：

| 记录 | 类型 | 值 |
|------|------|-----|
| `www.vibeclip.cn` | A | ECS 公网 IP |
| `api.vibeclip.cn` | A | ECS 公网 IP |

模式 B 将 **`vibeclip.cn`**（及可选 `www`）指向同一 IP，并在 Nginx 使用单 `server` 合并静态与 `/api/` 反代。

## 安全组建议

- **80**、**443**：对公网开放（或按业务缩小来源）。
- **22**：仅个人固定 IP 或跳板机网段。
- **不要**对公网开放 **8000**（后端仅容器内被 Nginx 访问）。

## 数据库

- **生产请使用阿里云 RDS**（推荐 PostgreSQL），在 `.env` 设置 `DATABASE_URL`。
- **容器内 SQLite 不适合作为生产多副本方案**；本 compose **未**内置 PostgreSQL 容器，与「优先 RDS」一致。

## 本阶段范围说明

- **AI Gateway / OSS**：仅环境变量占位（`AI_GATEWAY_*`、`OSS_*`），**未**在本仓库新接调用链。
- **R2 + direct_xai**：与现有代码一致，需在 `.env` 填入合法配置。

## 部署后基础验收

1. 浏览器打开站点首页（配置 HTTPS 前可先测 HTTP）：**首页可访问**。
2. **`http(s)://api.vibeclip.cn/health`**：返回 JSON，含 **healthy**。
3. **登录页 / 短剧项目页** 可访问；**创建项目** 无浏览器 **CORS** 报错（若报错，检查 `CORS_ORIGINS`、`FRONTEND_ORIGIN`、`FRONTEND_URL`）。
4. **`docker compose logs`** 中 **backend** 无启动即崩溃，请求期日志正常。

## 文件说明

| 文件 | 作用 |
|------|------|
| `docker-compose.yml` | `backend` 构建 + `nginx` 反代与静态站点 |
| `nginx.conf` | 模式 A：www 静态、api 反代、SPA fallback、`/health`、大上传与长超时 |
| `.env.example` | 阿里云生产向变量模板（无真实密钥） |
| `deploy-from-github.sh` | GitHub Actions SSH 到 ECS 后执行的自动部署脚本 |
| `README.md` | 本说明 |
