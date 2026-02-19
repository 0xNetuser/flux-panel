package service

import (
	"fmt"
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/model"
	"flux-panel/go-backend/pkg"
	"log"
	"time"
)

// ---------------------------------------------------------------------------
// Package-level DTO types used by the user service
// ---------------------------------------------------------------------------

// UserPackageDto aggregates all user-package related information.
type UserPackageDto struct {
	UserInfo          UserInfoDto            `json:"userInfo"`
	TunnelPermissions []UserTunnelDetailDto  `json:"tunnelPermissions"`
	Forwards          []UserForwardDetailDto `json:"forwards"`
	StatisticsFlows   []model.StatisticsFlow `json:"statisticsFlows"`
}

// UserInfoDto mirrors model.User but excludes the password field.
type UserInfoDto struct {
	ID            int64  `json:"id"`
	User          string `json:"user"`
	Status        int    `json:"status"`
	Flow          int64  `json:"flow"`
	InFlow        int64  `json:"inFlow"`
	OutFlow       int64  `json:"outFlow"`
	Num           int    `json:"num"`
	ExpTime       int64  `json:"expTime"`
	FlowResetTime int64  `json:"flowResetTime"`
	CreatedTime   int64  `json:"createdTime"`
	UpdatedTime   int64  `json:"updatedTime"`
}

// UserTunnelDetailDto contains user_tunnel fields joined with tunnel and speed_limit info.
type UserTunnelDetailDto struct {
	ID             int64  `json:"id"             gorm:"column:id"`
	UserId         int64  `json:"userId"         gorm:"column:userId"`
	TunnelId       int64  `json:"tunnelId"       gorm:"column:tunnelId"`
	TunnelName     string `json:"tunnelName"     gorm:"column:tunnelName"`
	TunnelFlow     int    `json:"tunnelFlow"     gorm:"column:tunnelFlow"`
	Flow           int64  `json:"flow"           gorm:"column:flow"`
	InFlow         int64  `json:"inFlow"         gorm:"column:inFlow"`
	OutFlow        int64  `json:"outFlow"        gorm:"column:outFlow"`
	Num            int    `json:"num"            gorm:"column:num"`
	FlowResetTime  int64  `json:"flowResetTime"  gorm:"column:flowResetTime"`
	ExpTime        int64  `json:"expTime"        gorm:"column:expTime"`
	SpeedId        *int64 `json:"speedId"        gorm:"column:speedId"`
	SpeedLimitName string `json:"speedLimitName" gorm:"column:speedLimitName"`
	Speed          *int   `json:"speed"          gorm:"column:speed"`
}

// UserForwardDetailDto contains forward fields joined with tunnel info.
type UserForwardDetailDto struct {
	ID          int64  `json:"id"          gorm:"column:id"`
	Name        string `json:"name"        gorm:"column:name"`
	TunnelId    int64  `json:"tunnelId"    gorm:"column:tunnelId"`
	TunnelName  string `json:"tunnelName"  gorm:"column:tunnelName"`
	InIp        string `json:"inIp"        gorm:"column:inIp"`
	InPort      int    `json:"inPort"      gorm:"column:inPort"`
	RemoteAddr  string `json:"remoteAddr"  gorm:"column:remoteAddr"`
	InFlow      int64  `json:"inFlow"      gorm:"column:inFlow"`
	OutFlow     int64  `json:"outFlow"     gorm:"column:outFlow"`
	Status      int    `json:"status"      gorm:"column:status"`
	CreatedTime int64  `json:"createdTime" gorm:"column:createdTime"`
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const (
	adminRoleID  = 0
	userRoleID   = 1
	statusActive = 1

	defaultUsername = "admin_user"
	defaultPassword = "admin_user"
)

// ---------------------------------------------------------------------------
// Login authenticates a user and returns a JWT token.
// ---------------------------------------------------------------------------

func Login(d dto.LoginDto) dto.R {
	// 1. Check captcha if enabled
	var vc model.ViteConfig
	if err := DB.Where("name = ?", "captcha_enabled").First(&vc).Error; err == nil {
		if vc.Value == "true" {
			if d.CaptchaId == "" || d.CaptchaAnswer == "" {
				return dto.Err("请完成验证码")
			}
			if !captchaStore.Verify(d.CaptchaId, d.CaptchaAnswer, true) {
				return dto.Err("验证码错误")
			}
		}
	}

	// 2. Find user by username
	var user model.User
	if err := DB.Where("user = ?", d.Username).First(&user).Error; err != nil {
		return dto.Err("账号或密码错误")
	}

	// 3. Verify password (supports both bcrypt and legacy MD5)
	if !pkg.CheckPassword(d.Password, user.Pwd) {
		return dto.Err("账号或密码错误")
	}

	// 3.5 Transparent migration: if password is still MD5, upgrade to bcrypt
	if !pkg.IsBcrypt(user.Pwd) {
		if newHash := pkg.HashPassword(d.Password); newHash != "" {
			DB.Model(&model.User{}).Where("id = ?", user.ID).Update("pwd", newHash)
			log.Printf("User %s password migrated from MD5 to bcrypt", user.User)
		}
	}

	// 4. Check account status
	if user.Status == 0 {
		return dto.Err("账户停用")
	}

	// 5. Generate JWT
	token, err := pkg.GenerateToken(&user)
	if err != nil {
		return dto.Err("生成令牌失败")
	}

	// 6. Check default credentials
	requirePasswordChange := d.Username == defaultUsername || d.Password == defaultPassword

	return dto.Ok(map[string]interface{}{
		"token":                 token,
		"name":                  user.User,
		"role_id":               user.RoleId,
		"requirePasswordChange": requirePasswordChange,
	})
}

// ---------------------------------------------------------------------------
// CreateUser creates a new user after validating username uniqueness.
// ---------------------------------------------------------------------------

func CreateUser(d dto.UserDto) dto.R {
	// 0. Validate password length
	if len(d.Pwd) < 8 {
		return dto.Err("密码长度至少8位")
	}

	// 1. Check username uniqueness
	var count int64
	DB.Model(&model.User{}).Where("user = ?", d.User).Count(&count)
	if count > 0 {
		return dto.Err("用户名已存在")
	}

	// 2. Build user entity
	now := time.Now().UnixMilli()
	status := statusActive
	if d.Status != nil {
		status = *d.Status
	}

	user := model.User{
		User:          d.User,
		Pwd:           pkg.HashPassword(d.Pwd),
		RoleId:        userRoleID,
		Flow:          d.Flow,
		Num:           d.Num,
		ExpTime:       d.ExpTime,
		FlowResetTime: d.FlowResetTime,
		Status:        status,
		CreatedTime:   now,
		UpdatedTime:   now,
	}

	// 3. Save
	if err := DB.Create(&user).Error; err != nil {
		return dto.Err("用户创建失败")
	}

	return dto.Ok("用户创建成功")
}

// ---------------------------------------------------------------------------
// GetAllUsers returns all non-admin users.
// ---------------------------------------------------------------------------

func GetAllUsers() dto.R {
	var users []model.User
	DB.Where("role_id != ?", adminRoleID).Find(&users)
	// Strip password hashes from response
	for i := range users {
		users[i].Pwd = ""
	}
	return dto.Ok(users)
}

// ---------------------------------------------------------------------------
// UpdateUser updates an existing non-admin user.
// ---------------------------------------------------------------------------

func UpdateUser(d dto.UserUpdateDto) dto.R {
	// 1. Check user exists
	var user model.User
	if err := DB.First(&user, d.ID).Error; err != nil {
		return dto.Err("用户不存在")
	}

	// 2. Cannot modify admin
	if user.RoleId == adminRoleID {
		return dto.Err("不能修改管理员用户信息")
	}

	// 3. Check username uniqueness excluding self
	var count int64
	DB.Model(&model.User{}).Where("user = ? AND id != ?", d.User, d.ID).Count(&count)
	if count > 0 {
		return dto.Err("用户名已被其他用户使用")
	}

	// 4. Build update map (use map so GORM updates zero-value fields too)
	updates := map[string]interface{}{
		"user":            d.User,
		"flow":            d.Flow,
		"num":             d.Num,
		"exp_time":        d.ExpTime,
		"flow_reset_time": d.FlowResetTime,
		"updated_time":    time.Now().UnixMilli(),
	}
	if d.Status != nil {
		updates["status"] = *d.Status
	}
	if d.Pwd != "" {
		if len(d.Pwd) < 8 {
			return dto.Err("密码长度至少8位")
		}
		updates["pwd"] = pkg.HashPassword(d.Pwd)
	}

	if err := DB.Model(&model.User{}).Where("id = ?", d.ID).Updates(updates).Error; err != nil {
		return dto.Err("用户更新失败")
	}

	return dto.Ok("用户更新成功")
}

// ---------------------------------------------------------------------------
// DeleteUser removes a user and cascade-deletes all related data.
// ---------------------------------------------------------------------------

func DeleteUser(id int64) dto.R {
	// 1. Validate user exists
	var user model.User
	if err := DB.First(&user, id).Error; err != nil {
		return dto.Err("用户不存在")
	}

	// 2. Cannot delete admin
	if user.RoleId == adminRoleID {
		return dto.Err("不能删除管理员用户")
	}

	// 3. Cascade delete forwards and related gost services
	var forwards []model.Forward
	DB.Where("user_id = ?", id).Find(&forwards)

	for _, fwd := range forwards {
		func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("删除用户转发对应的Gost服务失败，转发ID: %d, 错误: %v", fwd.ID, r)
				}
			}()
			deleteGostServicesForForward(&fwd, id)
		}()

		// Delete the forward record
		DB.Delete(&model.Forward{}, fwd.ID)
	}

	// 4. Delete user_tunnel records
	DB.Where("user_id = ?", id).Delete(&model.UserTunnel{})

	// 5. Delete statistics_flow records
	DB.Where("user_id = ?", id).Delete(&model.StatisticsFlow{})

	// 6. Delete the user
	if err := DB.Delete(&model.User{}, id).Error; err != nil {
		return dto.Err("用户删除失败")
	}

	return dto.Ok("用户及关联数据删除成功")
}

// deleteGostServicesForForward removes gost services tied to a specific forward.
func deleteGostServicesForForward(fwd *model.Forward, userId int64) {
	var tunnel model.Tunnel
	if err := DB.First(&tunnel, fwd.TunnelId).Error; err != nil {
		return
	}

	var inNode model.Node
	if err := DB.First(&inNode, tunnel.InNodeId).Error; err != nil {
		return
	}

	// Locate the user-tunnel relation
	var ut model.UserTunnel
	if err := DB.Where("user_id = ? AND tunnel_id = ?", userId, tunnel.ID).First(&ut).Error; err != nil {
		return
	}

	serviceName := fmt.Sprintf("%d_%d_%d", fwd.ID, userId, ut.ID)

	// Delete main service on the in-node
	pkg.DeleteService(inNode.ID, serviceName)

	// For tunnel-forward type, also clean up chains and remote service
	if tunnel.Type == tunnelTypeTunnelForward {
		var outNode model.Node
		if err := DB.First(&outNode, tunnel.OutNodeId).Error; err == nil {
			pkg.DeleteChains(inNode.ID, serviceName)
			pkg.DeleteRemoteService(outNode.ID, serviceName)
		}
	}
}

// ---------------------------------------------------------------------------
// GetUserPackageInfo returns aggregated package info for a user.
// ---------------------------------------------------------------------------

func GetUserPackageInfo(userId int64, roleId int) dto.R {
	// 1. Get user
	var user model.User
	if err := DB.First(&user, userId).Error; err != nil {
		return dto.Err("用户不存在")
	}

	// 2. Build user info (without password)
	userInfo := UserInfoDto{
		ID:            user.ID,
		User:          user.User,
		Status:        user.Status,
		Flow:          user.Flow,
		InFlow:        user.InFlow,
		OutFlow:       user.OutFlow,
		Num:           user.Num,
		ExpTime:       user.ExpTime,
		FlowResetTime: user.FlowResetTime,
		CreatedTime:   user.CreatedTime,
		UpdatedTime:   user.UpdatedTime,
	}

	// 3. Get tunnel permissions via JOIN
	var tunnelPerms []UserTunnelDetailDto
	if roleId == adminRoleID {
		// Admin sees all tunnels with unlimited quotas
		DB.Raw(`SELECT
				t.id,
				0 as userId,
				t.id as tunnelId,
				t.name as tunnelName,
				t.flow as tunnelFlow,
				99999 as flow,
				0 as inFlow,
				0 as outFlow,
				99999 as num,
				NULL as flowResetTime,
				NULL as expTime,
				NULL as speedId,
				'无限制' as speedLimitName,
				NULL as speed
			FROM tunnel t
			WHERE t.status = 1
			ORDER BY t.id`).Scan(&tunnelPerms)
	} else {
		DB.Raw(`SELECT
				ut.id,
				ut.user_id as userId,
				ut.tunnel_id as tunnelId,
				t.name as tunnelName,
				t.flow as tunnelFlow,
				ut.flow,
				ut.in_flow as inFlow,
				ut.out_flow as outFlow,
				ut.num,
				ut.flow_reset_time as flowResetTime,
				ut.exp_time as expTime,
				ut.speed_id as speedId,
				sl.name as speedLimitName,
				sl.speed
			FROM user_tunnel ut
			LEFT JOIN tunnel t ON ut.tunnel_id = t.id
			LEFT JOIN speed_limit sl ON ut.speed_id = sl.id
			WHERE ut.user_id = ?
			ORDER BY ut.id`, userId).Scan(&tunnelPerms)
	}
	if tunnelPerms == nil {
		tunnelPerms = []UserTunnelDetailDto{}
	}

	// 4. Get forward details via JOIN
	var forwards []UserForwardDetailDto
	DB.Raw(`SELECT
			f.id,
			f.name,
			f.tunnel_id as tunnelId,
			t.name as tunnelName,
			t.in_ip as inIp,
			f.in_port as inPort,
			f.remote_addr as remoteAddr,
			f.in_flow as inFlow,
			f.out_flow as outFlow,
			f.status,
			f.created_time as createdTime
		FROM forward f
		LEFT JOIN tunnel t ON f.tunnel_id = t.id
		WHERE f.user_id = ?
		ORDER BY f.created_time DESC`, userId).Scan(&forwards)
	if forwards == nil {
		forwards = []UserForwardDetailDto{}
	}

	// 5. Get last 24 hours flow statistics, pad to 24 with zeros
	var recentFlows []model.StatisticsFlow
	DB.Where("user_id = ?", userId).
		Order("id DESC").
		Limit(24).
		Find(&recentFlows)

	statisticsFlows := make([]model.StatisticsFlow, 0, 24)
	statisticsFlows = append(statisticsFlows, recentFlows...)

	if len(statisticsFlows) < 24 {
		startHour := time.Now().Hour()
		if len(statisticsFlows) > 0 {
			lastTime := statisticsFlows[len(statisticsFlows)-1].Time
			startHour = parseHour(lastTime) - 1
		}

		for len(statisticsFlows) < 24 {
			if startHour < 0 {
				startHour = 23
			}
			statisticsFlows = append(statisticsFlows, model.StatisticsFlow{
				UserId:    userId,
				Flow:      0,
				TotalFlow: 0,
				Time:      fmt.Sprintf("%02d:00", startHour),
			})
			startHour--
		}
	}

	// 6. Assemble result
	packageDto := UserPackageDto{
		UserInfo:          userInfo,
		TunnelPermissions: tunnelPerms,
		Forwards:          forwards,
		StatisticsFlows:   statisticsFlows,
	}

	return dto.Ok(packageDto)
}

// parseHour extracts the hour integer from a "HH:00" time string.
func parseHour(timeStr string) int {
	if timeStr == "" {
		return time.Now().Hour()
	}
	var h int
	if _, err := fmt.Sscanf(timeStr, "%d:", &h); err != nil {
		return time.Now().Hour()
	}
	return h
}

// ---------------------------------------------------------------------------
// UpdatePassword allows a user to change their username and/or password.
// ---------------------------------------------------------------------------

func UpdatePassword(userId int64, d dto.UpdatePasswordDto) dto.R {
	// 1. Get user
	var user model.User
	if err := DB.First(&user, userId).Error; err != nil {
		return dto.Err("用户不存在")
	}

	// 2. Verify current password (supports both bcrypt and legacy MD5)
	if !pkg.CheckPassword(d.OldPassword, user.Pwd) {
		return dto.Err("当前密码错误")
	}

	// 2.5 Validate new password length
	if len(d.NewPassword) < 8 {
		return dto.Err("新密码长度至少8位")
	}

	// 3. If new username differs, check uniqueness
	if d.NewUsername != "" && d.NewUsername != user.User {
		var count int64
		DB.Model(&model.User{}).Where("user = ? AND id != ?", d.NewUsername, user.ID).Count(&count)
		if count > 0 {
			return dto.Err("用户名已被其他用户使用")
		}
	}

	// 4. Update username and password
	newUsername := user.User
	if d.NewUsername != "" {
		newUsername = d.NewUsername
	}

	updates := map[string]interface{}{
		"user":         newUsername,
		"pwd":          pkg.HashPassword(d.NewPassword),
		"updated_time": time.Now().UnixMilli(),
	}

	if err := DB.Model(&model.User{}).Where("id = ?", user.ID).Updates(updates).Error; err != nil {
		return dto.Err("用户更新失败")
	}

	return dto.Ok("账号密码修改成功")
}

// ---------------------------------------------------------------------------
// ResetFlow resets flow counters for a user or a user-tunnel.
// ---------------------------------------------------------------------------

func ResetFlow(d dto.ResetFlowDto, flowType int) dto.R {
	if flowType == 1 {
		// Reset user-level flow
		var user model.User
		if err := DB.First(&user, d.ID).Error; err != nil {
			return dto.Err("用户不存在")
		}
		DB.Model(&model.User{}).Where("id = ?", d.ID).Updates(map[string]interface{}{
			"in_flow":  0,
			"out_flow": 0,
		})
	} else {
		// Reset user-tunnel flow
		var ut model.UserTunnel
		if err := DB.First(&ut, d.ID).Error; err != nil {
			return dto.Err("隧道不存在")
		}
		DB.Model(&model.UserTunnel{}).Where("id = ?", d.ID).Updates(map[string]interface{}{
			"in_flow":  0,
			"out_flow": 0,
		})
	}
	return dto.OkMsg()
}
