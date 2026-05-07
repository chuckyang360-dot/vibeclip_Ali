FROM python:3.11-slim

WORKDIR /app

# Vibe Clip 后端镜像（Railway / 容器部署）
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# 复制 requirements 文件
COPY requirements.txt .

# 升级 pip
RUN pip install --upgrade pip

# 安装 ffmpeg（服务端依赖）
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# 安装依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
