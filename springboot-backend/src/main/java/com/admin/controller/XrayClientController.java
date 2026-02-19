package com.admin.controller;

import com.admin.common.aop.LogAnnotation;
import com.admin.common.annotation.RequireRole;
import com.admin.common.dto.XrayClientDto;
import com.admin.common.dto.XrayClientUpdateDto;
import com.admin.common.lang.R;
import com.admin.service.XrayClientService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@CrossOrigin
@RequestMapping("/api/v1/xray/client")
public class XrayClientController extends BaseController {

    @Autowired
    private XrayClientService xrayClientService;

    @LogAnnotation
    @RequireRole
    @PostMapping("/create")
    public R create(@Validated @RequestBody XrayClientDto dto) {
        return xrayClientService.createClient(dto);
    }

    @LogAnnotation
    @PostMapping("/list")
    public R list(@RequestBody(required = false) Map<String, Object> params) {
        Long inboundId = null;
        Long userId = null;
        if (params != null) {
            if (params.get("inboundId") != null) {
                inboundId = Long.valueOf(params.get("inboundId").toString());
            }
            if (params.get("userId") != null) {
                userId = Long.valueOf(params.get("userId").toString());
            }
        }
        return xrayClientService.listClients(inboundId, userId);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/update")
    public R update(@Validated @RequestBody XrayClientUpdateDto dto) {
        return xrayClientService.updateClient(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/delete")
    public R delete(@RequestBody Map<String, Object> params) {
        Long id = Long.valueOf(params.get("id").toString());
        return xrayClientService.deleteClient(id);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/reset-traffic")
    public R resetTraffic(@RequestBody Map<String, Object> params) {
        Long id = Long.valueOf(params.get("id").toString());
        return xrayClientService.resetTraffic(id);
    }
}
