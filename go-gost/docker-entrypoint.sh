#!/bin/sh
set -e

CONFIG_FILE="/etc/gost/config.json"
GOST_CONFIG="/etc/gost/gost.json"

# 如果设置了环境变量，自动生成 config.json
if [ -n "$PANEL_ADDR" ] && [ -n "$SECRET" ]; then
  echo "使用环境变量生成配置文件..."

  # 检测是否使用 HTTPS
  ADDR_VALUE="$PANEL_ADDR"
  USE_TLS=false
  case "$ADDR_VALUE" in
    https://*) USE_TLS=true ;;
  esac
  ADDR_VALUE="${ADDR_VALUE#http://}"
  ADDR_VALUE="${ADDR_VALUE#https://}"
  ADDR_VALUE="${ADDR_VALUE%/}"

  cat > "$CONFIG_FILE" <<EOF
{
  "addr": "$ADDR_VALUE",
  "secret": "$SECRET",
  "use_tls": $USE_TLS
}
EOF
else
  # 检查挂载的配置文件是否存在
  if [ ! -f "$CONFIG_FILE" ]; then
    echo "错误: 未设置 PANEL_ADDR/SECRET 环境变量，且 $CONFIG_FILE 不存在。"
    echo "请通过以下方式之一提供配置："
    echo "  1. 设置环境变量: -e PANEL_ADDR=http://面板IP:6366 -e SECRET=节点密钥"
    echo "  2. 挂载配置文件: -v ./config.json:/etc/gost/config.json"
    exit 1
  fi
  echo "使用挂载的配置文件: $CONFIG_FILE"
fi

# 确保 gost.json 存在（运行时状态文件）
if [ ! -f "$GOST_CONFIG" ]; then
  echo "{}" > "$GOST_CONFIG"
fi

# Xray 配置
if [ "$XRAY_ENABLE" = "true" ] || [ "$XRAY_ENABLE" = "1" ]; then
  echo "Xray 已启用，检查 xray 二进制..."
  if [ -x /usr/local/bin/xray ]; then
    XRAY_VERSION=$(/usr/local/bin/xray version 2>/dev/null | head -1 || echo "unknown")
    echo "Xray 版本: $XRAY_VERSION"
  else
    echo "警告: Xray 二进制不存在或不可执行，Xray 功能将不可用"
  fi
fi

echo "启动 gost..."
exec /etc/gost/gost
