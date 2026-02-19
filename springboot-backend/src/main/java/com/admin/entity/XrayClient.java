package com.admin.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;

@Data
@TableName("xray_client")
public class XrayClient implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    private Long inboundId;

    private Long userId;

    private String email;

    private String uuidOrPassword;

    private String flow;

    private Integer alterId;

    private Long totalTraffic;

    private Long upTraffic;

    private Long downTraffic;

    private Long expTime;

    private Integer enable;

    private String remark;

    private Long createdTime;

    private Long updatedTime;
}
