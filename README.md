# Flux Panel

基于 [GOST](https://github.com/go-gost/gost) 和 [Xray](https://github.com/XTLS/Xray-core) 的流量转发与代理管理面板。

---

## 目录

- [功能概览](#功能概览)
- [系统架构](#系统架构)
- [部署面板](#部署面板)
- [部署节点](#部署节点)
- [使用指南](#使用指南)
- [更新升级](#更新升级)
- [环境变量](#环境变量)
- [常见问题](#常见问题)
- [免责声明](#免责声明)
- [License](#license)

---

## 功能概览

### GOST 流量转发

| 功能 | 说明 |
|------|------|
| **端口转发** | TCP + UDP 双协议同时转发，支持多目标地址负载均衡 |
| **隧道转发** | 入口节点 → 出口节点加密隧道，支持 TLS / mTLS / WSS / QUIC / gRPC 等协议 |
| **多 IP 监听** | 单条转发同时监听多个 IP，每个 IP 生成独立服务组 |
| **负载策略** | 轮询 / 随机 / 哈希 / 灾备切换（自动故障转移） |
| **用户限速** | 按用户+隧道维度独立限速 |
| **流量计费** | 支持单向或双向流量统计，按隧道账号级别管理配额 |
| **热更新** | 修改目标地址/策略时 listener 不重启，现有连接不中断 |
| **转发诊断** | 一键检测链路连通性、延迟、丢包率 |

### Xray 代理管理

| 功能 | 说明 |
|------|------|
| **多协议入站** | VMess / VLESS / Trojan / Shadowsocks |
| **传输层** | TCP / WebSocket / gRPC / HTTPUpgrade / xHTTP / mKCP |
| **安全层** | None / TLS / Reality |
| **结构化表单** | 可视化配置入站参数，支持随时切换到原始 JSON 编辑 |
| **客户端管理** | UUID 自动生成、流量限制、到期时间、IP 连接数限制、流量自动重置 |
| **ACME 证书** | Let's Encrypt 自动签发（DNS-01 / Cloudflare），到期前 30 天自动续签 |
| **订阅链接** | 自动生成各协议订阅链接，支持自定义入口域名 |
| **热加载** | 入站和客户端的增删改通过 gRPC API 热操作，Xray 进程不重启 |
| **版本切换** | 面板远程切换节点 Xray 版本，无需 SSH |

### 系统管理

| 功能 | 说明 |
|------|------|
| **用户权限** | GOST / Xray 功能级开关，节点访问权限按用户分配 |
| **节点管理** | 在线状态、系统信息实时监控、一键安装/更新节点 |
| **状态监控** | 实时上传/下载速度、CPU/内存使用率、网卡信息 |
| **延迟监控** | 转发延迟历史图表，支持多转发对比 |
| **面板自更新** | Dashboard 一键更新面板到最新版本 |
| **暗黑模式** | 支持明/暗主题切换 |

### 安全特性

- bcrypt 密码存储，JWT 认证（7 天有效期）
- WebSocket JWT 认证（Sec-WebSocket-Protocol）
- 登录限流（10 次/分钟）、验证码限流（20 次/分钟）
- SSRF 防护（拦截内网地址）
- CORS 域名白名单可配置
- API 响应脱敏（密钥、私钥、密码哈希）
- 首次启动自动重置默认密码

---

## 系统架构

```
┌─────────────────────────────────────────────────┐
│                   面板端 (Panel)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Frontend │  │ Backend  │  │  MySQL   │       │
│  │ (Nginx)  │──│  (Gin)   │──│  (5.7)   │       │
│  │  :80     │  │  :6365   │  │          │       │
│  └──────────┘  └────┬─────┘  └──────────┘       │
│       统一端口       │                            │
│    (默认 6366)      │ WebSocket                   │
└─────────────────────┼───────────────────────────┘
                      │
          ┌───────────┼───────────┐
          │           │           │
    ┌─────▼─────┐ ┌──▼────┐ ┌──▼────┐
    │  节点 A   │ │节点 B │ │节点 C │
    │  (GOST)   │ │(GOST) │ │(GOST) │
    │  + Xray   │ │+ Xray │ │+ Xray │
    └───────────┘ └───────┘ └───────┘
```

**组件说明：**

| 组件 | 技术栈 | 说明 |
|------|--------|------|
| Frontend | Next.js + TypeScript + Tailwind CSS | 静态导出，Nginx 托管 |
| Backend | Go + Gin + GORM | REST API + WebSocket |
| Database | MySQL 5.7 | 持久化存储 |
| Node Agent | Go (GOST) | 接收面板指令，管理转发和 Xray |
| Xray | Xray-core | 代理服务，由节点进程管理 |

**通信方式：**

- **面板 ↔ 节点**：WebSocket 长连接（`/system-info`），双向通信
- **面板 → 节点**：通过 WebSocket 发送命令（AddService / XrayAddInbound 等）
- **节点 → 面板**：每 2-3 秒上报系统信息（CPU、内存、网卡、流量）
- **前端 ↔ 后端**：REST API + Admin WebSocket（实时监控数据推送）

---

## 部署面板

> 面板需要 Docker 环境，支持 amd64 和 arm64 架构。

### 方式一：一键脚本（推荐）

```bash
curl -fsSL https://raw.githubusercontent.com/0xNetuser/flux-panel/main/panel_install.sh -o panel_install.sh && chmod +x panel_install.sh && ./panel_install.sh
```

脚本提供交互式菜单：

| 选项 | 说明 |
|------|------|
| 1. 安装面板 | 自动安装 Docker、生成随机密码、下载配置、启动服务 |
| 2. 更新面板 | 拉取最新镜像、执行数据库迁移、重启服务 |
| 3. 卸载面板 | 删除容器、卷和配置文件 |
| 4. 导出备份 | 导出 MySQL 数据库备份到当前目录 |

脚本会自动检测 IPv6 环境并配置 Docker IPv6 支持。中国大陆用户自动使用 CDN 加速下载。

### 方式二：手动 Docker Compose

**1. 下载配置文件**

```bash
mkdir -p flux-panel && cd flux-panel
curl -fsSL https://github.com/0xNetuser/flux-panel/releases/latest/download/docker-compose.yml -o docker-compose.yml
```

**2. 创建 `.env` 文件**

```env
# 数据库配置
DB_NAME=gost_db
DB_USER=gost_user
DB_PASSWORD=<随机密码>

# JWT 密钥（必须设置，否则每次重启失效）
JWT_SECRET=<随机密码>

# 面板端口（默认 6366）
PANEL_PORT=6366

# 可选：IPv6 支持
# ENABLE_IPV6=true

# 可选：CORS 域名白名单（逗号分隔，不设置则允许所有）
# ALLOWED_ORIGINS=https://panel.example.com
```

> 使用 `openssl rand -base64 32` 生成随机密码。

**3. 启动**

```bash
docker compose up -d
```

**4. 获取管理员密码**

首次启动会自动生成随机管理员密码：

```bash
docker logs go-backend 2>&1 | grep "密码"
```

| 项目 | 值 |
|------|------|
| 地址 | `http://<服务器IP>:6366` |
| 账号 | `admin_user` |
| 密码 | 查看启动日志 |

### IPv6 配置

如需 IPv6 支持，在 `.env` 中设置 `ENABLE_IPV6=true`，并确保 Docker 已启用 IPv6：

```bash
# 编辑 /etc/docker/daemon.json
{
  "ipv6": true,
  "fixed-cidr-v6": "fd00::/80"
}

# 重启 Docker
systemctl restart docker
```

---

## 部署节点

> **推荐方式**：在面板「节点管理」页面先添加节点，点击「安装」按钮，面板会自动生成已填好地址和密钥的安装命令，复制到节点服务器执行即可。

节点支持两种部署方式：

### 方式一：Docker 部署（推荐）

使用 `host` 网络模式以支持动态端口转发：

```bash
docker run -d \
  --network=host \
  --restart=unless-stopped \
  --name gost-node \
  -e PANEL_ADDR=http://<面板IP>:<面板端口> \
  -e SECRET=<节点密钥> \
  0xnetuser/gost-node:latest
```

或使用 docker-compose：

```yaml
services:
  gost-node:
    image: 0xnetuser/gost-node:latest
    container_name: gost-node
    network_mode: host
    restart: unless-stopped
    environment:
      - PANEL_ADDR=http://<面板IP>:6366
      - SECRET=<节点密钥>
```

### 方式二：脚本部署（systemd 服务）

安装脚本从面板下载，无需访问 GitHub：

```bash
curl -fsSL http://<面板IP>:<面板端口>/node-install/script -o install.sh && chmod +x install.sh && ./install.sh -a 'http://<面板IP>:<面板端口>' -s '<节点密钥>'
```

脚本提供交互式菜单：安装 / 更新 / 卸载。安装后以 systemd 服务运行，开机自启。支持 amd64 和 arm64 架构。

### 参数说明

| 参数 | 说明 | 示例 |
|------|------|------|
| `面板IP` | 面板服务器的公网 IP 或域名 | `203.0.113.1` |
| `面板端口` | 面板服务端口（默认 6366） | `6366` |
| `节点密钥` | 在面板添加节点后自动生成 | `a1b2c3d4e5f6...` |

---

## 使用指南

### GOST 转发配置

**基本流程：** 创建隧道 → 分配用户 → 创建转发规则

#### 1. 创建隧道

隧道定义了入口节点、出口节点和协议。两种类型：

- **端口转发**：入口节点直接转发到目标地址，协议固定为 TCP+UDP
- **隧道转发**：入口节点通过加密隧道连接出口节点，再由出口节点转发到目标。支持 TLS / mTLS / WSS / mWSS / QUIC / gRPC 等加密协议

#### 2. 分配隧道给用户

在隧道管理页面为用户分配隧道权限，可设置：

- **转发数量限制**：该用户在此隧道可创建的最大转发数
- **流量限制**：流量配额（MB），支持单向/双向计费
- **限速**：绑定限速规则

#### 3. 创建转发规则

| 字段 | 说明 |
|------|------|
| 监听端口 | 入口节点监听的端口 |
| 监听地址 | 可选，指定监听的 IP（支持多个，逗号分隔） |
| 目标地址 | `ip:port` 格式，支持多个（每行一个，负载均衡） |
| 出口地址 | 可选，指定出口网卡或 IP |
| 负载策略 | 轮询 / 随机 / 哈希 / 灾备切换 |

### Xray 代理配置

**基本流程：** 创建入站 → 添加客户端 → 获取订阅链接

#### 1. 创建入站

选择节点和协议后，通过结构化表单配置：

- **协议设置**：VMess / VLESS / Trojan / Shadowsocks 各自的参数
- **传输层**：TCP / WebSocket / gRPC / HTTPUpgrade / xHTTP / mKCP
- **安全层**：None / TLS（支持 ALPN、Fingerprint、SNI） / Reality（支持生成 X25519 密钥对）
- **嗅探**：HTTP / TLS / QUIC / FakeDNS

可随时点击「高级模式」切换到 JSON 编辑器，表单与 JSON 双向转换。

#### 2. 添加客户端

展开入站行即可管理客户端。每个客户端可设置：

| 字段 | 说明 |
|------|------|
| UUID/密码 | 自动生成，也可手动指定 |
| 流量限制 | 上行+下行流量配额 |
| 到期时间 | 过期后自动禁用 |
| IP 连接数限制 | 同时在线设备数 |
| 流量重置周期 | 每 N 天自动清零流量 |

#### 3. 获取订阅链接

在「订阅管理」页面获取订阅链接，导入到客户端软件（V2rayN / Clash / Shadowrocket 等）。

### 证书管理

支持两种方式：

- **手动上传**：上传 PEM 格式的证书和私钥
- **ACME 自动签发**：填写域名和 Cloudflare API Token，一键签发 Let's Encrypt 证书。到期前 30 天自动续签

### 节点管理

| 操作 | 说明 |
|------|------|
| 安装节点 | 自动生成安装命令（Docker / 脚本），复制到服务器执行 |
| 同步配置 | 手动触发全量配置对账，确保节点状态与面板一致 |
| 更新节点 | 远程推送最新节点二进制并重启 |
| 切换 Xray 版本 | 从下拉列表选择版本，远程升级/降级 |

### 状态监控

监控页面通过 WebSocket 实时显示：

- 各节点 CPU / 内存使用率
- 实时上传 / 下载速度
- 累积收发流量
- 网卡信息和 IP 地址

---

## 更新升级

### 更新面板

#### 方式一：面板内一键更新

Dashboard 顶部出现更新提示时，点击「一键更新」按钮即可自动完成。

> 面板通过 Docker Socket API 创建临时容器执行 `docker compose pull && up -d`，自动拉取新镜像并重建容器。

#### 方式二：脚本更新

```bash
curl -fsSL https://raw.githubusercontent.com/0xNetuser/flux-panel/main/panel_install.sh -o panel_install.sh && chmod +x panel_install.sh && ./panel_install.sh
```

选择「更新面板」，脚本自动拉取最新镜像并重启。

#### 方式三：手动更新

```bash
# 下载最新配置
curl -fsSL https://github.com/0xNetuser/flux-panel/releases/latest/download/docker-compose.yml -o docker-compose.yml

# 拉取最新镜像并重启
docker compose pull && docker compose up -d
```

> `.env` 配置和数据库数据保留在 Docker 卷中，无需重新配置。

### 更新节点

#### 方式一：面板远程更新

在节点管理页面点击「更新节点」按钮，面板通过 WebSocket 推送最新二进制到节点并重启。

#### 方式二：Docker 节点更新

```bash
docker stop gost-node && docker rm gost-node
docker pull 0xnetuser/gost-node:latest
docker run -d --network=host --restart=unless-stopped --name gost-node \
  -e PANEL_ADDR=http://<面板IP>:<面板端口> \
  -e SECRET=<节点密钥> \
  0xnetuser/gost-node:latest
```

#### 方式三：脚本节点更新

```bash
curl -fsSL http://<面板IP>:<面板端口>/node-install/script -o install.sh && chmod +x install.sh && ./install.sh
```

选择「更新」，脚本自动从面板下载最新二进制并重启。

---

## 环境变量

### 面板端（`.env`）

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `DB_NAME` | 是 | - | MySQL 数据库名 |
| `DB_USER` | 是 | - | MySQL 用户名 |
| `DB_PASSWORD` | 是 | - | MySQL 密码（同时用于 root） |
| `JWT_SECRET` | 是 | - | JWT 签名密钥，不设置则每次重启失效 |
| `PANEL_PORT` | 否 | `6366` | 面板访问端口 |
| `ENABLE_IPV6` | 否 | `false` | 启用 Docker 网络 IPv6 |
| `ALLOWED_ORIGINS` | 否 | `*` | CORS 允许的域名（逗号分隔） |

### 节点端

| 变量 | 必填 | 说明 |
|------|------|------|
| `PANEL_ADDR` | 是 | 面板地址，如 `http://1.2.3.4:6366` |
| `SECRET` | 是 | 节点通信密钥，面板添加节点时自动生成 |

---

## 常见问题

### 面板启动后无法访问

```bash
# 检查容器状态
docker compose ps

# 查看后端日志
docker logs go-backend

# 确认端口监听
ss -tlnp | grep 6366
```

常见原因：
- 防火墙未放行端口
- `.env` 文件配置错误
- MySQL 未就绪（等待健康检查通过）

### 节点连接不上面板

1. 确认面板地址和端口可从节点服务器访问：`curl http://<面板IP>:<端口>/flow/test`
2. 确认节点密钥正确
3. 检查节点日志：`docker logs gost-node` 或 `journalctl -u gost`

### 面板自更新失败

```bash
# 查看更新容器日志
docker logs flux-updater
```

如果容器不存在，检查 Docker Socket 挂载是否正确（`docker-compose.yml` 中 backend 需要挂载 `/var/run/docker.sock`）。

### 节点重连后转发/Xray 中断

正常情况下不会中断。面板使用 Add-first + 热更新策略：
- GOST：先尝试 AddService，已存在则用 UpdateForwarder 热更新
- Xray：先尝试热添加 inbound，如果 Xray 未运行则用 ApplyConfig 启动

如遇异常，在节点管理页面点击「同步配置」手动触发全量对账。

### 修改管理员密码

```bash
# 查看初始密码
docker logs go-backend 2>&1 | grep "密码"
```

登录后在右上角用户菜单中「修改密码」。

---

## 免责声明

本项目仅供个人学习与研究使用，基于开源项目进行二次开发。

使用本项目所带来的任何风险均由使用者自行承担，包括但不限于：

- 配置不当或使用错误导致的服务异常或不可用
- 使用本项目引发的网络攻击、封禁、滥用等行为
- 服务器因使用本项目被入侵、渗透、滥用导致的数据泄露、资源消耗或损失
- 因违反当地法律法规所产生的任何法律责任

本项目为开源的流量转发工具，仅限合法、合规用途。使用者必须确保其使用行为符合所在国家或地区的法律法规。

**作者不对因使用本项目导致的任何法律责任、经济损失或其他后果承担责任。**

**禁止将本项目用于任何违法或未经授权的行为。**

如不同意上述条款，请立即停止使用本项目。

---

## License

[Apache License 2.0](LICENSE)

---

[![Star History Chart](https://api.star-history.com/svg?repos=0xNetuser/flux-panel&type=Date)](https://www.star-history.com/#0xNetuser/flux-panel&Date)
