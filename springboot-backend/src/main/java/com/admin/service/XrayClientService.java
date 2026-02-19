package com.admin.service;

import com.admin.common.dto.XrayClientDto;
import com.admin.common.dto.XrayClientUpdateDto;
import com.admin.common.lang.R;
import com.admin.entity.XrayClient;
import com.baomidou.mybatisplus.extension.service.IService;

public interface XrayClientService extends IService<XrayClient> {

    R createClient(XrayClientDto dto);

    R listClients(Long inboundId, Long userId);

    R updateClient(XrayClientUpdateDto dto);

    R deleteClient(Long id);

    R resetTraffic(Long id);

    R getSubscriptionLinks(Long userId);
}
