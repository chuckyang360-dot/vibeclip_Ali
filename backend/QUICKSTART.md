# 快速启动指南

## 1. 配置环境变量

```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件，填入以下信息：

```env
# 必须填写的配置
GOOGLE_CLIENT_ID=你的Google客户端ID
GOOGLE_CLIENT_SECRET=你的Google客户端密钥
XAI_API_KEY=你的X AI API密钥

# 可选配置（使用默认值即可）
PORT=8000
DEBUG=True
DATABASE_URL=sqlite:///./vibe_marketing.db
FRONTEND_URL=http://localhost:3000
```

## 2. 安装依赖

### 使用虚拟环境（推荐）

```bash
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows

pip install -r requirements.txt
```

### 直接安装

```bash
pip install -r requirements.txt
```

## 3. 启动服务器

### 方法一：使用启动脚本（推荐）

```bash
./start.sh
```

### 方法二：直接运行

```bash
python run.py
```

### 方法三：使用 uvicorn

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 方法四：使用 Docker

```bash
docker-compose up -d
```

## 4. 验证运行

### 检查健康状态

```bash
curl http://localhost:8000/health
```

预期输出：
```json
{"status":"healthy","message":"API is running"}
```

### 查看API文档

在浏览器中打开：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 5. 测试API

运行测试脚本：

```bash
python tests/test_api.py
```

## 6. 前端集成

参考 `FRONTEND_INTEGRATION.md` 文档将前端与后端连接。

## 常见问题

### Q: 端口 8000 被占用怎么办？

修改 `.env` 文件中的 `PORT` 变量，例如改为 8001

### Q: 数据库初始化失败？

删除现有的数据库文件后重新启动：
```bash
rm vibe_marketing.db
python run.py
```

### Q: Google OAuth 配置失败？

确保：
1. Google Cloud Console 中已启用 Google+ API
2. OAuth 2.0 客户端 ID 已创建
3. 授权重定向 URI 包含 `http://localhost:8000/api/v1/auth/google/callback`

### Q: X AI API 调用失败？

检查：
1. `XAI_API_KEY` 是否正确配置
2. API 服务是否正常运行
3. 网络连接是否正常

## 开发模式 vs 生产模式

### 开发模式
- `DEBUG=True`
- 使用 SQLite 数据库
- 自动重载（热更新）
- CORS 允许所有来源

### 生产模式
- `DEBUG=False`
- 使用 PostgreSQL 数据库
- 启用认证中间件
- 配置 CORS 白名单
- 使用 HTTPS

## 下一步

1. 配置 Google OAuth（查看文档）
2. 测试登录功能
3. 测试 X Agent 分析功能
4. 集成前端应用
5. 部署到生产环境