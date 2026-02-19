package service

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/model"
	"flux-panel/go-backend/pkg"
	"log"
	"time"
)

func CreateXrayTlsCert(d dto.XrayTlsCertDto) dto.R {
	node := GetNodeById(d.NodeId)
	if node == nil {
		return dto.Err("节点不存在")
	}

	autoRenew := 0
	if d.AutoRenew != nil {
		autoRenew = *d.AutoRenew
	}

	cert := model.XrayTlsCert{
		NodeId:      d.NodeId,
		Domain:      d.Domain,
		PublicKey:   d.PublicKey,
		PrivateKey:  d.PrivateKey,
		AutoRenew:   autoRenew,
		ExpireTime:  d.ExpireTime,
		CreatedTime: time.Now().UnixMilli(),
		UpdatedTime: time.Now().UnixMilli(),
	}

	if err := DB.Create(&cert).Error; err != nil {
		return dto.Err("创建证书失败")
	}

	// Deploy cert to node
	result := pkg.XrayDeployCert(node.ID, cert.Domain, cert.PublicKey, cert.PrivateKey)
	if result != nil && result.Msg != "OK" {
		log.Printf("部署证书到节点 %d 失败: %s", node.ID, result.Msg)
	}

	return dto.Ok(cert)
}

func ListXrayTlsCerts(nodeId *int64) dto.R {
	query := DB.Model(&model.XrayTlsCert{}).Order("created_time DESC")
	if nodeId != nil {
		query = query.Where("node_id = ?", *nodeId)
	}

	var list []model.XrayTlsCert
	query.Find(&list)
	return dto.Ok(list)
}

func DeleteXrayTlsCert(id int64) dto.R {
	var cert model.XrayTlsCert
	if err := DB.First(&cert, id).Error; err != nil {
		return dto.Err("证书不存在")
	}

	DB.Delete(&cert)
	return dto.Ok("删除成功")
}
