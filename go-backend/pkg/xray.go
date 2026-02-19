package pkg

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/model"
)

func XrayStart(nodeId int64) *dto.GostResponse {
	return WS.SendMsg(nodeId, map[string]interface{}{}, "XrayStart")
}

func XrayStop(nodeId int64) *dto.GostResponse {
	return WS.SendMsg(nodeId, map[string]interface{}{}, "XrayStop")
}

func XrayRestart(nodeId int64) *dto.GostResponse {
	return WS.SendMsg(nodeId, map[string]interface{}{}, "XrayRestart")
}

func XrayStatus(nodeId int64) *dto.GostResponse {
	return WS.SendMsg(nodeId, map[string]interface{}{}, "XrayStatus")
}

func XrayAddInbound(nodeId int64, inbound *model.XrayInbound) *dto.GostResponse {
	data := map[string]interface{}{
		"tag":                inbound.Tag,
		"protocol":           inbound.Protocol,
		"listen":             inbound.Listen,
		"port":               inbound.Port,
		"settingsJson":       inbound.SettingsJson,
		"streamSettingsJson": inbound.StreamSettingsJson,
		"sniffingJson":       inbound.SniffingJson,
	}
	return WS.SendMsg(nodeId, data, "XrayAddInbound")
}

func XrayRemoveInbound(nodeId int64, tag string) *dto.GostResponse {
	data := map[string]interface{}{
		"tag": tag,
	}
	return WS.SendMsg(nodeId, data, "XrayRemoveInbound")
}

func XrayAddClient(nodeId int64, inboundTag, email, uuidOrPassword, flow string, alterId int, protocol string) *dto.GostResponse {
	data := map[string]interface{}{
		"inboundTag":     inboundTag,
		"email":          email,
		"uuidOrPassword": uuidOrPassword,
		"flow":           flow,
		"alterId":        alterId,
		"protocol":       protocol,
	}
	return WS.SendMsg(nodeId, data, "XrayAddClient")
}

func XrayRemoveClient(nodeId int64, inboundTag, email string) *dto.GostResponse {
	data := map[string]interface{}{
		"inboundTag": inboundTag,
		"email":      email,
	}
	return WS.SendMsg(nodeId, data, "XrayRemoveClient")
}

func XrayGetTraffic(nodeId int64) *dto.GostResponse {
	data := map[string]interface{}{
		"reset": true,
	}
	return WS.SendMsg(nodeId, data, "XrayGetTraffic")
}

func XrayApplyConfig(nodeId int64, inbounds []model.XrayInbound) *dto.GostResponse {
	var arr []map[string]interface{}
	for _, ib := range inbounds {
		arr = append(arr, map[string]interface{}{
			"tag":                ib.Tag,
			"protocol":           ib.Protocol,
			"listen":             ib.Listen,
			"port":               ib.Port,
			"settingsJson":       ib.SettingsJson,
			"streamSettingsJson": ib.StreamSettingsJson,
			"sniffingJson":       ib.SniffingJson,
		})
	}
	data := map[string]interface{}{
		"inbounds": arr,
	}
	return WS.SendMsg(nodeId, data, "XrayApplyConfig")
}

func XrayDeployCert(nodeId int64, domain, publicKey, privateKey string) *dto.GostResponse {
	data := map[string]interface{}{
		"domain":     domain,
		"publicKey":  publicKey,
		"privateKey": privateKey,
	}
	return WS.SendMsg(nodeId, data, "XrayDeployCert")
}
