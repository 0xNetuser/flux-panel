package service

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/model"
	"flux-panel/go-backend/pkg"
	"log"
	"time"
)

func CreateXrayTlsCert(d dto.XrayTlsCertDto, userId int64, roleId int) dto.R {
	if r := checkXrayPermission(userId, roleId); r != nil {
		return *r
	}
	if r := checkXrayNodeAccess(userId, roleId, d.NodeId); r != nil {
		return *r
	}

	node := GetNodeById(d.NodeId)
	if node == nil {
		return dto.Err("节点不存在")
	}

	autoRenew := 0
	if d.AutoRenew != nil {
		autoRenew = *d.AutoRenew
	}

	acmeEnabled := 0
	if d.AcmeEnabled != nil {
		acmeEnabled = *d.AcmeEnabled
	}

	cert := model.XrayTlsCert{
		NodeId:        d.NodeId,
		Domain:        d.Domain,
		PublicKey:     d.PublicKey,
		PrivateKey:    d.PrivateKey,
		AutoRenew:     autoRenew,
		AcmeEnabled:   acmeEnabled,
		AcmeEmail:     d.AcmeEmail,
		ChallengeType: d.ChallengeType,
		DnsProvider:   d.DnsProvider,
		DnsConfig:     d.DnsConfig,
		ExpireTime:    d.ExpireTime,
		CreatedTime:   time.Now().UnixMilli(),
		UpdatedTime:   time.Now().UnixMilli(),
	}

	if err := DB.Create(&cert).Error; err != nil {
		return dto.Err("创建证书失败")
	}

	// Deploy cert to node if keys are provided (manual mode)
	if cert.PublicKey != "" && cert.PrivateKey != "" {
		result := pkg.XrayDeployCert(node.ID, cert.Domain, cert.PublicKey, cert.PrivateKey)
		if result != nil && result.Msg != "OK" {
			log.Printf("部署证书到节点 %d 失败: %s", node.ID, result.Msg)
		}
	}

	return dto.Ok(cert)
}

func ListXrayTlsCerts(nodeId *int64, userId int64, roleId int) dto.R {
	if r := checkXrayPermission(userId, roleId); r != nil {
		return *r
	}

	query := DB.Model(&model.XrayTlsCert{}).Order("created_time DESC")
	if nodeId != nil {
		if r := checkXrayNodeAccess(userId, roleId, *nodeId); r != nil {
			return *r
		}
		query = query.Where("node_id = ?", *nodeId)
	} else if roleId != 0 {
		nodeIds := getUserAccessibleNodeIds(userId)
		query = query.Where("node_id IN ?", nodeIds)
	}

	var list []model.XrayTlsCert
	query.Find(&list)
	// Strip private keys and sensitive config from response
	for i := range list {
		list[i].PrivateKey = ""
		list[i].DnsConfig = ""
	}
	return dto.Ok(list)
}

func DeleteXrayTlsCert(id int64, userId int64, roleId int) dto.R {
	if r := checkXrayPermission(userId, roleId); r != nil {
		return *r
	}

	var cert model.XrayTlsCert
	if err := DB.First(&cert, id).Error; err != nil {
		return dto.Err("证书不存在")
	}

	if r := checkXrayNodeAccess(userId, roleId, cert.NodeId); r != nil {
		return *r
	}

	DB.Delete(&cert)
	return dto.Ok("删除成功")
}

func IssueCertificate(id int64, userId int64, roleId int) dto.R {
	if r := checkXrayPermission(userId, roleId); r != nil {
		return *r
	}

	var cert model.XrayTlsCert
	if err := DB.First(&cert, id).Error; err != nil {
		return dto.Err("证书不存在")
	}

	if r := checkXrayNodeAccess(userId, roleId, cert.NodeId); r != nil {
		return *r
	}

	if cert.AcmeEnabled != 1 {
		return dto.Err("该证书未启用 ACME")
	}

	err := issueCertViaAcme(&cert)
	if err != nil {
		DB.Model(&cert).Updates(map[string]interface{}{
			"renew_error":  err.Error(),
			"updated_time": time.Now().UnixMilli(),
		})
		return dto.Err("签发失败: " + err.Error())
	}

	return dto.Ok("签发成功")
}

func RenewCertificate(id int64, userId int64, roleId int) dto.R {
	if r := checkXrayPermission(userId, roleId); r != nil {
		return *r
	}

	var cert model.XrayTlsCert
	if err := DB.First(&cert, id).Error; err != nil {
		return dto.Err("证书不存在")
	}

	if r := checkXrayNodeAccess(userId, roleId, cert.NodeId); r != nil {
		return *r
	}

	if cert.AcmeEnabled != 1 {
		return dto.Err("该证书未启用 ACME")
	}

	err := issueCertViaAcme(&cert)
	if err != nil {
		DB.Model(&cert).Updates(map[string]interface{}{
			"renew_error":  err.Error(),
			"updated_time": time.Now().UnixMilli(),
		})
		return dto.Err("续签失败: " + err.Error())
	}

	return dto.Ok("续签成功")
}
