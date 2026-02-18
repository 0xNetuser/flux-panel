package com.admin.controller;


import com.admin.common.annotation.RequireRole;
import com.admin.common.aop.LogAnnotation;
import com.admin.common.dto.NodeDto;
import com.admin.common.dto.NodeUpdateDto;
import com.admin.common.lang.R;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * <p>
 *  前端控制器
 * </p>
 *
 * @author QAQ
 * @since 2025-06-03
 */
@RestController
@CrossOrigin
@RequestMapping("/api/v1/node")
public class NodeController extends BaseController {

    @LogAnnotation
    @RequireRole
    @PostMapping("/create")
    public R create(@Validated @RequestBody NodeDto nodeDto) {
        return nodeService.createNode(nodeDto);
    }


    @LogAnnotation
    @RequireRole
    @PostMapping("/list")
    public R list() {
        return nodeService.getAllNodes();
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/update")
    public R update(@Validated @RequestBody NodeUpdateDto nodeUpdateDto) {
        return nodeService.updateNode(nodeUpdateDto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/delete")
    public R delete(@RequestBody Map<String, Object> params) {
        Long id = Long.valueOf(params.get("id").toString());
        return nodeService.deleteNode(id);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/install")
    public R getInstallCommand(@RequestBody Map<String, Object> params) {
        Long id = Long.valueOf(params.get("id").toString());
        return nodeService.getInstallCommand(id);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/install/docker")
    public R getDockerCommand(@RequestBody Map<String, Object> params) {
        Long id = Long.valueOf(params.get("id").toString());
        return nodeService.getDockerCommand(id);
    }

}
