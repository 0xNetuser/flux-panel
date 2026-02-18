package com.admin.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;

/**
 * 节点安装文件下载控制器（无需认证）
 * 路径在 /node-install 下，不在 /api/** 下，自然绕过 JWT 拦截器
 */
@RestController
@CrossOrigin
@RequestMapping("/node-install")
public class NodeInstallController {

    @Value("${node.binary.dir:/data/node}")
    private String binaryDir;

    /**
     * 下载节点安装脚本
     */
    @GetMapping("/script")
    public ResponseEntity<Resource> getInstallScript() {
        ClassPathResource resource = new ClassPathResource("node/install.sh");
        if (!resource.exists()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, "application/x-sh")
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=install.sh")
                .body(resource);
    }

    /**
     * 下载节点二进制文件
     * @param arch 架构：amd64 或 arm64
     */
    @GetMapping("/binary/{arch}")
    public ResponseEntity<Resource> getBinary(@PathVariable String arch) {
        if (!arch.matches("^(amd64|arm64)$")) {
            return ResponseEntity.badRequest().build();
        }

        File binaryFile = new File(binaryDir, "gost-" + arch);
        if (!binaryFile.exists()) {
            return ResponseEntity.notFound().build();
        }

        Resource resource = new FileSystemResource(binaryFile);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_OCTET_STREAM_VALUE)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=gost-" + arch)
                .contentLength(binaryFile.length())
                .body(resource);
    }
}
