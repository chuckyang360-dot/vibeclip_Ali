#!/bin/bash

# 部署脚本 - Vibe Marketing Backend
# 使用方法: ./deploy.sh

echo "开始部署 Vibe Marketing Backend..."

# 1. 安装依赖
echo "正在安装依赖..."
pip install -r requirements.txt

# 2. 检查环境变量
echo "检查环境变量..."
if [ -z "$GOOGLE_CLIENT_ID" ] || [ -z "$GOOGLE_CLIENT_SECRET" ]; then
    echo "错误: 请设置 GOOGLE_CLIENT_ID 和 GOOGLE_CLIENT_SECRET 环境变量"
    exit 1
fi

if [ -z "$XAI_API_KEY" ]; then
    echo "错误: 请设置 XAI_API_KEY 环境变量"
    exit 1
fi

# 3. 初始化数据库
echo "初始化数据库..."
python -c "from app.database import init_db; init_db()"

# 4. 启动应用
echo "启动应用..."
python run.py