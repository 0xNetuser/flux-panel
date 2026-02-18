# flux-panel 转发面板（哆啦A梦转发面板）

## 项目更新说明
由于一些个人原因，**flux-panel** 将暂停更新一段时间，**恢复更新时间暂不确定**。

在此期间，项目不会继续推进新功能或修复问题，对可能带来的不便表示抱歉。当前已有功能仍可正常使用，也欢迎大家继续 Fork 或自行维护。

如后续恢复更新，我会第一时间在仓库中说明。
感谢大家的理解与支持。

## 赞助商
<p align="center">
  <a href="https://vps.town" style="margin: 0 20px; text-align:center;">
    <img src="./doc/vpstown.png" width="300">
  </a>

  <a href="https://whmcs.as211392.com" style="margin: 0 20px; text-align:center;">
    <img src="./doc/as211392.png" width="300">
  </a>
</p>

本项目基于 [go-gost/gost](https://github.com/go-gost/gost) 和 [go-gost/x](https://github.com/go-gost/x) 两个开源库，实现了转发面板。

---

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

### 第一步：部署面板端

面板端通过一键脚本安装，会自动拉取 Docker 镜像并启动所有服务（MySQL + 后端 + 前端 + 节点二进制编译）。

稳定版：
```bash
curl -L https://raw.githubusercontent.com/bqlpfy/flux-panel/refs/heads/main/panel_install.sh -o panel_install.sh && chmod +x panel_install.sh && ./panel_install.sh
```

开发版：
```bash
curl -L https://raw.githubusercontent.com/bqlpfy/flux-panel/refs/heads/beta/panel_install.sh -o panel_install.sh && chmod +x panel_install.sh && ./panel_install.sh
```

安装完成后，使用以下默认账号登录面板：

| 项目 | 值 |
|------|------|
| 账号 | `admin_user` |
| 密码 | `admin_user` |

> 首次登录后请立即修改默认密码！

### 第二步：部署节点端

> 推荐方式：在面板「节点管理」页面先添加节点，然后点击「安装」按钮，面板会自动生成已填好面板地址和密钥的安装命令，复制到节点服务器执行即可。

节点端支持两种部署方式，任选其一：

#### 方式一：脚本安装（裸机 systemd 服务）

适用于不使用 Docker 的服务器。安装脚本和节点二进制均从面板下载，无需访问 GitHub。

```bash
curl -fL http://<面板IP>:<后端端口>/node-install/script -o install.sh && chmod +x install.sh && ./install.sh -a 'http://<面板IP>:<后端端口>' -s '<节点密钥>'
```

- 安装后以 systemd 服务运行，开机自启
- 支持 amd64 和 arm64 架构
- 交互式菜单支持安装 / 更新 / 卸载

#### 方式二：Docker 安装（推荐）

适用于已安装 Docker 的服务器。使用 `host` 网络模式以支持动态端口转发。

```bash
docker run -d --network=host --restart=unless-stopped --name gost-node \
  -e PANEL_ADDR=http://<面板IP>:<后端端口> \
  -e SECRET=<节点密钥> \
  bqlpfy/gost-node:1.4.3
```

如果需要使用 docker-compose，可参考项目中的 `docker-compose-node.yml` 模板。

**参数说明：**

| 参数 | 说明 | 示例 |
|------|------|------|
| `面板IP` | 面板服务器的公网 IP 或域名 | `203.0.113.1` |
| `后端端口` | 面板后端服务端口（安装时设置，默认 `6365`） | `6365` |
| `节点密钥` | 在面板添加节点后自动生成的密钥 | `a1b2c3d4e5f6...` |

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

作者对因使用本项目所造成的任何直接或间接损失概不负责，亦不提供任何形式的担保、承诺或技术支持。

请务必在合法、合规、安全的前提下使用本项目。

---
## 喝杯咖啡！（USDT）

| 网络       | 地址                                                                 |
|------------|----------------------------------------------------------------------|
| BNB(BEP20) | `0x755492c03728851bbf855daa28a1e089f9aca4d1`                          |
| TRC20      | `TYh2L3xxXpuJhAcBWnt3yiiADiCSJLgUm7`                                  |
| Aptos      | `0xf2f9fb14749457748506a8281628d556e8540d1eb586d202cd8b02b99d369ef8`  |

[![Star History Chart](https://api.star-history.com/svg?repos=bqlpfy/flux-panel&type=Date)](https://www.star-history.com/#bqlpfy/flux-panel&Date)
