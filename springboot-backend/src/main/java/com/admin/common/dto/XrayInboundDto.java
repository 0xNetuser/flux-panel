package com.admin.common.dto;

import lombok.Data;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Min;
import javax.validation.constraints.Max;

@Data
public class XrayInboundDto {

    @NotNull(message = "节点ID不能为空")
    private Long nodeId;

    @NotBlank(message = "标签不能为空")
    private String tag;

    @NotBlank(message = "协议不能为空")
    private String protocol;

    private String listen;

    @NotNull(message = "端口不能为空")
    @Min(value = 1, message = "端口号不能小于1")
    @Max(value = 65535, message = "端口号不能大于65535")
    private Integer port;

    @NotBlank(message = "协议配置不能为空")
    private String settingsJson;

    private String streamSettingsJson;

    private String sniffingJson;

    private String remark;
}
