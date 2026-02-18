#!/bin/bash

# 获取系统架构
get_architecture() {
    ARCH=$(uname -m)
    case $ARCH in
        x86_64)
            echo "amd64"
            ;;
        aarch64|arm64)
            echo "arm64"
            ;;
        *)
            echo "amd64"  # 默认使用 amd64
            ;;
    esac
}

INSTALL_DIR="/etc/gost"

# 根据面板地址构建下载链接
build_download_url() {
    local ARCH=$(get_architecture)
    local BASE_URL="$SERVER_ADDR"
    # 确保有 http:// 前缀
    if [[ ! "$BASE_URL" =~ ^https?:// ]]; then
        BASE_URL="http://${BASE_URL}"
    fi
    BASE_URL="${BASE_URL%/}"
    echo "${BASE_URL}/node-install/binary/${ARCH}"
}

# 从已有配置读取面板地址（用于更新/卸载场景）
load_existing_config() {
    if [[ -f "$INSTALL_DIR/config.json" && -z "$SERVER_ADDR" ]]; then
        SERVER_ADDR=$(grep -o '"addr"[[:space:]]*:[[:space:]]*"[^"]*"' "$INSTALL_DIR/config.json" | sed 's/"addr"[[:space:]]*:[[:space:]]*"//;s/"$//')
    fi
}

# 显示菜单
show_menu() {
  echo "==============================================="
  echo "              管理脚本"
  echo "==============================================="
  echo "请选择操作："
  echo "1. 安装"
  echo "2. 更新"
  echo "3. 卸载"
  echo "4. 退出"
  echo "==============================================="
}

# 删除脚本自身
delete_self() {
  echo ""
  echo "操作已完成，正在清理脚本文件..."
  SCRIPT_PATH="$(readlink -f "$0" 2>/dev/null || realpath "$0" 2>/dev/null || echo "$0")"
  sleep 1
  rm -f "$SCRIPT_PATH" && echo "脚本文件已删除" || echo "删除脚本文件失败"
}

# 检查并安装 tcpkill
check_and_install_tcpkill() {
  if command -v tcpkill &> /dev/null; then
    return 0
  fi

  OS_TYPE=$(uname -s)

  if [[ $EUID -ne 0 ]]; then
    SUDO_CMD="sudo"
  else
    SUDO_CMD=""
  fi

  if [[ "$OS_TYPE" == "Darwin" ]]; then
    if command -v brew &> /dev/null; then
      brew install dsniff &> /dev/null
    fi
    return 0
  fi

  if [ -f /etc/os-release ]; then
    . /etc/os-release
    DISTRO=$ID
  elif [ -f /etc/redhat-release ]; then
    DISTRO="rhel"
  elif [ -f /etc/debian_version ]; then
    DISTRO="debian"
  else
    return 0
  fi

  case $DISTRO in
    ubuntu|debian)
      $SUDO_CMD apt update &> /dev/null
      $SUDO_CMD apt install -y dsniff &> /dev/null
      ;;
    centos|rhel|fedora)
      if command -v dnf &> /dev/null; then
        $SUDO_CMD dnf install -y dsniff &> /dev/null
      elif command -v yum &> /dev/null; then
        $SUDO_CMD yum install -y dsniff &> /dev/null
      fi
      ;;
    alpine)
      $SUDO_CMD apk add --no-cache dsniff &> /dev/null
      ;;
    arch|manjaro)
      $SUDO_CMD pacman -S --noconfirm dsniff &> /dev/null
      ;;
    opensuse*|sles)
      $SUDO_CMD zypper install -y dsniff &> /dev/null
      ;;
    gentoo)
      $SUDO_CMD emerge --ask=n net-analyzer/dsniff &> /dev/null
      ;;
    void)
      $SUDO_CMD xbps-install -Sy dsniff &> /dev/null
      ;;
  esac

  return 0
}


# 获取用户输入的配置参数
get_config_params() {
  if [[ -z "$SERVER_ADDR" || -z "$SECRET" ]]; then
    echo "请输入配置参数："

    if [[ -z "$SERVER_ADDR" ]]; then
      read -p "面板地址(如 http://1.2.3.4:6365): " SERVER_ADDR
    fi

    if [[ -z "$SECRET" ]]; then
      read -p "密钥: " SECRET
    fi

    if [[ -z "$SERVER_ADDR" || -z "$SECRET" ]]; then
      echo "参数不完整，操作取消。"
      exit 1
    fi
  fi
}

# 解析命令行参数
while getopts "a:s:" opt; do
  case $opt in
    a) SERVER_ADDR="$OPTARG" ;;
    s) SECRET="$OPTARG" ;;
    *) echo "无效参数"; exit 1 ;;
  esac
done

# 安装功能
install_gost() {
  echo "开始安装 GOST..."
  get_config_params

  # 构建下载地址
  DOWNLOAD_URL=$(build_download_url)

  # 检查并安装 tcpkill
  check_and_install_tcpkill

  mkdir -p "$INSTALL_DIR"

  # 停止并禁用已有服务
  if systemctl list-units --full -all | grep -Fq "gost.service"; then
    echo "检测到已存在的gost服务"
    systemctl stop gost 2>/dev/null && echo "停止服务"
    systemctl disable gost 2>/dev/null && echo "禁用自启"
  fi

  # 删除旧文件
  [[ -f "$INSTALL_DIR/gost" ]] && echo "删除旧文件 gost" && rm -f "$INSTALL_DIR/gost"

  # 下载 gost
  echo "下载 gost 中..."
  echo "下载地址: $DOWNLOAD_URL"
  curl -fL "$DOWNLOAD_URL" -o "$INSTALL_DIR/gost"
  if [[ ! -f "$INSTALL_DIR/gost" || ! -s "$INSTALL_DIR/gost" ]]; then
    echo "下载失败，请检查面板地址是否正确以及面板是否已上传节点二进制文件。"
    exit 1
  fi
  chmod +x "$INSTALL_DIR/gost"
  echo "下载完成"

  # 打印版本
  echo "gost 版本：$($INSTALL_DIR/gost -V)"

  # 写入 config.json (安装时总是创建新的)
  # gost 内部会拼接 ws:// 前缀，addr 必须是 host:port 格式
  CONFIG_ADDR="$SERVER_ADDR"
  CONFIG_ADDR="${CONFIG_ADDR#http://}"
  CONFIG_ADDR="${CONFIG_ADDR#https://}"
  CONFIG_ADDR="${CONFIG_ADDR%/}"

  CONFIG_FILE="$INSTALL_DIR/config.json"
  echo "创建新配置: config.json"
  cat > "$CONFIG_FILE" <<EOF
{
  "addr": "$CONFIG_ADDR",
  "secret": "$SECRET"
}
EOF

  # 写入 gost.json
  GOST_CONFIG="$INSTALL_DIR/gost.json"
  if [[ -f "$GOST_CONFIG" ]]; then
    echo "跳过配置文件: gost.json (已存在)"
  else
    echo "创建新配置: gost.json"
    cat > "$GOST_CONFIG" <<EOF
{}
EOF
  fi

  # 加强权限
  chmod 600 "$INSTALL_DIR"/*.json

  # 创建 systemd 服务
  SERVICE_FILE="/etc/systemd/system/gost.service"
  cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Gost Proxy Service
After=network.target

[Service]
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/gost
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

  # 启动服务
  systemctl daemon-reload
  systemctl enable gost
  systemctl start gost

  # 检查状态
  echo "检查服务状态..."
  if systemctl is-active --quiet gost; then
    echo "安装完成，gost服务已启动并设置为开机启动。"
    echo "配置目录: $INSTALL_DIR"
    echo "服务状态: $(systemctl is-active gost)"
  else
    echo "gost服务启动失败，请执行以下命令查看日志："
    echo "journalctl -u gost -f"
  fi
}

# 更新功能
update_gost() {
  echo "开始更新 GOST..."

  if [[ ! -d "$INSTALL_DIR" ]]; then
    echo "GOST 未安装，请先选择安装。"
    return 1
  fi

  # 从已有配置读取面板地址
  load_existing_config

  if [[ -z "$SERVER_ADDR" ]]; then
    read -p "面板地址(如 http://1.2.3.4:6365): " SERVER_ADDR
    if [[ -z "$SERVER_ADDR" ]]; then
      echo "面板地址不能为空。"
      return 1
    fi
  fi

  DOWNLOAD_URL=$(build_download_url)
  echo "下载地址: $DOWNLOAD_URL"

  # 检查并安装 tcpkill
  check_and_install_tcpkill

  # 先下载新版本
  echo "下载最新版本..."
  curl -fL "$DOWNLOAD_URL" -o "$INSTALL_DIR/gost.new"
  if [[ ! -f "$INSTALL_DIR/gost.new" || ! -s "$INSTALL_DIR/gost.new" ]]; then
    echo "下载失败。"
    return 1
  fi

  # 停止服务
  if systemctl list-units --full -all | grep -Fq "gost.service"; then
    echo "停止 gost 服务..."
    systemctl stop gost
  fi

  # 替换文件
  mv "$INSTALL_DIR/gost.new" "$INSTALL_DIR/gost"
  chmod +x "$INSTALL_DIR/gost"

  # 打印版本
  echo "新版本：$($INSTALL_DIR/gost -V)"

  # 重启服务
  echo "重启服务..."
  systemctl start gost

  echo "更新完成，服务已重新启动。"
}

# 卸载功能
uninstall_gost() {
  echo "开始卸载 GOST..."

  read -p "确认卸载 GOST 吗？此操作将删除所有相关文件 (y/N): " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "取消卸载"
    return 0
  fi

  # 停止并禁用服务
  if systemctl list-units --full -all | grep -Fq "gost.service"; then
    echo "停止并禁用服务..."
    systemctl stop gost 2>/dev/null
    systemctl disable gost 2>/dev/null
  fi

  # 删除服务文件
  if [[ -f "/etc/systemd/system/gost.service" ]]; then
    rm -f "/etc/systemd/system/gost.service"
    echo "删除服务文件"
  fi

  # 删除安装目录
  if [[ -d "$INSTALL_DIR" ]]; then
    rm -rf "$INSTALL_DIR"
    echo "删除安装目录: $INSTALL_DIR"
  fi

  # 重载 systemd
  systemctl daemon-reload

  echo "卸载完成"
}

# 主逻辑
main() {
  # 如果提供了命令行参数，直接执行安装
  if [[ -n "$SERVER_ADDR" && -n "$SECRET" ]]; then
    install_gost
    delete_self
    exit 0
  fi

  # 显示交互式菜单
  while true; do
    show_menu
    read -p "请输入选项 (1-4): " choice

    case $choice in
      1)
        install_gost
        delete_self
        exit 0
        ;;
      2)
        update_gost
        delete_self
        exit 0
        ;;
      3)
        uninstall_gost
        delete_self
        exit 0
        ;;
      4)
        echo "退出脚本"
        delete_self
        exit 0
        ;;
      *)
        echo "无效选项，请输入 1-4"
        echo ""
        ;;
    esac
  done
}

# 执行主函数
main
