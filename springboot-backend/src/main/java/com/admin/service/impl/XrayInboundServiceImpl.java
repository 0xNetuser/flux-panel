package com.admin.service.impl;

import com.admin.common.dto.GostDto;
import com.admin.common.dto.XrayInboundDto;
import com.admin.common.dto.XrayInboundUpdateDto;
import com.admin.common.lang.R;
import com.admin.common.utils.XrayUtil;
import com.admin.entity.Node;
import com.admin.entity.XrayClient;
import com.admin.entity.XrayInbound;
import com.admin.mapper.XrayInboundMapper;
import com.admin.service.NodeService;
import com.admin.service.XrayClientService;
import com.admin.service.XrayInboundService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.util.List;
import java.util.Objects;

@Slf4j
@Service
public class XrayInboundServiceImpl extends ServiceImpl<XrayInboundMapper, XrayInbound> implements XrayInboundService {

    @Resource
    private NodeService nodeService;

    @Resource
    @Lazy
    private XrayClientService xrayClientService;

    @Override
    public R createInbound(XrayInboundDto dto) {
        Node node = nodeService.getById(dto.getNodeId());
        if (node == null) {
            return R.err("节点不存在");
        }

        // 检查端口冲突
        long portConflict = this.count(new QueryWrapper<XrayInbound>()
                .eq("node_id", dto.getNodeId())
                .eq("port", dto.getPort()));
        if (portConflict > 0) {
            return R.err("该节点端口 " + dto.getPort() + " 已被其他入站使用");
        }

        // 检查 tag 唯一性
        long tagConflict = this.count(new QueryWrapper<XrayInbound>()
                .eq("node_id", dto.getNodeId())
                .eq("tag", dto.getTag()));
        if (tagConflict > 0) {
            return R.err("该节点标签 " + dto.getTag() + " 已存在");
        }

        XrayInbound inbound = new XrayInbound();
        BeanUtils.copyProperties(dto, inbound);
        if (inbound.getListen() == null) {
            inbound.setListen("0.0.0.0");
        }
        inbound.setEnable(1);
        inbound.setCreatedTime(System.currentTimeMillis());
        inbound.setUpdatedTime(System.currentTimeMillis());

        if (!this.save(inbound)) {
            return R.err("创建入站失败");
        }

        // 下发命令到节点
        GostDto result = XrayUtil.XrayAddInbound(node.getId(), inbound);
        if (result != null && !"OK".equals(result.getMsg())) {
            log.warn("下发 XrayAddInbound 到节点 {} 失败: {}", node.getId(), result.getMsg());
        }

        return R.ok(inbound);
    }

    @Override
    public R listInbounds(Long nodeId) {
        QueryWrapper<XrayInbound> query = new QueryWrapper<>();
        if (nodeId != null) {
            query.eq("node_id", nodeId);
        }
        query.orderByDesc("created_time");
        List<XrayInbound> list = this.list(query);
        return R.ok(list);
    }

    @Override
    public R updateInbound(XrayInboundUpdateDto dto) {
        XrayInbound existing = this.getById(dto.getId());
        if (existing == null) {
            return R.err("入站不存在");
        }

        // 端口冲突检查
        if (dto.getPort() != null && !dto.getPort().equals(existing.getPort())) {
            long portConflict = this.count(new QueryWrapper<XrayInbound>()
                    .eq("node_id", existing.getNodeId())
                    .eq("port", dto.getPort())
                    .ne("id", dto.getId()));
            if (portConflict > 0) {
                return R.err("该节点端口 " + dto.getPort() + " 已被其他入站使用");
            }
        }

        if (dto.getTag() != null) existing.setTag(dto.getTag());
        if (dto.getProtocol() != null) existing.setProtocol(dto.getProtocol());
        if (dto.getListen() != null) existing.setListen(dto.getListen());
        if (dto.getPort() != null) existing.setPort(dto.getPort());
        if (dto.getSettingsJson() != null) existing.setSettingsJson(dto.getSettingsJson());
        if (dto.getStreamSettingsJson() != null) existing.setStreamSettingsJson(dto.getStreamSettingsJson());
        if (dto.getSniffingJson() != null) existing.setSniffingJson(dto.getSniffingJson());
        if (dto.getRemark() != null) existing.setRemark(dto.getRemark());
        existing.setUpdatedTime(System.currentTimeMillis());

        if (!this.updateById(existing)) {
            return R.err("更新入站失败");
        }

        // 更新需要重写配置并重启，全量同步
        syncNodeConfig(existing.getNodeId());

        return R.ok();
    }

    @Override
    public R deleteInbound(Long id) {
        XrayInbound inbound = this.getById(id);
        if (inbound == null) {
            return R.err("入站不存在");
        }

        // 删除关联的客户端
        xrayClientService.remove(new QueryWrapper<XrayClient>().eq("inbound_id", id));

        // 删除入站记录
        this.removeById(id);

        // 下发命令到节点
        GostDto result = XrayUtil.XrayRemoveInbound(inbound.getNodeId(), inbound.getTag());
        if (result != null && !"OK".equals(result.getMsg())) {
            log.warn("下发 XrayRemoveInbound 到节点 {} 失败: {}", inbound.getNodeId(), result.getMsg());
        }

        return R.ok();
    }

    @Override
    public R enableInbound(Long id) {
        XrayInbound inbound = this.getById(id);
        if (inbound == null) {
            return R.err("入站不存在");
        }
        inbound.setEnable(1);
        inbound.setUpdatedTime(System.currentTimeMillis());
        this.updateById(inbound);

        syncNodeConfig(inbound.getNodeId());
        return R.ok();
    }

    @Override
    public R disableInbound(Long id) {
        XrayInbound inbound = this.getById(id);
        if (inbound == null) {
            return R.err("入站不存在");
        }
        inbound.setEnable(0);
        inbound.setUpdatedTime(System.currentTimeMillis());
        this.updateById(inbound);

        syncNodeConfig(inbound.getNodeId());
        return R.ok();
    }

    private void syncNodeConfig(Long nodeId) {
        List<XrayInbound> enabledInbounds = this.list(new QueryWrapper<XrayInbound>()
                .eq("node_id", nodeId)
                .eq("enable", 1));
        GostDto result = XrayUtil.XrayApplyConfig(nodeId, enabledInbounds);
        if (result != null && !"OK".equals(result.getMsg())) {
            log.warn("全量同步 Xray 配置到节点 {} 失败: {}", nodeId, result.getMsg());
        }
    }
}
