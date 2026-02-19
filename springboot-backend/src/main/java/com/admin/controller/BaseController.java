package com.admin.controller;

import com.admin.service.*;
import org.springframework.beans.factory.annotation.Autowired;

public class BaseController {

    @Autowired
    UserService userService;

    @Autowired
    NodeService nodeService;

    @Autowired
    UserTunnelService userTunnelService;

    @Autowired
    TunnelService tunnelService;

    @Autowired
    ForwardService forwardService;

    @Autowired
    ViteConfigService viteConfigService;

    @Autowired
    XrayInboundService xrayInboundService;

    @Autowired
    XrayClientService xrayClientService;

    @Autowired
    XrayTlsCertService xrayTlsCertService;

}
