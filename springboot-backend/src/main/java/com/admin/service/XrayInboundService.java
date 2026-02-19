package com.admin.service;

import com.admin.common.dto.XrayInboundDto;
import com.admin.common.dto.XrayInboundUpdateDto;
import com.admin.common.lang.R;
import com.admin.entity.XrayInbound;
import com.baomidou.mybatisplus.extension.service.IService;

public interface XrayInboundService extends IService<XrayInbound> {

    R createInbound(XrayInboundDto dto);

    R listInbounds(Long nodeId);

    R updateInbound(XrayInboundUpdateDto dto);

    R deleteInbound(Long id);

    R enableInbound(Long id);

    R disableInbound(Long id);
}
