package com.admin.controller;

import com.admin.common.aop.LogAnnotation;
import com.admin.common.annotation.RequireRole;
import com.admin.common.dto.XrayTlsCertDto;
import com.admin.common.lang.R;
import com.admin.service.XrayTlsCertService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@CrossOrigin
@RequestMapping("/api/v1/xray/cert")
public class XrayCertController extends BaseController {

    @Autowired
    private XrayTlsCertService xrayTlsCertService;

    @LogAnnotation
    @RequireRole
    @PostMapping("/create")
    public R create(@Validated @RequestBody XrayTlsCertDto dto) {
        return xrayTlsCertService.createCert(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/list")
    public R list(@RequestBody(required = false) Map<String, Object> params) {
        Long nodeId = null;
        if (params != null && params.get("nodeId") != null) {
            nodeId = Long.valueOf(params.get("nodeId").toString());
        }
        return xrayTlsCertService.listCerts(nodeId);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/delete")
    public R delete(@RequestBody Map<String, Object> params) {
        Long id = Long.valueOf(params.get("id").toString());
        return xrayTlsCertService.deleteCert(id);
    }
}
