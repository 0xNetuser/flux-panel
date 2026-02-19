package com.admin.common.dto;

import lombok.Data;
import javax.validation.constraints.NotNull;

@Data
public class XrayClientUpdateDto {

    @NotNull(message = "ID不能为空")
    private Long id;

    private String flow;

    private Integer alterId;

    private Long totalTraffic;

    private Long expTime;

    private Integer enable;

    private String remark;
}
