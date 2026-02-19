package com.admin.service.impl;

import com.admin.common.dto.GostDto;
import com.admin.common.dto.XrayClientDto;
import com.admin.common.dto.XrayClientUpdateDto;
import com.admin.common.lang.R;
import com.admin.common.utils.XrayUtil;
import com.admin.entity.Node;
import com.admin.entity.User;
import com.admin.entity.XrayClient;
import com.admin.entity.XrayInbound;
import com.admin.mapper.XrayClientMapper;
import com.admin.service.NodeService;
import com.admin.service.UserService;
import com.admin.service.XrayClientService;
import com.admin.service.XrayInboundService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.util.*;

@Slf4j
@Service
public class XrayClientServiceImpl extends ServiceImpl<XrayClientMapper, XrayClient> implements XrayClientService {

    @Resource
    @Lazy
    private XrayInboundService xrayInboundService;

    @Resource
    private NodeService nodeService;

    @Resource
    private UserService userService;

    @Override
    public R createClient(XrayClientDto dto) {
        XrayInbound inbound = xrayInboundService.getById(dto.getInboundId());
        if (inbound == null) {
            return R.err("入站不存在");
        }

        User user = userService.getById(dto.getUserId());
        if (user == null) {
            return R.err("用户不存在");
        }

        XrayClient client = new XrayClient();
        client.setInboundId(dto.getInboundId());
        client.setUserId(dto.getUserId());
        client.setFlow(dto.getFlow());
        client.setAlterId(dto.getAlterId() != null ? dto.getAlterId() : 0);
        client.setTotalTraffic(dto.getTotalTraffic() != null ? dto.getTotalTraffic() : 0L);
        client.setExpTime(dto.getExpTime());
        client.setRemark(dto.getRemark());
        client.setUpTraffic(0L);
        client.setDownTraffic(0L);
        client.setEnable(1);
        client.setCreatedTime(System.currentTimeMillis());
        client.setUpdatedTime(System.currentTimeMillis());

        // 生成 UUID 或使用指定密码
        if (dto.getUuidOrPassword() != null && !dto.getUuidOrPassword().isEmpty()) {
            client.setUuidOrPassword(dto.getUuidOrPassword());
        } else {
            if ("shadowsocks".equals(inbound.getProtocol())) {
                client.setUuidOrPassword(UUID.randomUUID().toString().replace("-", "").substring(0, 16));
            } else {
                client.setUuidOrPassword(UUID.randomUUID().toString());
            }
        }

        // 生成 email 标识
        String email = dto.getUserId() + "_" + System.currentTimeMillis() + "@flux";
        client.setEmail(email);

        if (!this.save(client)) {
            return R.err("创建客户端失败");
        }

        // 通过 gRPC 添加客户端（无需重启）
        Node node = nodeService.getById(inbound.getNodeId());
        if (node != null) {
            GostDto result = XrayUtil.XrayAddClient(
                    node.getId(),
                    inbound.getTag(),
                    client.getEmail(),
                    client.getUuidOrPassword(),
                    client.getFlow(),
                    client.getAlterId(),
                    inbound.getProtocol()
            );
            if (result != null && !"OK".equals(result.getMsg())) {
                log.warn("下发 XrayAddClient 到节点 {} 失败: {}", node.getId(), result.getMsg());
            }
        }

        return R.ok(client);
    }

    @Override
    public R listClients(Long inboundId, Long userId) {
        QueryWrapper<XrayClient> query = new QueryWrapper<>();
        if (inboundId != null) {
            query.eq("inbound_id", inboundId);
        }
        if (userId != null) {
            query.eq("user_id", userId);
        }
        query.orderByDesc("created_time");
        List<XrayClient> list = this.list(query);
        return R.ok(list);
    }

    @Override
    public R updateClient(XrayClientUpdateDto dto) {
        XrayClient existing = this.getById(dto.getId());
        if (existing == null) {
            return R.err("客户端不存在");
        }

        if (dto.getFlow() != null) existing.setFlow(dto.getFlow());
        if (dto.getAlterId() != null) existing.setAlterId(dto.getAlterId());
        if (dto.getTotalTraffic() != null) existing.setTotalTraffic(dto.getTotalTraffic());
        if (dto.getExpTime() != null) existing.setExpTime(dto.getExpTime());
        if (dto.getEnable() != null) existing.setEnable(dto.getEnable());
        if (dto.getRemark() != null) existing.setRemark(dto.getRemark());
        existing.setUpdatedTime(System.currentTimeMillis());

        if (!this.updateById(existing)) {
            return R.err("更新客户端失败");
        }

        // 如果启用/禁用状态变化，需要通过 gRPC 操作
        if (dto.getEnable() != null) {
            XrayInbound inbound = xrayInboundService.getById(existing.getInboundId());
            if (inbound != null) {
                Node node = nodeService.getById(inbound.getNodeId());
                if (node != null) {
                    if (dto.getEnable() == 0) {
                        XrayUtil.XrayRemoveClient(node.getId(), inbound.getTag(), existing.getEmail());
                    } else {
                        XrayUtil.XrayAddClient(node.getId(), inbound.getTag(),
                                existing.getEmail(), existing.getUuidOrPassword(),
                                existing.getFlow(), existing.getAlterId(),
                                inbound.getProtocol());
                    }
                }
            }
        }

        return R.ok();
    }

    @Override
    public R deleteClient(Long id) {
        XrayClient client = this.getById(id);
        if (client == null) {
            return R.err("客户端不存在");
        }

        XrayInbound inbound = xrayInboundService.getById(client.getInboundId());

        this.removeById(id);

        // 通过 gRPC 删除客户端
        if (inbound != null) {
            Node node = nodeService.getById(inbound.getNodeId());
            if (node != null) {
                GostDto result = XrayUtil.XrayRemoveClient(node.getId(), inbound.getTag(), client.getEmail());
                if (result != null && !"OK".equals(result.getMsg())) {
                    log.warn("下发 XrayRemoveClient 到节点 {} 失败: {}", node.getId(), result.getMsg());
                }
            }
        }

        return R.ok();
    }

    @Override
    public R resetTraffic(Long id) {
        XrayClient client = this.getById(id);
        if (client == null) {
            return R.err("客户端不存在");
        }

        client.setUpTraffic(0L);
        client.setDownTraffic(0L);
        client.setUpdatedTime(System.currentTimeMillis());
        this.updateById(client);

        return R.ok();
    }

    @Override
    public R getSubscriptionLinks(Long userId) {
        // 查询用户所有启用的客户端
        List<XrayClient> clients = this.list(new QueryWrapper<XrayClient>()
                .eq("user_id", userId)
                .eq("enable", 1));

        List<Map<String, Object>> links = new ArrayList<>();

        for (XrayClient client : clients) {
            XrayInbound inbound = xrayInboundService.getById(client.getInboundId());
            if (inbound == null || inbound.getEnable() != 1) continue;

            Node node = nodeService.getById(inbound.getNodeId());
            if (node == null || node.getStatus() != 1) continue;

            String link = generateProtocolLink(client, inbound, node);
            if (link != null) {
                Map<String, Object> item = new HashMap<>();
                item.put("link", link);
                item.put("protocol", inbound.getProtocol());
                item.put("remark", client.getRemark() != null ? client.getRemark() :
                        (inbound.getRemark() != null ? inbound.getRemark() : inbound.getTag()));
                item.put("nodeName", node.getName());
                links.add(item);
            }
        }

        return R.ok(links);
    }

    private String generateProtocolLink(XrayClient client, XrayInbound inbound, Node node) {
        String host = node.getServerIp();
        int port = inbound.getPort();
        String remark = client.getRemark() != null ? client.getRemark() :
                (inbound.getRemark() != null ? inbound.getRemark() : inbound.getTag());

        switch (inbound.getProtocol()) {
            case "vmess":
                return generateVmessLink(client, inbound, host, port, remark);
            case "vless":
                return generateVlessLink(client, inbound, host, port, remark);
            case "trojan":
                return generateTrojanLink(client, inbound, host, port, remark);
            case "shadowsocks":
                return generateShadowsocksLink(client, inbound, host, port, remark);
            default:
                return null;
        }
    }

    private String generateVmessLink(XrayClient client, XrayInbound inbound, String host, int port, String remark) {
        Map<String, Object> vmessConfig = new LinkedHashMap<>();
        vmessConfig.put("v", "2");
        vmessConfig.put("ps", remark);
        vmessConfig.put("add", host);
        vmessConfig.put("port", port);
        vmessConfig.put("id", client.getUuidOrPassword());
        vmessConfig.put("aid", client.getAlterId());
        vmessConfig.put("scy", "auto");
        vmessConfig.put("net", "tcp");
        vmessConfig.put("type", "none");
        vmessConfig.put("host", "");
        vmessConfig.put("path", "");
        vmessConfig.put("tls", "");

        String json = com.alibaba.fastjson.JSON.toJSONString(vmessConfig);
        String encoded = Base64.getEncoder().encodeToString(json.getBytes());
        return "vmess://" + encoded;
    }

    private String generateVlessLink(XrayClient client, XrayInbound inbound, String host, int port, String remark) {
        StringBuilder sb = new StringBuilder();
        sb.append("vless://").append(client.getUuidOrPassword()).append("@").append(host).append(":").append(port);
        sb.append("?encryption=none");
        if (client.getFlow() != null && !client.getFlow().isEmpty()) {
            sb.append("&flow=").append(client.getFlow());
        }
        sb.append("&type=tcp");
        sb.append("#").append(urlEncode(remark));
        return sb.toString();
    }

    private String generateTrojanLink(XrayClient client, XrayInbound inbound, String host, int port, String remark) {
        return "trojan://" + client.getUuidOrPassword() + "@" + host + ":" + port
                + "?type=tcp#" + urlEncode(remark);
    }

    private String generateShadowsocksLink(XrayClient client, XrayInbound inbound, String host, int port, String remark) {
        String method = "aes-256-gcm";
        String userInfo = method + ":" + client.getUuidOrPassword();
        String encoded = Base64.getEncoder().encodeToString(userInfo.getBytes());
        return "ss://" + encoded + "@" + host + ":" + port + "#" + urlEncode(remark);
    }

    private String urlEncode(String s) {
        try {
            return java.net.URLEncoder.encode(s, "UTF-8");
        } catch (Exception e) {
            return s;
        }
    }
}
