package com.admin.common.dto;

import lombok.Data;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class XrayTlsCertDto {

    @NotNull(message = "节点ID不能为空")
    private Long nodeId;

    @NotBlank(message = "域名不能为空")
    private String domain;

    @NotBlank(message = "公钥不能为空")
    private String publicKey;

    @NotBlank(message = "私钥不能为空")
    private String privateKey;

    private Integer autoRenew;

    private Long expireTime;
}
