package com.admin.controller;

import com.admin.common.aop.LogAnnotation;
import com.admin.common.annotation.RequireRole;
import com.admin.common.dto.XrayInboundDto;
import com.admin.common.dto.XrayInboundUpdateDto;
import com.admin.common.lang.R;
import com.admin.service.XrayInboundService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@CrossOrigin
@RequestMapping("/api/v1/xray/inbound")
public class XrayInboundController extends BaseController {

    @Autowired
    private XrayInboundService xrayInboundService;

    @LogAnnotation
    @RequireRole
    @PostMapping("/create")
    public R create(@Validated @RequestBody XrayInboundDto dto) {
        return xrayInboundService.createInbound(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/list")
    public R list(@RequestBody(required = false) Map<String, Object> params) {
        Long nodeId = null;
        if (params != null && params.get("nodeId") != null) {
            nodeId = Long.valueOf(params.get("nodeId").toString());
        }
        return xrayInboundService.listInbounds(nodeId);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/update")
    public R update(@Validated @RequestBody XrayInboundUpdateDto dto) {
        return xrayInboundService.updateInbound(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/delete")
    public R delete(@RequestBody Map<String, Object> params) {
        Long id = Long.valueOf(params.get("id").toString());
        return xrayInboundService.deleteInbound(id);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/enable")
    public R enable(@RequestBody Map<String, Object> params) {
        Long id = Long.valueOf(params.get("id").toString());
        return xrayInboundService.enableInbound(id);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/disable")
    public R disable(@RequestBody Map<String, Object> params) {
        Long id = Long.valueOf(params.get("id").toString());
        return xrayInboundService.disableInbound(id);
    }
}
