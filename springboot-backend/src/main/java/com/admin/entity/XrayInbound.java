package com.admin.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;

@Data
@TableName("xray_inbound")
public class XrayInbound implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    private Long nodeId;

    private String tag;

    private String protocol;

    private String listen;

    private Integer port;

    private String settingsJson;

    private String streamSettingsJson;

    private String sniffingJson;

    private String remark;

    private Integer enable;

    private Long createdTime;

    private Long updatedTime;
}
