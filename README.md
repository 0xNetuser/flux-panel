# flux-panel 转发面板

本项目基于 [go-gost/gost](https://github.com/go-gost/gost) 和 [go-gost/x](https://github.com/go-gost/x) 两个开源库，实现了转发面板。

## 特性

- 支持按 **隧道账号级别** 管理流量转发数量，可用于用户/隧道配额控制
- 支持 **TCP** 和 **UDP** 协议的转发
- 支持两种转发模式：**端口转发** 与 **隧道转发**
- 可针对 **指定用户的指定隧道进行限速** 设置
- 支持配置 **单向或双向流量计费方式**，灵活适配不同计费模型
- 提供灵活的转发策略配置，适用于多种网络场景

---

## 部署流程

整个系统分为 **面板端**（管理后台）和 **节点端**（转发服务），需要分别部署。

---

### 第一步：部署面板端

#### 方式一：一键脚本安装（推荐新手）

脚本会自动完成下述所有步骤（下载配置文件、生成随机密码、启动服务）：

```bash
curl -L https://raw.githubusercontent.com/0xNetuser/flux-panel/refs/heads/main/panel_install.sh -o panel_install.sh && chmod +x panel_install.sh && ./panel_install.sh
```

#### 方式二：手动 Docker Compose 部署

适用于需要自定义配置或了解部署细节的用户。

**1. 下载必要文件**

```bash
# 下载 docker-compose 配置文件（二选一）
# IPv4 环境：
curl -L https://github.com/0xNetuser/flux-panel/releases/download/1.5.0/docker-compose-v4.yml -o docker-compose.yml

# IPv6 环境：
curl -L https://github.com/0xNetuser/flux-panel/releases/download/1.5.0/docker-compose-v6.yml -o docker-compose.yml

# 下载数据库初始化文件
curl -L https://github.com/0xNetuser/flux-panel/releases/download/1.5.0/gost.sql -o gost.sql
```

**2. 创建环境变量文件**

在同一目录下创建 `.env` 文件，内容如下（请自行修改密码等敏感信息）：

```env
DB_NAME=gost_db
DB_USER=gost_user
DB_PASSWORD=请替换为随机密码
JWT_SECRET=请替换为随机密码
PANEL_PORT=6366
# 可选：限制 CORS 允许的域名（逗号分隔），不设置则允许所有
# ALLOWED_ORIGINS=https://panel.example.com,http://localhost:3000
```

> 可使用 `openssl rand -base64 16` 生成随机密码。

**3. 启动服务**

```bash
docker compose up -d
```

**4. IPv6 环境额外配置**

如果使用 IPv6 版本的 docker-compose，还需要确保 Docker 已启用 IPv6 支持。编辑 `/etc/docker/daemon.json`：

```json
{
  "ipv6": true,
  "fixed-cidr-v6": "fd00::/80"
}
```

修改后重启 Docker：`systemctl restart docker`

---

#### 面板默认登录信息

| 项目 | 值 |
|------|------|
| 账号 | `admin_user` |
| 密码 | 首次启动时自动生成，请查看启动日志 |

> v1.5.0 起，首次启动会自动检测默认密码并重置为随机密码，新密码会打印在启动日志中。请使用 `docker logs go-backend` 查看。

---

### 第二步：部署节点端

> **推荐方式**：在面板「节点管理」页面先添加节点，然后点击「安装」按钮，面板会自动生成已填好面板地址和密钥的安装命令，复制到节点服务器执行即可。

节点端支持两种部署方式，任选其一：

#### 方式一：Docker 安装（推荐）

使用 `host` 网络模式以支持动态端口转发：

```bash
docker run -d --network=host --restart=unless-stopped --name gost-node \
  -e PANEL_ADDR=http://<面板IP>:<面板端口> \
  -e SECRET=<节点密钥> \
  0xnetuser/gost-node:1.5.0
```

也可以使用 docker-compose，参考项目中的 `docker-compose-node.yml`：

```yaml
services:
  gost-node:
    image: 0xnetuser/gost-node:1.5.0
    container_name: gost-node
    network_mode: host
    restart: unless-stopped
    environment:
      - PANEL_ADDR=http://面板IP:6366
      - SECRET=节点密钥
```

#### 方式二：脚本安装（裸机 systemd 服务）

安装脚本和节点二进制均从面板下载，无需访问 GitHub：

```bash
curl -fL http://<面板IP>:<面板端口>/node-install/script -o install.sh && chmod +x install.sh && ./install.sh -a 'http://<面板IP>:<面板端口>' -s '<节点密钥>'
```

- 安装后以 systemd 服务运行，开机自启
- 支持 amd64 和 arm64 架构
- 交互式菜单支持安装 / 更新 / 卸载

#### 参数说明

| 参数 | 说明 | 示例 |
|------|------|------|
| `面板IP` | 面板服务器的公网 IP 或域名 | `203.0.113.1` |
| `面板端口` | 面板服务端口（默认 `6366`） | `6366` |
| `节点密钥` | 在面板添加节点后自动生成的密钥 | `a1b2c3d4e5f6...` |

---

## 更新说明

### 更新面板端

#### 脚本部署更新

重新运行安装脚本，选择「更新面板」：

```bash
curl -L https://raw.githubusercontent.com/0xNetuser/flux-panel/refs/heads/main/panel_install.sh -o panel_install.sh && chmod +x panel_install.sh && ./panel_install.sh
```

脚本会自动拉取最新镜像、执行数据库迁移并重启服务，`.env` 配置保持不变。

#### Docker Compose 手动更新

```bash
# 下载最新 docker-compose 配置（覆盖旧文件）
# IPv4 环境：
curl -L https://github.com/0xNetuser/flux-panel/releases/download/1.5.0/docker-compose-v4.yml -o docker-compose.yml

# IPv6 环境：
curl -L https://github.com/0xNetuser/flux-panel/releases/download/1.5.0/docker-compose-v6.yml -o docker-compose.yml

# 拉取最新镜像并重启
docker compose pull && docker compose up -d
```

> `.env` 和 `gost.sql` 无需重新下载，数据库数据保留在 Docker 卷中。

---

### 更新节点端

#### Docker 部署更新

```bash
# 停止并删除旧容器
docker stop gost-node && docker rm gost-node

# 拉取最新镜像并启动
docker run -d --network=host --restart=unless-stopped --name gost-node \
  -e PANEL_ADDR=http://<面板IP>:<面板端口> \
  -e SECRET=<节点密钥> \
  0xnetuser/gost-node:1.5.0
```

如果使用 docker-compose 部署，更新 `docker-compose-node.yml` 中的镜像版本后：

```bash
docker compose pull && docker compose up -d
```

#### 脚本部署更新

重新运行安装脚本，选择「更新」：

```bash
curl -fL http://<面板IP>:<面板端口>/node-install/script -o install.sh && chmod +x install.sh && ./install.sh
```

脚本会自动从面板下载最新二进制文件并重启服务，配置文件保持不变。

---

## 更新日志

### v1.5.0

- **[High] WebSocket JWT 认证**：管理端 WebSocket 连接现在需要有效的 JWT 令牌，未认证连接将被拒绝
- **[Medium] 密码存储升级**：从 MD5+固定 salt 升级为 bcrypt，现有用户登录时自动透明迁移
- **[Medium] 默认管理员密码自动重置**：首次启动检测到默认密码时，自动生成随机密码并打印到日志
- **[Medium] JWT 默认密钥启动警告**：未设置 `JWT_SECRET` 时，启动日志会打印安全风险警告
- **[Medium] Xray 订阅短期 token**：订阅 URL 使用独立的 24 小时有效期 token，登录 JWT 不再能直接访问订阅接口
- **[Medium] Flow 上报 secret 支持 Header**：节点流量上报优先使用 `X-Node-Secret` 请求头，同时兼容 query 参数；新增 10MB 请求体大小限制
- **[Medium] CORS 可配置**：新增 `ALLOWED_ORIGINS` 环境变量，支持配置允许的跨域来源，未设置时保持允许所有
- **[Low] 节点 secret 改用 crypto/rand**：节点密钥生成从可预测的 `md5(time)` 改为密码学安全的随机数

### v1.4.7

- 后端从 Spring Boot (Java) 完全重写为 Go (Gin + GORM)，启动速度和资源占用大幅优化
- 新增 Xray 管理功能：入站配置、客户端管理、TLS 证书、订阅链接
- 新增 Next.js 前端
- 移除 Java/Maven 依赖，Docker 镜像体积大幅减小
- 所有 API 保持 100% 向后兼容

### v1.4.6

- 面板地址配置自动获取当前浏览器地址（含协议），首次部署无需手动填写
- 面板地址支持 `https://` 前缀，配合 HTTPS 部署时节点自动使用加密连接
- 更新面板地址配置描述，移除不必要的 CDN 限制

### v1.4.5

- 前端/后端合并为单一端口（`PANEL_PORT`，默认 6366），通过 Nginx 反向代理转发后端请求
- 节点端支持 HTTPS 面板地址（`use_tls` 自动检测）
- CI/CD 新增 `gost-node` 和 `gost-binary` Docker 镜像自动构建推送
- Docker 镜像仓库迁移至 `0xnetuser/`
- 节点端 `tcpkill` 替换为 `ss -K`（iproute2），解决 Alpine 不再提供 dsniff 的问题
- 后端启动时自动建表（`CREATE TABLE IF NOT EXISTS`），无需依赖 MySQL 首次初始化
- 修复 vite-frontend `npm install` 依赖冲突
- 移除 docker-compose 固定子网配置，避免网络地址冲突
- 更新所有仓库引用至 `0xNetuser/flux-panel`

### v1.4.3

- 增加节点端 Docker 部署支持（`docker-compose-node.yml`）
- 安装脚本和二进制由面板自托管，节点部署无需访问 GitHub
- 重写 README 部署文档

### v1.4.2

- 增加稳定版 ARM64 架构支持
- 修复面板显示屏蔽协议状态不一致问题
- 添加版本管理

### v1.4.1

- 添加屏蔽协议配置到面板
- 修复屏蔽协议引发的 UDP 不通问题
- 随机构造自签证书信息

---

## 免责声明

本项目仅供个人学习与研究使用，基于开源项目进行二次开发。

使用本项目所带来的任何风险均由使用者自行承担，包括但不限于：

- 配置不当或使用错误导致的服务异常或不可用；
- 使用本项目引发的网络攻击、封禁、滥用等行为；
- 服务器因使用本项目被入侵、渗透、滥用导致的数据泄露、资源消耗或损失；
- 因违反当地法律法规所产生的任何法律责任。

本项目为开源的流量转发工具，仅限合法、合规用途。
使用者必须确保其使用行为符合所在国家或地区的法律法规。

**作者不对因使用本项目导致的任何法律责任、经济损失或其他后果承担责任。**
**禁止将本项目用于任何违法或未经授权的行为，包括但不限于网络攻击、数据窃取、非法访问等。**

如不同意上述条款，请立即停止使用本项目。

[![Star History Chart](https://api.star-history.com/svg?repos=0xNetuser/flux-panel&type=Date)](https://www.star-history.com/#0xNetuser/flux-panel&Date)
