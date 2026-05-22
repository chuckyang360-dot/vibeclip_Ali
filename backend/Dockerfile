FROM python:3.11-slim

WORKDIR /app

# Vibe Clip 后端镜像（Railway / 容器部署）
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ARG APT_MIRROR=""
ARG PIP_INDEX_URL=""

# 复制 requirements 文件
COPY requirements.txt .

# 可选：容器构建时切换 Debian apt 源（阿里云 ECS 构建可传 mirrors.aliyun.com）
RUN if [ -n "$APT_MIRROR" ]; then \
        if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
            sed -i "s|https\?://deb.debian.org/debian|${APT_MIRROR}|g; s|https\?://security.debian.org/debian-security|${APT_MIRROR}-security|g" /etc/apt/sources.list.d/debian.sources; \
        elif [ -f /etc/apt/sources.list ]; then \
            sed -i "s|https\?://deb.debian.org/debian|${APT_MIRROR}|g; s|https\?://security.debian.org/debian-security|${APT_MIRROR}-security|g" /etc/apt/sources.list; \
        fi; \
    fi

# 升级 pip
RUN if [ -n "$PIP_INDEX_URL" ]; then \
        pip install --no-cache-dir -i "$PIP_INDEX_URL" --trusted-host mirrors.aliyun.com --upgrade pip; \
    else \
        pip install --no-cache-dir --upgrade pip; \
    fi

# 安装 ffmpeg（服务端依赖）
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# 安装依赖
RUN if [ -n "$PIP_INDEX_URL" ]; then \
        pip install --no-cache-dir -i "$PIP_INDEX_URL" --trusted-host mirrors.aliyun.com -r requirements.txt; \
    else \
        pip install --no-cache-dir -r requirements.txt; \
    fi

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
