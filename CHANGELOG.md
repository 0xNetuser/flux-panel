# Changelog

## v1.8.3 — 前端修复

### Fixes

- **React Fragment key**：修复入站列表 `.map()` 中 `<>` 未设置 key 导致的 React 协调问题
- **SelectItem 空值崩溃**：修复 Flow 选择器 `value=""` 导致 Radix UI 运行时崩溃（Application error）

## v1.8.2 — 入站客户端合并 + 修复

### Features

- **入站客户端合并**：入站管理与客户端管理合并为 3x-ui 风格单页面，展开入站行即可管理客户端
- **入站表单改造**：协议设置、传输层、安全层表单全面优化
- **修改密码修复**：修复后端 confirmPassword 校验导致修改密码始终失败的问题
- **默认 Xray 版本更新**：Docker 镜像默认 Xray 从 1.8.24 更新为 25.1.30
- **Xray 版本号解析**：GetVersion() 返回纯版本号，不再返回完整命令输出

## v1.8.1 — Xray 版本远程切换

### Features

- **Xray 版本切换**：节点管理页面新增「Xray 版本切换」按钮，管理员可从面板远程升级/降级节点上的 Xray 版本，无需 SSH
- **异步下载替换**：节点从 GitHub Releases 下载指定版本 Xray 二进制，自动备份旧版本、替换、重启，支持失败自动回滚
- **实时版本显示**：节点列表 Xray 版本从 WebSocket 实时缓存读取，版本切换后自动刷新

### Changed Files

**节点端：**
- `go-gost/x/xray/manager.go` — 新增 `SwitchVersion()` 方法（下载/解压/备份/替换/回滚）
- `go-gost/x/socket/websocket_reporter.go` — 新增 `XraySwitchVersion` 命令路由

**后端：**
- `go-backend/pkg/xray.go` — 新增 `XraySwitchVersion()` WebSocket 发送函数
- `go-backend/handler/xray_node.go` — 新增 `XrayNodeSwitchVersion` handler
- `go-backend/router/router.go` — 新增 `POST /xray/node/switch-version` 路由
- `go-backend/service/node.go` — 节点列表覆盖实时 Xray 版本

**前端：**
- `nextjs-frontend/lib/api/xray-node.ts` — 新增 `switchXrayVersion` API
- `nextjs-frontend/app/(auth)/node/page.tsx` — 新增版本切换按钮和对话框

## v1.7.1 — 转发延迟图表优化

### Features

- **延迟图表改造**：转发延迟从 Table + 展开行内图表改为完整图表视图，支持多条转发同时对比
- **时间范围选择**：支持 1小时 / 6小时 / 24小时 / 7天 时间范围切换
- **转发筛选**：下拉面板多选转发，按需显示关注的转发延迟曲线
- **统计摘要**：图表下方以卡片展示各转发的最近延迟、平均延迟和成功率

## v1.7.0 — 系统配置页面优化与监控功能

### Features

- **系统配置分组**：配置页面按「基本信息」「订阅与通知」「安全与监控」分组展示，每项附带说明文字
- **配置控件优化**：布尔配置改用 Switch 开关，数字输入带单位标注，Telegram Token 密码掩码
- **延迟监控**：新增延迟监控功能，支持自定义检测间隔和数据保留天数
- **Xray 入站管理优化**
- **转发与隧道功能改进**

## v1.6.6 — 多项体验修复

### Bug Fixes

- **节点版本提示误报**：节点版本高于面板时不再显示「需更新」，改为语义化版本比较
- **节点入口IP字段丢失**：节点管理页面恢复「入口IP」列和表单字段
- **隧道转发节点校验**：隧道转发禁止入口节点和出口节点选同一个，前后端同时校验
- **转发诊断无结果**：诊断按钮原来只显示「诊断完成」toast，改为弹窗展示每段链路的连通性、延迟、丢包率和错误信息

### Changed Files

- `nextjs-frontend/app/(auth)/node/page.tsx` — 版本比较 + 入口IP字段
- `nextjs-frontend/app/(auth)/tunnel/page.tsx` — 同节点校验
- `nextjs-frontend/app/(auth)/forward/page.tsx` — 诊断结果弹窗
- `go-backend/service/tunnel.go` — 同节点校验

---

## v1.6.5 — 节点 Docker 启动修复

### Bug Fixes

- **节点容器启动失败**：`~/.flux:/etc/gost` 卷挂载覆盖整个 `/etc/gost` 目录，导致构建时 COPY 进去的 gost 二进制丢失（`exec: /etc/gost/gost: not found`）。将 gost 二进制移至 `/usr/local/bin/gost`，`/etc/gost` 仅存放配置文件

### Changed Files

- `go-gost/Dockerfile` — gost 二进制 COPY 目标改为 `/usr/local/bin/gost`
- `go-gost/docker-entrypoint.sh` — exec 路径改为 `/usr/local/bin/gost`

---

## v1.6.4 — Xray 客户端导出链接 + 二维码

### New Features

- **客户端链接导出**：客户端管理页面「复制链接」按钮现在能正确生成包含完整传输层和安全层参数的协议链接
- **二维码弹窗**：客户端操作栏新增 QR 按钮，点击弹出二维码 + 链接文本 + 复制按钮，方便手机扫码导入
- **单客户端链接 API**：新增 `POST /xray/client/link` 接口，按客户端 ID 查询并生成协议链接

### Bug Fixes

- **链接生成修复**：4 个链接生成函数 (vmess/vless/trojan/shadowsocks) 原来硬编码 `type=tcp`、无 TLS/Reality/WS 等参数，现在完整解析 `streamSettingsJson` 并写入链接
  - VLESS/Trojan：URL query 包含 type/security/sni/fp/alpn/path/host/pbk/sid/spx 等参数
  - VMess：base64 JSON 包含 net/tls/sni/fp/alpn/host/path 字段
  - Shadowsocks：method 从 `settingsJson` 读取，不再硬编码 `aes-256-gcm`
- **复制链接无效**：`handleCopyLink` 原读取 `client.link` 字段（列表 API 从不返回），改为调用后端 API 实时生成
- **隧道协议默认值**：端口转发默认协议从 `tls` 改为 `tcp+udp`，切换类型时自动重置协议（端口转发 → tcp+udp，隧道转发 → tls）

### Changed Files

**后端：**
- `go-backend/service/xray_client.go` — streamSettings/inboundSettings 解析 + 重写链接生成 + GetClientLink
- `go-backend/handler/xray_client.go` — +XrayClientLink handler
- `go-backend/router/router.go` — +`POST /xray/client/link`

**前端：**
- `nextjs-frontend/lib/api/xray-client.ts` — +getXrayClientLink API
- `nextjs-frontend/app/(auth)/xray/client/page.tsx` — 修复复制链接 + QR 弹窗
- `nextjs-frontend/app/(auth)/tunnel/page.tsx` — 端口转发/隧道转发默认协议修正

---

## v1.6.3 — 隧道协议修复

### Bug Fixes

- **隧道协议下拉框错误**：原来提供的 `tcp` / `udp` / `tcp+udp` 是传输层协议，不是 GOST 隧道协议。传入 `tcp` 作为 GOST dialer/listener 类型会导致隧道转发无法正常使用加密通道
- **默认协议不一致**：后端默认协议为 `tls`，但前端默认发送 `tcp`，导致后端默认值从未生效

### Changes

- **隧道转发协议选项**：改为 GOST 完整协议列表 — TLS / mTLS / WSS / mWSS / QUIC / gRPC / WS / mWS / KCP
- **端口转发协议显示**：固定显示 TCP+UDP（灰色禁用），因为端口转发的 `buildServices` 始终创建 TCP+UDP 双服务，协议字段无效
- **默认协议**：前端默认值从 `tcp` 改为 `tls`，与后端默认值保持一致

### Changed Files

- `nextjs-frontend/app/(auth)/tunnel/page.tsx` — 协议下拉框改造 + 端口转发禁用 + 默认值修正

---

## v1.6.2 — 节点配置自动对账 + 手动自检

### 解决的问题

- 节点离线期间面板的创建/删除/修改操作，重连后不会同步到节点
- `XrayRemoveInbound` 是空操作（只打日志不删除），已删除的入站在节点上永远残留
- WebSocket 命令因超时或网络抖动失败时，DB 已写入但节点未执行
- 现有 `CleanNodeConfigs` 只删除孤儿服务，不补齐 DB 中存在而节点缺失的服务

### New Features

- **节点上线自动对账**：节点 WebSocket 重连后延迟 2 秒自动触发全量配置同步，确保节点状态与面板 DB 一致
- **手动同步按钮**：节点管理页面新增「同步配置」按钮（RefreshCw 图标），管理员可随时手动触发配置对账，toast 显示同步结果（限速器/转发/入站/证书数量及耗时）
- **4 阶段对账逻辑**：
  1. **限速器** — 查询使用该节点的隧道 → 用户隧道的限速 ID → `AddLimiters` 幂等下发
  2. **GOST 转发** — 查询关联此节点的所有转发 → `updateGostServices`（内部 not found 自动回退 Add）→ 已暂停的转发额外调用 `PauseService`
  3. **Xray 入站** — 查询已启用入站 → `XrayApplyConfig` 全量替换
  4. **Xray 证书** — 查询节点证书 → `XrayDeployCert` 重新部署
- **并发控制**：per-node 互斥锁（`sync.Map` + `TryLock`），同一节点不会重复触发同步

### Bug Fixes

- **Xray 入站删除修复**：`DeleteXrayInbound` 从调用无效的 `XrayRemoveInbound` 改为 `syncXrayNodeConfig` 全量同步，删除的入站在节点上被真正移除

### Changed Files

**新增文件：**
- `go-backend/service/reconcile.go` — ReconcileNode 核心逻辑 + 4 个子函数 + API 包装 + 并发锁

**后端修改：**
- `go-backend/task/config_check.go` — 空函数 → 延迟 2 秒异步调用 ReconcileNode
- `go-backend/service/xray_inbound.go` — DeleteXrayInbound 用 syncXrayNodeConfig 替代 XrayRemoveInbound
- `go-backend/handler/node.go` — +NodeReconcile handler
- `go-backend/router/router.go` — +`POST /node/reconcile`（Admin）

**前端修改：**
- `nextjs-frontend/lib/api/node.ts` — +`reconcileNode` API
- `nextjs-frontend/app/(auth)/node/page.tsx` — +同步配置按钮（带 loading 旋转动画 + 结果 toast）

### Backward Compatibility

- 对账逻辑完全幂等，重复执行无副作用
- 不影响现有的 `/flow/config` 孤儿清理流程（CleanNodeConfigs 仍然独立工作）
- 节点端无需同步更新

---

## v1.6.1 — 移除 gost.sql 依赖 + DB 连接重试

### Bug Fixes

- **数据库连接重试**：后端启动时增加 30 次重试（2秒间隔），解决 Docker 容器启动顺序导致的 DNS 解析失败 (`lookup mysql: server misbehaving`)

### Changes

- **移除 gost.sql 依赖**：后端启动时自动插入默认配置 (`ensureDefaultConfig`)，Docker 部署不再需要下载 `gost.sql` 文件
- **删除移动端代码**：移除 `ios-app/`、`android-app/` 目录和 `flux.ipa`
- **CI/CD 精简**：Release 不再上传 `gost.sql`，安装脚本不再下载该文件

---

## v1.6.0 — Xray 管理完整改造

### New Features

- **入站 UI 改造**：入站配置从原始 JSON 文本框改为结构化表单，支持协议/传输层/安全层/嗅探分区 Tab 配置
- **传输层配置**：支持 TCP / WebSocket / gRPC / HTTPUpgrade / xHTTP / mKCP 全部传输协议的可视化配置，含 Headers 键值对编辑器
- **安全层配置**：支持 None / TLS / Reality 安全模式，TLS 包括 ALPN / Fingerprint / SNI / minVersion / maxVersion 参数，Reality 支持前端生成 X25519 密钥对和 ShortId
- **嗅探配置**：支持 HTTP / TLS / QUIC / FakeDNS 嗅探目标选择，metadataOnly 和 routeOnly 开关
- **高级模式**：对话框顶部可切换高级模式，直接编辑 settingsJson / streamSettingsJson / sniffingJson，表单与 JSON 双向转换
- **客户端字段扩展**：新增 IP 连接数限制 (`limitIp`)、流量自动重置周期 (`reset`，天)、Telegram ID (`tgId`)、订阅 ID (`subId`) 四个字段
- **流量自动重置**：后台定时任务每小时检查客户端 `reset` 字段，到期自动清零上下行流量计数器
- **ACME 证书签发**：集成 lego 库，支持 Let's Encrypt DNS-01 验证（Cloudflare provider），一键签发 TLS 证书并自动部署到节点
- **证书自动续签**：后台每日检查 ACME 证书，到期前 30 天自动续签
- **证书手动续签**：证书列表新增签发/续签操作按钮
- **证书 UI 改造**：创建对话框支持「手动上传」和「ACME 自动申请」Tab 切换，列表新增来源、上次续签时间、续签错误列

### Changed Files

**新增文件：**
- `go-backend/service/acme.go` — ACME 签发/续签逻辑 (lego + Cloudflare DNS-01)
- `go-backend/service/xray_scheduler.go` — Xray 定时任务 (流量重置 + 证书续签)
- `nextjs-frontend/app/(auth)/xray/inbound/_components/inbound-dialog.tsx` — 入站对话框壳 + 高级模式
- `nextjs-frontend/app/(auth)/xray/inbound/_components/protocol-settings.tsx` — 协议设置表单
- `nextjs-frontend/app/(auth)/xray/inbound/_components/transport-settings.tsx` — 传输层表单
- `nextjs-frontend/app/(auth)/xray/inbound/_components/security-settings.tsx` — 安全层表单
- `nextjs-frontend/app/(auth)/xray/inbound/_components/sniffing-settings.tsx` — 嗅探设置表单

**后端修改：**
- `go-backend/model/xray_client.go` — +4 字段 (limitIp, reset, tgId, subId)
- `go-backend/model/xray_tls_cert.go` — +6 字段 (acmeEnabled, acmeEmail, challengeType, dnsProvider, dnsConfig, lastRenewTime, renewError)
- `go-backend/dto/xray.go` — DTO 扩展 + 新增 XrayCertIssueDto / XrayCertRenewDto
- `go-backend/service/xray_client.go` — Create/Update 处理新字段，subId 自动生成
- `go-backend/service/xray_cert.go` — 新增 IssueCertificate / RenewCertificate
- `go-backend/handler/xray_cert.go` — 新增 XrayCertIssue / XrayCertRenew handler
- `go-backend/router/router.go` — +2 路由 (/xray/cert/issue, /xray/cert/renew)
- `go-backend/main.go` — 启动 XrayScheduler
- `go-backend/go.mod` — +lego v4 依赖

**前端修改：**
- `nextjs-frontend/app/(auth)/xray/inbound/page.tsx` — 重构使用 InboundDialog 组件
- `nextjs-frontend/app/(auth)/xray/client/page.tsx` — 表单+表格新增字段
- `nextjs-frontend/app/(auth)/xray/certificate/page.tsx` — ACME UI 改造
- `nextjs-frontend/lib/api/xray-cert.ts` — +issueXrayCert / renewXrayCert

### Backward Compatibility

- 数据库字段通过 GORM AutoMigrate 自动添加，无需手动迁移
- 新字段均有默认值 (0 或空字符串)，不影响现有数据
- 入站已有的 JSON 配置能被正确解析回填到结构化表单
- 节点端无需同步更新

---

## v1.5.0 — 安全加固

### Security Fixes

- **[High] WebSocket JWT 认证**：管理端 WebSocket 连接需要有效的 JWT 令牌校验，未认证连接返回 HTTP 401 拒绝升级；支持 `Sec-WebSocket-Protocol` 传递 token（避免 URL 泄露），同时兼容 query 参数
- **[Medium] 密码存储升级 MD5 → bcrypt**：密码哈希从 MD5+固定 salt 升级为 bcrypt；现有用户登录时自动透明迁移，无需手动操作
- **[Medium] 默认管理员密码自动重置**：首次启动检测到 `admin_user/admin_user` 默认密码时，自动生成 12 位随机密码并打印到启动日志
- **[Medium] JWT 默认密钥自动替换**：`JWT_SECRET` 未设置时，启动自动生成随机密钥（每次重启失效，强制用户设置持久密钥）
- **[Medium] Xray 订阅短期 token**：订阅 URL 使用独立的 24 小时有效期 JWT（scope=subscription），登录 JWT 不再能访问订阅接口
- **[Medium] Flow 上报 secret 移至 Header**：节点流量上报优先使用 `X-Node-Secret` 请求头（兼容 query 参数）；新增 10MB 请求体大小限制防止 DoS
- **[Medium] CORS 可配置**：新增 `ALLOWED_ORIGINS` 环境变量（逗号分隔），未设置时保持允许所有以兼容现有部署
- **[Low] 节点 secret 改用 crypto/rand**：节点密钥生成从可预测的 `md5(time.Now().UnixNano())` 改为 `crypto/rand` 生成 64 字符 hex

### Changed Files

**新增文件：**
- `go-backend/pkg/password.go` — bcrypt 密码哈希与校验（自动检测 bcrypt/MD5）
- `go-backend/pkg/secret.go` — 密码学安全的随机密钥生成

**后端修改：**
- `go-backend/config/config.go` — 新增 `AllowedOrigins` 配置项
- `go-backend/middleware/cors.go` — CORS 中间件支持配置域名白名单
- `go-backend/pkg/ws.go` — WebSocket JWT 认证 + Origin 校验
- `go-backend/pkg/jwt.go` — 新增 `GenerateSubToken()` / `ValidateSubToken()`
- `go-backend/handler/xray_subscription.go` — 使用短期订阅 token
- `go-backend/handler/flow.go` — Header 优先 + 请求体大小限制
- `go-backend/service/node.go` — crypto/rand 密钥生成
- `go-backend/service/user.go` — bcrypt 迁移（登录/创建/改密）
- `go-backend/main.go` — 启动安全检查

**节点端修改：**
- `go-gost/x/service/traffic_reporter.go` — 添加 `X-Node-Secret` Header
- `go-gost/x/xray/traffic_reporter.go` — 添加 `X-Node-Secret` Header

### Backward Compatibility

- `ALLOWED_ORIGINS` 为空时 CORS 保持 `*`，不影响现有部署
- 旧版 MD5 密码仍可正常登录，登录成功后自动迁移到 bcrypt
- Flow 上报 `?secret=` 查询参数继续支持
- WebSocket CheckOrigin 无 Origin Header 时（节点等非浏览器客户端）放行

### Upgrade Notes

- **必须操作**：升级后查看 `docker logs go-backend` 获取自动重置的管理员密码
- **建议操作**：设置 `JWT_SECRET` 环境变量为安全随机字符串
- **可选操作**：设置 `ALLOWED_ORIGINS` 限制跨域来源
- 节点端需同步升级到 1.5.0 以使用 Header 传递 secret（旧版节点仍兼容）

---

## v1.4.7

- 后端从 Spring Boot (Java) 完全重写为 Go (Gin + GORM)，启动速度和资源占用大幅优化
- 新增 Xray 管理功能：入站配置、客户端管理、TLS 证书、订阅链接
- 新增 Next.js 前端
- 移除 Java/Maven 依赖，Docker 镜像体积大幅减小
- 所有 API 保持 100% 向后兼容

## v1.4.6

- 面板地址配置自动获取当前浏览器地址（含协议），首次部署无需手动填写
- 面板地址支持 `https://` 前缀，配合 HTTPS 部署时节点自动使用加密连接
- 更新面板地址配置描述，移除不必要的 CDN 限制

## v1.4.5

- 前端/后端合并为单一端口（`PANEL_PORT`，默认 6366），通过 Nginx 反向代理转发后端请求
- 节点端支持 HTTPS 面板地址（`use_tls` 自动检测）
- CI/CD 新增 `gost-node` 和 `gost-binary` Docker 镜像自动构建推送
- Docker 镜像仓库迁移至 `0xnetuser/`
- 节点端 `tcpkill` 替换为 `ss -K`（iproute2），解决 Alpine 不再提供 dsniff 的问题
- 后端启动时自动建表（`CREATE TABLE IF NOT EXISTS`），无需依赖 MySQL 首次初始化
- 修复 vite-frontend `npm install` 依赖冲突
- 移除 docker-compose 固定子网配置，避免网络地址冲突
- 更新所有仓库引用至 `0xNetuser/flux-panel`

## v1.4.3

- 增加节点端 Docker 部署支持（`docker-compose-node.yml`）
- 安装脚本和二进制由面板自托管，节点部署无需访问 GitHub
- 重写 README 部署文档

## v1.4.2

- 增加稳定版 ARM64 架构支持
- 修复面板显示屏蔽协议状态不一致问题
- 添加版本管理

## v1.4.1

- 添加屏蔽协议配置到面板
- 修复屏蔽协议引发的 UDP 不通问题
- 随机构造自签证书信息
