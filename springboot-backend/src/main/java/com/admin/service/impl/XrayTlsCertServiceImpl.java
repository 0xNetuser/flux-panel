package com.admin.service.impl;

import com.admin.common.dto.GostDto;
import com.admin.common.dto.XrayTlsCertDto;
import com.admin.common.lang.R;
import com.admin.common.utils.XrayUtil;
import com.admin.entity.Node;
import com.admin.entity.XrayTlsCert;
import com.admin.mapper.XrayTlsCertMapper;
import com.admin.service.NodeService;
import com.admin.service.XrayTlsCertService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.util.List;

@Slf4j
@Service
public class XrayTlsCertServiceImpl extends ServiceImpl<XrayTlsCertMapper, XrayTlsCert> implements XrayTlsCertService {

    @Resource
    private NodeService nodeService;

    @Override
    public R createCert(XrayTlsCertDto dto) {
        Node node = nodeService.getById(dto.getNodeId());
        if (node == null) {
            return R.err("节点不存在");
        }

        XrayTlsCert cert = new XrayTlsCert();
        BeanUtils.copyProperties(dto, cert);
        if (cert.getAutoRenew() == null) {
            cert.setAutoRenew(0);
        }
        cert.setCreatedTime(System.currentTimeMillis());
        cert.setUpdatedTime(System.currentTimeMillis());

        if (!this.save(cert)) {
            return R.err("创建证书失败");
        }

        // 部署证书到节点
        GostDto result = XrayUtil.XrayDeployCert(node.getId(), cert.getDomain(), cert.getPublicKey(), cert.getPrivateKey());
        if (result != null && !"OK".equals(result.getMsg())) {
            log.warn("部署证书到节点 {} 失败: {}", node.getId(), result.getMsg());
        }

        return R.ok(cert);
    }

    @Override
    public R listCerts(Long nodeId) {
        QueryWrapper<XrayTlsCert> query = new QueryWrapper<>();
        if (nodeId != null) {
            query.eq("node_id", nodeId);
        }
        query.orderByDesc("created_time");
        List<XrayTlsCert> list = this.list(query);
        return R.ok(list);
    }

    @Override
    public R deleteCert(Long id) {
        XrayTlsCert cert = this.getById(id);
        if (cert == null) {
            return R.err("证书不存在");
        }

        this.removeById(id);
        return R.ok();
    }
}
