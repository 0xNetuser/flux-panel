package com.admin.controller;

import com.admin.common.aop.LogAnnotation;
import com.admin.common.annotation.RequireRole;
import com.admin.common.dto.GostDto;
import com.admin.common.lang.R;
import com.admin.common.utils.XrayUtil;
import com.admin.entity.Node;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@CrossOrigin
@RequestMapping("/api/v1/xray/node")
public class XrayNodeController extends BaseController {

    @LogAnnotation
    @RequireRole
    @PostMapping("/start")
    public R start(@RequestBody Map<String, Object> params) {
        Long nodeId = Long.valueOf(params.get("nodeId").toString());
        Node node = nodeService.getById(nodeId);
        if (node == null) return R.err("节点不存在");

        GostDto result = XrayUtil.XrayStart(nodeId);
        if (result != null && "OK".equals(result.getMsg())) {
            node.setXrayStatus(1);
            nodeService.updateById(node);
            return R.ok("Xray 已启动");
        }
        return R.err(result != null ? result.getMsg() : "启动失败");
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/stop")
    public R stop(@RequestBody Map<String, Object> params) {
        Long nodeId = Long.valueOf(params.get("nodeId").toString());
        Node node = nodeService.getById(nodeId);
        if (node == null) return R.err("节点不存在");

        GostDto result = XrayUtil.XrayStop(nodeId);
        if (result != null && "OK".equals(result.getMsg())) {
            node.setXrayStatus(0);
            nodeService.updateById(node);
            return R.ok("Xray 已停止");
        }
        return R.err(result != null ? result.getMsg() : "停止失败");
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/restart")
    public R restart(@RequestBody Map<String, Object> params) {
        Long nodeId = Long.valueOf(params.get("nodeId").toString());
        Node node = nodeService.getById(nodeId);
        if (node == null) return R.err("节点不存在");

        GostDto result = XrayUtil.XrayRestart(nodeId);
        if (result != null && "OK".equals(result.getMsg())) {
            node.setXrayStatus(1);
            nodeService.updateById(node);
            return R.ok("Xray 已重启");
        }
        return R.err(result != null ? result.getMsg() : "重启失败");
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/status")
    public R status(@RequestBody Map<String, Object> params) {
        Long nodeId = Long.valueOf(params.get("nodeId").toString());
        Node node = nodeService.getById(nodeId);
        if (node == null) return R.err("节点不存在");

        GostDto result = XrayUtil.XrayStatus(nodeId);
        return R.ok(result != null ? result.getData() : null);
    }
}
