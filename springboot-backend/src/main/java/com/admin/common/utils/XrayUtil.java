package com.admin.common.utils;

import com.admin.common.dto.GostDto;
import com.admin.entity.XrayInbound;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;

import java.util.List;

public class XrayUtil {

    public static GostDto XrayStart(Long nodeId) {
        JSONObject data = new JSONObject();
        return WebSocketServer.send_msg(nodeId, data, "XrayStart");
    }

    public static GostDto XrayStop(Long nodeId) {
        JSONObject data = new JSONObject();
        return WebSocketServer.send_msg(nodeId, data, "XrayStop");
    }

    public static GostDto XrayRestart(Long nodeId) {
        JSONObject data = new JSONObject();
        return WebSocketServer.send_msg(nodeId, data, "XrayRestart");
    }

    public static GostDto XrayStatus(Long nodeId) {
        JSONObject data = new JSONObject();
        return WebSocketServer.send_msg(nodeId, data, "XrayStatus");
    }

    public static GostDto XrayAddInbound(Long nodeId, XrayInbound inbound) {
        JSONObject data = new JSONObject();
        data.put("tag", inbound.getTag());
        data.put("protocol", inbound.getProtocol());
        data.put("listen", inbound.getListen());
        data.put("port", inbound.getPort());
        data.put("settingsJson", inbound.getSettingsJson());
        data.put("streamSettingsJson", inbound.getStreamSettingsJson());
        data.put("sniffingJson", inbound.getSniffingJson());
        return WebSocketServer.send_msg(nodeId, data, "XrayAddInbound");
    }

    public static GostDto XrayRemoveInbound(Long nodeId, String tag) {
        JSONObject data = new JSONObject();
        data.put("tag", tag);
        return WebSocketServer.send_msg(nodeId, data, "XrayRemoveInbound");
    }

    public static GostDto XrayAddClient(Long nodeId, String inboundTag, String email, String uuidOrPassword, String flow, int alterId, String protocol) {
        JSONObject data = new JSONObject();
        data.put("inboundTag", inboundTag);
        data.put("email", email);
        data.put("uuidOrPassword", uuidOrPassword);
        data.put("flow", flow);
        data.put("alterId", alterId);
        data.put("protocol", protocol);
        return WebSocketServer.send_msg(nodeId, data, "XrayAddClient");
    }

    public static GostDto XrayRemoveClient(Long nodeId, String inboundTag, String email) {
        JSONObject data = new JSONObject();
        data.put("inboundTag", inboundTag);
        data.put("email", email);
        return WebSocketServer.send_msg(nodeId, data, "XrayRemoveClient");
    }

    public static GostDto XrayGetTraffic(Long nodeId) {
        JSONObject data = new JSONObject();
        data.put("reset", true);
        return WebSocketServer.send_msg(nodeId, data, "XrayGetTraffic");
    }

    public static GostDto XrayApplyConfig(Long nodeId, List<XrayInbound> inbounds) {
        JSONArray inboundsArray = new JSONArray();
        for (XrayInbound inbound : inbounds) {
            JSONObject obj = new JSONObject();
            obj.put("tag", inbound.getTag());
            obj.put("protocol", inbound.getProtocol());
            obj.put("listen", inbound.getListen());
            obj.put("port", inbound.getPort());
            obj.put("settingsJson", inbound.getSettingsJson());
            obj.put("streamSettingsJson", inbound.getStreamSettingsJson());
            obj.put("sniffingJson", inbound.getSniffingJson());
            inboundsArray.add(obj);
        }
        JSONObject data = new JSONObject();
        data.put("inbounds", inboundsArray);
        return WebSocketServer.send_msg(nodeId, data, "XrayApplyConfig");
    }

    public static GostDto XrayDeployCert(Long nodeId, String domain, String publicKey, String privateKey) {
        JSONObject data = new JSONObject();
        data.put("domain", domain);
        data.put("publicKey", publicKey);
        data.put("privateKey", privateKey);
        return WebSocketServer.send_msg(nodeId, data, "XrayDeployCert");
    }
}
