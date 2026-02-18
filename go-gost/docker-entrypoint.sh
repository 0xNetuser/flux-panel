#!/bin/sh
set -e

CONFIG_FILE="/etc/gost/config.json"
GOST_CONFIG="/etc/gost/gost.json"

# 如果设置了环境变量，自动生成 config.json
if [ -n "$PANEL_ADDR" ] && [ -n "$SECRET" ]; then
  echo "使用环境变量生成配置文件..."

  # gost 内部会拼接 ws:// 前缀，addr 必须是 host:port 格式
  ADDR_VALUE="$PANEL_ADDR"
  ADDR_VALUE="${ADDR_VALUE#http://}"
  ADDR_VALUE="${ADDR_VALUE#https://}"
  ADDR_VALUE="${ADDR_VALUE%/}"

  cat > "$CONFIG_FILE" <<EOF
{
  "addr": "$ADDR_VALUE",
  "secret": "$SECRET"
}
EOF
else
  # 检查挂载的配置文件是否存在
  if [ ! -f "$CONFIG_FILE" ]; then
    echo "错误: 未设置 PANEL_ADDR/SECRET 环境变量，且 $CONFIG_FILE 不存在。"
    echo "请通过以下方式之一提供配置："
    echo "  1. 设置环境变量: -e PANEL_ADDR=http://面板IP:6365 -e SECRET=节点密钥"
    echo "  2. 挂载配置文件: -v ./config.json:/etc/gost/config.json"
    exit 1
  fi
  echo "使用挂载的配置文件: $CONFIG_FILE"
fi

# 确保 gost.json 存在（运行时状态文件）
if [ ! -f "$GOST_CONFIG" ]; then
  echo "{}" > "$GOST_CONFIG"
fi

echo "启动 gost..."
exec /etc/gost/gost
