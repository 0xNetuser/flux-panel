# Changelog

## v1.5.0 — 安全加固

### Security Fixes

- **[High] WebSocket JWT 认证**：管理端 WebSocket 连接需要有效的 JWT 令牌校验，未认证连接返回 HTTP 401 拒绝升级
- **[Medium] 密码存储升级 MD5 → bcrypt**：密码哈希从 MD5+固定 salt 升级为 bcrypt；现有用户登录时自动透明迁移，无需手动操作
- **[Medium] 默认管理员密码自动重置**：首次启动检测到 `admin_user/admin_user` 默认密码时，自动生成 12 位随机密码并打印到启动日志
- **[Medium] JWT 默认密钥启动警告**：`JWT_SECRET` 未设置时，启动日志打印 WARNING 提醒
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
