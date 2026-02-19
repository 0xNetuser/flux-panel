package com.admin.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;

@Data
@TableName("xray_tls_cert")
public class XrayTlsCert implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    private Long nodeId;

    private String domain;

    private String publicKey;

    private String privateKey;

    private Integer autoRenew;

    private Long expireTime;

    private Long createdTime;

    private Long updatedTime;
}
