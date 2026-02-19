package service

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/model"
	"time"
)

func GetConfigs() dto.R {
	var configs []model.ViteConfig
	DB.Find(&configs)

	configMap := make(map[string]string)
	for _, c := range configs {
		configMap[c.Name] = c.Value
	}
	return dto.Ok(configMap)
}

func GetConfigByName(name string) dto.R {
	if name == "" {
		return dto.Err("配置名称不能为空")
	}

	var cfg model.ViteConfig
	if err := DB.Where("name = ?", name).First(&cfg).Error; err != nil {
		return dto.Err("配置不存在")
	}
	return dto.Ok(cfg)
}

func UpdateConfigs(configMap map[string]string) dto.R {
	if len(configMap) == 0 {
		return dto.Err("配置数据不能为空")
	}

	for name, value := range configMap {
		if name == "" {
			continue
		}
		updateOrCreateConfig(name, value)
	}
	return dto.Ok("配置更新成功")
}

func UpdateSingleConfig(name, value string) dto.R {
	if name == "" {
		return dto.Err("配置名称不能为空")
	}
	if value == "" {
		return dto.Err("配置值不能为空")
	}

	updateOrCreateConfig(name, value)
	return dto.Ok("配置更新成功")
}

func updateOrCreateConfig(name, value string) {
	var cfg model.ViteConfig
	result := DB.Where("name = ?", name).First(&cfg)

	if result.Error == nil {
		cfg.Value = value
		cfg.Time = time.Now().UnixMilli()
		DB.Save(&cfg)
	} else {
		cfg = model.ViteConfig{
			Name:  name,
			Value: value,
			Time:  time.Now().UnixMilli(),
		}
		DB.Create(&cfg)
	}
}
