package com.admin.service;

import com.admin.common.dto.XrayTlsCertDto;
import com.admin.common.lang.R;
import com.admin.entity.XrayTlsCert;
import com.baomidou.mybatisplus.extension.service.IService;

public interface XrayTlsCertService extends IService<XrayTlsCert> {

    R createCert(XrayTlsCertDto dto);

    R listCerts(Long nodeId);

    R deleteCert(Long id);
}
