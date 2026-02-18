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
curl -L https://github.com/0xNetuser/flux-panel/releases/download/1.4.4/docker-compose-v4.yml -o docker-compose.yml

# IPv6 环境：
curl -L https://github.com/0xNetuser/flux-panel/releases/download/1.4.4/docker-compose-v6.yml -o docker-compose.yml

# 下载数据库初始化文件
curl -L https://github.com/0xNetuser/flux-panel/releases/download/1.4.4/gost.sql -o gost.sql
```

**2. 创建环境变量文件**

在同一目录下创建 `.env` 文件，内容如下（请自行修改密码等敏感信息）：

```env
DB_NAME=gost_db
DB_USER=gost_user
DB_PASSWORD=请替换为随机密码
JWT_SECRET=请替换为随机密码
FRONTEND_PORT=6366
BACKEND_PORT=6365
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
| 密码 | `admin_user` |

> 首次登录后请立即修改默认密码！

---

### 第二步：部署节点端

> **推荐方式**：在面板「节点管理」页面先添加节点，然后点击「安装」按钮，面板会自动生成已填好面板地址和密钥的安装命令，复制到节点服务器执行即可。

节点端支持两种部署方式，任选其一：

#### 方式一：Docker 安装（推荐）

使用 `host` 网络模式以支持动态端口转发：

```bash
docker run -d --network=host --restart=unless-stopped --name gost-node \
  -e PANEL_ADDR=http://<面板IP>:<后端端口> \
  -e SECRET=<节点密钥> \
  0xnetuser/gost-node:1.4.4
```

也可以使用 docker-compose，参考项目中的 `docker-compose-node.yml`：

```yaml
services:
  gost-node:
    image: 0xnetuser/gost-node:1.4.4
    container_name: gost-node
    network_mode: host
    restart: unless-stopped
    environment:
      - PANEL_ADDR=http://面板IP:6365
      - SECRET=节点密钥
```

#### 方式二：脚本安装（裸机 systemd 服务）

安装脚本和节点二进制均从面板下载，无需访问 GitHub：

```bash
curl -fL http://<面板IP>:<后端端口>/node-install/script -o install.sh && chmod +x install.sh && ./install.sh -a 'http://<面板IP>:<后端端口>' -s '<节点密钥>'
```

- 安装后以 systemd 服务运行，开机自启
- 支持 amd64 和 arm64 架构
- 交互式菜单支持安装 / 更新 / 卸载

#### 参数说明

| 参数 | 说明 | 示例 |
|------|------|------|
| `面板IP` | 面板服务器的公网 IP 或域名 | `203.0.113.1` |
| `后端端口` | 面板后端服务端口（默认 `6365`） | `6365` |
| `节点密钥` | 在面板添加节点后自动生成的密钥 | `a1b2c3d4e5f6...` |

---

## 更新日志

### v1.4.4

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
