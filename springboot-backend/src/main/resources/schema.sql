-- 自动建表：仅在表不存在时创建，不影响已有数据

CREATE TABLE IF NOT EXISTS `forward` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `user_id` int(10) NOT NULL,
  `user_name` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL,
  `tunnel_id` int(10) NOT NULL,
  `in_port` int(10) NOT NULL,
  `out_port` int(10) DEFAULT NULL,
  `remote_addr` longtext NOT NULL,
  `strategy` varchar(100) NOT NULL DEFAULT 'fifo',
  `interface_name` varchar(200) DEFAULT NULL,
  `in_flow` bigint(20) NOT NULL DEFAULT '0',
  `out_flow` bigint(20) NOT NULL DEFAULT '0',
  `created_time` bigint(20) NOT NULL,
  `updated_time` bigint(20) NOT NULL,
  `status` int(10) NOT NULL,
  `inx` int(10) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `node` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `secret` varchar(100) NOT NULL,
  `ip` longtext,
  `server_ip` varchar(100) NOT NULL,
  `port_sta` int(10) NOT NULL,
  `port_end` int(10) NOT NULL,
  `version` varchar(100) DEFAULT NULL,
  `http` int(10) NOT NULL DEFAULT '0',
  `tls` int(10) NOT NULL DEFAULT '0',
  `socks` int(10) NOT NULL DEFAULT '0',
  `created_time` bigint(20) NOT NULL,
  `updated_time` bigint(20) DEFAULT NULL,
  `status` int(10) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `speed_limit` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `speed` int(10) NOT NULL,
  `tunnel_id` int(10) NOT NULL,
  `tunnel_name` varchar(100) NOT NULL,
  `created_time` bigint(20) NOT NULL,
  `updated_time` bigint(20) DEFAULT NULL,
  `status` int(10) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `statistics_flow` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `user_id` int(10) NOT NULL,
  `flow` bigint(20) NOT NULL,
  `total_flow` bigint(20) NOT NULL,
  `time` varchar(100) NOT NULL,
  `created_time` bigint(20) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tunnel` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `traffic_ratio` decimal(10,1) NOT NULL DEFAULT '1.0',
  `in_node_id` int(10) NOT NULL,
  `in_ip` varchar(100) NOT NULL,
  `out_node_id` int(10) NOT NULL,
  `out_ip` varchar(100) NOT NULL,
  `type` int(10) NOT NULL,
  `protocol` varchar(10) NOT NULL DEFAULT 'tls',
  `flow` int(10) NOT NULL,
  `tcp_listen_addr` varchar(100) NOT NULL DEFAULT '[::]',
  `udp_listen_addr` varchar(100) NOT NULL DEFAULT '[::]',
  `interface_name` varchar(200) DEFAULT NULL,
  `created_time` bigint(20) NOT NULL,
  `updated_time` bigint(20) NOT NULL,
  `status` int(10) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `user` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `user` varchar(100) NOT NULL,
  `pwd` varchar(100) NOT NULL,
  `role_id` int(10) NOT NULL,
  `exp_time` bigint(20) NOT NULL,
  `flow` bigint(20) NOT NULL,
  `in_flow` bigint(20) NOT NULL DEFAULT '0',
  `out_flow` bigint(20) NOT NULL DEFAULT '0',
  `flow_reset_time` bigint(20) NOT NULL,
  `num` int(10) NOT NULL,
  `created_time` bigint(20) NOT NULL,
  `updated_time` bigint(20) DEFAULT NULL,
  `status` int(10) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `user_tunnel` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `user_id` int(10) NOT NULL,
  `tunnel_id` int(10) NOT NULL,
  `speed_id` int(10) DEFAULT NULL,
  `num` int(10) NOT NULL,
  `flow` bigint(20) NOT NULL,
  `in_flow` bigint(20) NOT NULL DEFAULT '0',
  `out_flow` bigint(20) NOT NULL DEFAULT '0',
  `flow_reset_time` bigint(20) NOT NULL,
  `exp_time` bigint(20) NOT NULL,
  `status` int(10) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `vite_config` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `value` varchar(200) NOT NULL,
  `time` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Xray 入站端点
CREATE TABLE IF NOT EXISTS `xray_inbound` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `node_id` int(10) NOT NULL,
  `tag` varchar(100) NOT NULL,
  `protocol` varchar(50) NOT NULL,
  `listen` varchar(100) NOT NULL DEFAULT '0.0.0.0',
  `port` int(10) NOT NULL,
  `settings_json` text NOT NULL,
  `stream_settings_json` text,
  `sniffing_json` text,
  `remark` varchar(200) DEFAULT NULL,
  `enable` tinyint(1) NOT NULL DEFAULT 1,
  `created_time` bigint(20) NOT NULL,
  `updated_time` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_node_tag` (`node_id`, `tag`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Xray 客户端账号
CREATE TABLE IF NOT EXISTS `xray_client` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `inbound_id` int(10) NOT NULL,
  `user_id` int(10) NOT NULL,
  `email` varchar(200) NOT NULL,
  `uuid_or_password` varchar(200) NOT NULL,
  `flow` varchar(50) DEFAULT NULL,
  `alter_id` int(10) DEFAULT 0,
  `total_traffic` bigint(20) NOT NULL DEFAULT 0,
  `up_traffic` bigint(20) NOT NULL DEFAULT 0,
  `down_traffic` bigint(20) NOT NULL DEFAULT 0,
  `exp_time` bigint(20) DEFAULT NULL,
  `enable` tinyint(1) NOT NULL DEFAULT 1,
  `remark` varchar(200) DEFAULT NULL,
  `created_time` bigint(20) NOT NULL,
  `updated_time` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- TLS 证书
CREATE TABLE IF NOT EXISTS `xray_tls_cert` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `node_id` int(10) NOT NULL,
  `domain` varchar(200) NOT NULL,
  `public_key` text NOT NULL,
  `private_key` text NOT NULL,
  `auto_renew` tinyint(1) NOT NULL DEFAULT 0,
  `expire_time` bigint(20) DEFAULT NULL,
  `created_time` bigint(20) NOT NULL,
  `updated_time` bigint(20) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- node 表新增 Xray 相关字段
ALTER TABLE `node` ADD COLUMN IF NOT EXISTS `xray_enabled` tinyint(1) NOT NULL DEFAULT 0;
ALTER TABLE `node` ADD COLUMN IF NOT EXISTS `xray_version` varchar(50) DEFAULT NULL;
ALTER TABLE `node` ADD COLUMN IF NOT EXISTS `xray_status` tinyint(1) NOT NULL DEFAULT 0;

-- 默认管理员账号（仅在表为空时插入）
INSERT IGNORE INTO `user` (`id`, `user`, `pwd`, `role_id`, `exp_time`, `flow`, `in_flow`, `out_flow`, `flow_reset_time`, `num`, `created_time`, `updated_time`, `status`) VALUES
(1, 'admin_user', '3c85cdebade1c51cf64ca9f3c09d182d', 0, 2727251700000, 99999, 0, 0, 1, 99999, 1748914865000, 1754011744252, 1);

-- 默认配置
INSERT IGNORE INTO `vite_config` (`id`, `name`, `value`, `time`) VALUES
(1, 'app_name', 'flux', 1755147963000);
