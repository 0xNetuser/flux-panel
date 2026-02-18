# flux-panel转发面板 哆啦A梦转发面板

## 项目更新说明
由于一些个人原因，**flux-panel** 将暂停更新一段时间，**恢复更新时间暂不确定**。

在此期间，项目不会继续推进新功能或修复问题，对可能带来的不便表示抱歉。当前已有功能仍可正常使用，也欢迎大家继续 Fork 或自行维护。

如后续恢复更新，我会第一时间在仓库中说明。  
感谢大家的理解与支持。


# 赞助商
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


## 部署流程
---
### Docker Compose部署
#### 快速部署
面板端(稳定版)：
```bash
curl -L https://raw.githubusercontent.com/bqlpfy/flux-panel/refs/heads/main/panel_install.sh -o panel_install.sh && chmod +x panel_install.sh && ./panel_install.sh
```

面板端(开发版)：
```bash
curl -L https://raw.githubusercontent.com/bqlpfy/flux-panel/refs/heads/beta/panel_install.sh -o panel_install.sh && chmod +x panel_install.sh && ./panel_install.sh
```

节点端安装（安装完面板后，在面板「节点管理」页面点击「安装」按钮可直接获取已填好参数的命令）：

脚本安装：
```bash
curl -fL http://面板IP:6365/node-install/script -o install.sh && chmod +x install.sh && ./install.sh -a http://面板IP:6365 -s 节点密钥
```

Docker安装：
```bash
docker run -d --network=host --restart=unless-stopped --name gost-node \
  -e PANEL_ADDR=http://面板IP:6365 \
  -e SECRET=节点密钥 \
  bqlpfy/gost-node:1.4.3
```

> 脚本和节点二进制均由面板托管，无需访问 GitHub。面板部署后需将节点二进制文件（gost-amd64/gost-arm64）放入 `node_binary` 卷中。

#### 默认管理员账号

- **账号**: admin_user
- **密码**: admin_user

> ⚠️ 首次登录后请立即修改默认密码！


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
## ⭐ 喝杯咖啡！（USDT）

| 网络       | 地址                                                                 |
|------------|----------------------------------------------------------------------|
| BNB(BEP20) | `0x755492c03728851bbf855daa28a1e089f9aca4d1`                          |
| TRC20      | `TYh2L3xxXpuJhAcBWnt3yiiADiCSJLgUm7`                                  |
| Aptos      | `0xf2f9fb14749457748506a8281628d556e8540d1eb586d202cd8b02b99d369ef8`  |

[![Star History Chart](https://api.star-history.com/svg?repos=bqlpfy/flux-panel&type=Date)](https://www.star-history.com/#bqlpfy/flux-panel&Date)

