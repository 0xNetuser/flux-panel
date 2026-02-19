package com.admin.common.dto;

import lombok.Data;
import javax.validation.constraints.NotNull;

@Data
public class XrayClientDto {

    @NotNull(message = "入站ID不能为空")
    private Long inboundId;

    @NotNull(message = "用户ID不能为空")
    private Long userId;

    private String uuidOrPassword;

    private String flow;

    private Integer alterId;

    private Long totalTraffic;

    private Long expTime;

    private String remark;
}
