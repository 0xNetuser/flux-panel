package com.admin.common.dto;

import lombok.Data;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Min;
import javax.validation.constraints.Max;

@Data
public class XrayInboundUpdateDto {

    @NotNull(message = "ID不能为空")
    private Long id;

    private String tag;

    private String protocol;

    private String listen;

    @Min(value = 1, message = "端口号不能小于1")
    @Max(value = 65535, message = "端口号不能大于65535")
    private Integer port;

    private String settingsJson;

    private String streamSettingsJson;

    private String sniffingJson;

    private String remark;
}
