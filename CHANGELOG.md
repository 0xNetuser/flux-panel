# Changelog

## v1.9.4 — 面板一键自更新 + 节点更新 + 多项修复

### Features

- **面板一键自更新**：Dashboard 更新 banner 新增「一键更新」按钮，后端通过 Docker Socket API 创建临时 updater 容器（`docker:latest`），挂载 `docker.sock` + 宿主机 compose 目录，执行 `docker compose pull && docker compose up -d` 完成面板自更新
- **节点一键更新**：节点管理页面新增「更新节点」按钮，后端通过 WebSocket 发送 `NodeUpdateBinary` 命令，节点从面板下载最新二进制文件替换自身并重启
- **Xray 入站自定义入口域名**：入站新增 `customEntry` 字段，配置后订阅链接使用自定义域名替代节点 IP，适用于 CDN/域名中转场景
- **节点二进制版本持久化**：Docker 节点 entrypoint 启动时检查 `/etc/gost/gost` 和 `/etc/gost/xray`，恢复之前通过远程切换版本持久化的自定义二进制
- **订阅链接管理员可见全部客户端**：管理员调用订阅链接 API 时返回所有启用客户端，不限于特定用户

### Bug Fixes

- **修复 Shadowsocks 客户端添加失败**：cipher method 为空导致 Xray 拒绝添加 Shadowsocks 客户端
- **修复侧边栏导航断连时 URL 异常**：侧边栏导航改用 Next.js `Link` 组件，避免 WebSocket 断连时 URL 变为 `localhost`
- **修复编辑 Xray 客户端 UUID/密码不生效**：编辑客户端时 UUID/密码字段更新未正确写入
- **修复节点安装二进制文件名**：`gost-node-{arch}` → `gost-{arch}`，与实际构建产物一致

### Changed Files

**后端：**
- `go-backend/service/update.go` — 新增 `SelfUpdate()` + Docker Socket API helpers（`dockerRequest`/`getHostComposeDir`）
- `go-backend/handler/system.go` — 新增 `SelfUpdate` handler
- `go-backend/handler/node.go` — 新增 `NodeUpdateBinary` handler
- `go-backend/handler/node_install.go` — 修复二进制文件名 `gost-node-{arch}` → `gost-{arch}`
- `go-backend/router/router.go` — 新增 `POST /system/update` + `POST /node/update-binary` 路由
- `go-backend/pkg/gost.go` — 新增 `NodeUpdateBinary()` WebSocket 命令
- `go-backend/service/node.go` — `getPanelAddress` → `GetPanelAddress`（导出）
- `go-backend/dto/xray.go` — 新增 `CustomEntry` 字段
- `go-backend/model/xray_inbound.go` — 新增 `custom_entry` 列
- `go-backend/service/xray_inbound.go` — Create/List/Update 处理 `customEntry`
- `go-backend/service/xray_client.go` — 订阅链接使用 `customEntry`，管理员可见全部客户端

**节点端：**
- `go-gost/docker-entrypoint.sh` — 启动时恢复持久化的 gost/xray 二进制
- `go-gost/x/socket/websocket_reporter.go` — 新增 `handleNodeUpdateBinary` 命令路由
- `go-gost/x/xray/manager.go` — Xray 版本切换持久化到 `/etc/gost/xray`

**前端：**
- `nextjs-frontend/app/(auth)/dashboard/page.tsx` — 更新 banner 添加「一键更新」按钮
- `nextjs-frontend/app/(auth)/node/page.tsx` — 新增「更新节点」按钮
- `nextjs-frontend/app/(auth)/xray/inbound/_components/inbound-dialog.tsx` — 新增 customEntry 表单字段
- `nextjs-frontend/lib/api/system.ts` — 新增 `selfUpdate` API
- `nextjs-frontend/lib/api/node.ts` — 新增 `updateNodeBinary` API

**部署：**
- `docker-compose.yml` — backend 新增 `docker.sock` + compose 目录挂载

---

## v1.9.3 — 修复 Xray/GOST 热加载格式问题

### Bug Fixes

- **修复 Xray 热加载 JSON 格式**：`xray api adi`/`adu` 命令要求 `{"inbounds": [...]}` 包装格式，之前传递裸入站对象导致 "no valid inbound found" 错误
- **修复 GOST 转发热更新失效**：`handleUpdateForwarder` 缺少 `preprocessDurationFields` 调用，`failTimeout: "600s"` 无法反序列化为 `time.Duration`，导致热更新始终失败并 fallback 到全量重建（断开连接）

---

## v1.9.0 — GOST/Xray 热加载 + 监控实时速度

### Features

- **GOST 转发热更新**：编辑转发仅修改目标地址/策略时，通过 `UpdateForwarder` 热替换 handler 的 hop 节点列表，现有连接不中断，新连接使用新目标。端口/监听 IP 变化仍走 `UpdateService` 重建 listener（仅影响该转发）
- **GOST 隧道转发热更新**：隧道转发目标地址变化时，通过 `UpdateRemoteForwarder` 热更新出口节点的 forwarder，入口节点 chain 不受影响
- **Xray 入站热加载**：创建/删除/启用/禁用入站通过 Xray gRPC API（`adi`/`rmi`）热操作，不再重启 Xray 进程；修改入站通过 remove + add 实现，仅影响该入站
- **Xray 客户端热加载**：新增/删除/修改客户端通过 Xray gRPC API（`adu`/`rmu`）热操作，其他入站连接不受影响
- **监控实时速度**：监控页通过 WebSocket 接收节点 `bytes_received`/`bytes_transmitted` 累积值，前端计算 delta 速度，每 2-3 秒自动更新

### Bug Fixes

- **XrayRemoveClient 错误处理**：`UpdateXrayClient` 中删除旧客户端失败时正确回退 DB，避免在节点离线时产生不一致状态
- **字节计数器重置处理**：监控页 WebSocket 收到的字节计数器降低（节点重启）时，速度重置为 0 而非冻结在上一个值

### Changed Files

**节点端（go-gost）：**
- `x/service/service.go` — 新增 `Handler()` getter
- `x/config/parsing/service/parse.go` — 导出 `ParseForwarder`
- `x/socket/service.go` — 新增 `updateForwarder` 函数
- `x/socket/websocket_reporter.go` — 新增 `UpdateForwarder` 命令 + Xray Hot* handler 路由
- `x/xray/grpc_client.go` — 实现 `AddUser`/`RemoveUser`/`AddInbound`/`RemoveInbound` CLI 调用
- `x/xray/manager.go` — 新增 `HotAddInbound`/`HotRemoveInbound`/`HotAddUser`/`HotRemoveUser` + `updateConfigFile`

**后端（go-backend）：**
- `pkg/gost.go` — 新增 `UpdateForwarder`/`UpdateRemoteForwarder`
- `service/forward.go` — 智能判断热更新/重建路径
- `service/xray_inbound.go` — CRUD 改用热加载
- `service/xray_client.go` — CRUD 改用热加载 + RemoveClient 错误检查
- `service/monitor.go` — 返回 `bytesReceived`/`bytesTransmitted`
- `service/user_tunnel.go` — 保留 `UpdateService`（limiter 需重建）

**前端：**
- `app/(auth)/monitor/page.tsx` — WebSocket 实时速度 + 总流量显示

---

## v1.8.8 — 流量统计全面修复 + 同步回退 + 操作加载态

### Bug Fixes

- **GOST 流量上报不执行**：`observeStats()` 在 `observer == nil` 时直接 return，而 "console" observer 从未注册到 registry，导致所有 GOST 服务的流量上报完全不执行。去掉 nil 判断提前返回，流量上报与 observer 解耦
- **Xray 流量上报不启动**：`StartXrayTrafficReporter()` 检查 `xrayManager == nil` 后返回，但 `InitXray()` 从未被调用。改用 `getOrInitXrayManager()` 懒初始化
- **流量数据无法写入数据库**：`flow.go` 中所有原子递增使用 `DB.Raw("col + ?", val)`，GORM v2 下 `DB.Raw()` 返回 `*gorm.DB` 对象而非 SQL 表达式，导致 UpdateColumns 静默失败。全部替换为 `gorm.Expr()`
- **Xray 同步失败 DB 不回退**：Create/Update/Delete/Enable/Disable 入站及客户端操作，同步节点失败时 DB 变更未撤销。新增完整回退逻辑

### Features

- **操作加载状态**：入站创建/编辑对话框显示"同步中..."并禁止操作；删除/启用/禁用按钮显示 Loader2 动画并禁止重复点击
- **流量处理日志**：`ProcessFlowUpload` 和 `ProcessXrayFlowUpload` 新增详细日志，便于排查上报问题

### Changed Files

**节点端：**
- `go-gost/x/service/service.go` — `observeStats` 去掉 observer nil 提前返回，observer 事件单独守卫
- `go-gost/x/socket/websocket_reporter.go` — `StartXrayTrafficReporter` 使用 `getOrInitXrayManager()`

**后端：**
- `go-backend/service/flow.go` — `DB.Raw` → `gorm.Expr`，新增日志
- `go-backend/service/xray_inbound.go` — Create/Update/Delete/Enable/Disable 同步失败时 DB 回退
- `go-backend/service/xray_client.go` — Create/Update/Delete 同步失败时 DB 回退

**前端：**
- `nextjs-frontend/app/(auth)/xray/inbound/page.tsx` — submitting + operatingIds 加载态
- `nextjs-frontend/app/(auth)/xray/inbound/_components/inbound-dialog.tsx` — submitting prop + 按钮禁用

---

## v1.8.7 — Xray 配置同步回退 + 流量统计修复 + 限速绑定隧道

### Features

- **Xray 配置同步自动回退**：节点端 `ApplyConfig` 新增备份→验证→回退机制，写入新配置后等待 2 秒验证 Xray 进程存活，启动失败或崩溃时自动恢复旧配置并重启
- **同步错误前端上报**：Xray 入站/客户端的 CRUD 操作，同步失败时前端 `toast.warning` 显示警告信息（DB 操作不受影响，Code 仍为 0）
- **限速规则绑定隧道**：限速创建表单新增隧道选择器下拉框，限速列表新增隧道名称列
- **Xray 流量统计**：实现基于 CLI 的 Xray 流量查询（`xray api statsquery -s addr -pattern user -reset`），解析 text-proto 输出，启动 30 秒定时上报
- **GOST 流量上报修复**：修复 `observeStats` 中 observer 失败时 `continue` 跳过流量上报的 bug，流量上报与 observer 解耦
- **新建入站嗅探默认关闭**：`inbound-dialog.tsx` 嗅探初始状态和重置逻辑均改为 `enabled: false`

### Bug Fixes

- **UpdateXrayClient 零 NodeId**：查询 inbound 失败时 `inbound.NodeId` 为零值，导致 `syncXrayNodeConfig(0)` 无意义调用。添加 `if inbound.ID > 0` 守卫
- **SpeedLimitDto TunnelId 校验**：`TunnelId` 字段缺少 `binding:"required"` 标签，允许创建不绑定隧道的限速规则
- **syncXrayNodeConfig 守卫**：新增 `if nodeId <= 0 { return "" }` 防止无效节点 ID 触发同步
- **reconcile 客户端合并**：`reconcileXrayInbounds` 缺少 `mergeClientsIntoSettings` 调用，导致对账同步的配置不包含客户端
- **Xray gRPC client 占位符**：`queryStatsRaw` 原为占位符返回 nil，`StartXrayTrafficReporter` 从未被调用。完整实现并在启动时注册

### Changed Files

**节点端：**
- `go-gost/x/xray/manager.go` — ApplyConfig 备份/验证/回退 + `GetBinaryPath()` 方法
- `go-gost/x/xray/grpc_client.go` — 重写为 CLI 方式查询流量统计
- `go-gost/x/xray/traffic_reporter.go` — `NewTrafficReporter` 接受 `binaryPath` 参数
- `go-gost/x/service/service.go` — 移除 observer 失败时的 `continue`，解耦流量上报
- `go-gost/x/socket/websocket_reporter.go` — `StartXrayTrafficReporter` 传递 binary path
- `go-gost/main.go` — 启动时调用 `StartXrayTrafficReporter`

**后端：**
- `go-backend/service/xray_inbound.go` — `syncXrayNodeConfig` 返回错误字符串 + nodeId 守卫 + CRUD 传递同步错误
- `go-backend/service/xray_client.go` — Create/Update/Delete 传递同步错误 + UpdateXrayClient NodeId 守卫
- `go-backend/service/reconcile.go` — 添加 `mergeClientsIntoSettings` 调用
- `go-backend/dto/speed_limit.go` — TunnelId 添加 `binding:"required"`

**前端：**
- `nextjs-frontend/app/(auth)/xray/inbound/page.tsx` — handleSubmit/handleDelete/handleToggleEnable 显示同步警告 toast
- `nextjs-frontend/app/(auth)/xray/inbound/_components/inbound-dialog.tsx` — 嗅探默认关闭
- `nextjs-frontend/app/(auth)/limit/page.tsx` — 重写：添加隧道选择器和隧道列

---

## v1.8.6 — Xray 版本下拉选择 + 自动刷新 + 转发延迟显示

### Features

- **Xray 版本下拉选择**：切换 Xray 版本从手动输入改为下拉选择，后端请求 GitHub Releases API 获取可用版本列表（带 5 分钟内存缓存），前端展示版本号和发布日期，当前版本标注 `(当前)`，获取失败时 fallback 回手动输入
- **转发延迟显示**：转发管理表格新增「延迟」列，显示每条转发的最新延迟（绿色 <200ms / 橙色 200-500ms / 红色 >500ms / 超时），数据来自延迟监控 API
- **转发管理自动刷新**：转发列表和延迟数据每 30 秒自动刷新
- **节点管理自动刷新**：节点列表每 30 秒自动刷新，首次加载后静默更新不显示 loading
- **监控重命名**：侧边栏「监控」更名为「状态监控」，页面标题同步更新

### Changed Files

**后端：**
- `go-backend/handler/xray_node.go` — 新增 `XrayNodeVersions` handler（GitHub API + 缓存）
- `go-backend/router/router.go` — 新增 `GET /xray/node/versions` 路由

**前端：**
- `nextjs-frontend/lib/api/xray-node.ts` — 新增 `getXrayVersions` API
- `nextjs-frontend/app/(auth)/node/page.tsx` — Xray 版本切换改为 Select 下拉 + 30 秒自动刷新
- `nextjs-frontend/app/(auth)/forward/page.tsx` — 新增延迟列 + 30 秒自动刷新
- `nextjs-frontend/app/(auth)/monitor/page.tsx` — 页面标题改为「状态监控」
- `nextjs-frontend/app/(auth)/layout.tsx` — 侧边栏「监控」改为「状态监控」

## v1.8.5 — 修复 VLESS 客户端注入

### Fixes

- **修复 VLESS "invalid request user id"**：客户端 UUID 未注入到 Xray 配置导致连接失败
- **自动生成 inbound tag**：创建入站时 tag 为空自动生成 `inbound-{id}`，避免空 tag 导致同步异常
- **客户端合并到全量同步**：`syncXrayNodeConfig` 从 `xray_client` 表查询启用客户端并合并到 `settingsJson`，替代无效的 gRPC addUser
- **统一使用全量同步**：创建/删除/启禁客户端均改为 `syncXrayNodeConfig`，不再依赖空操作的 gRPC 调用

## v1.8.4 — 入站表单 UI 优化

### Features

- **3x-ui 风格表单**：入站配置表单从 Tab 切换改为单页顺序排列，所有设置区域从上到下依次排列，无需切换标签页
- **配置项提示**：每个配置字段旁增加 Tip 图标，鼠标悬浮显示该配置的中文说明
- **嗅探默认值对齐 3x-ui**：destOverride 默认包含 http/tls/quic/fakedns，routeOnly 默认开启

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
