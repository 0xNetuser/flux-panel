package com.admin.controller;

import com.admin.common.lang.R;
import com.admin.common.utils.JwtUtil;
import com.admin.entity.User;
import com.admin.entity.XrayClient;
import com.admin.service.XrayClientService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletResponse;
import java.util.*;

@RestController
@CrossOrigin
@RequestMapping("/api/v1/xray/sub")
public class XraySubscriptionController extends BaseController {

    @Autowired
    private XrayClientService xrayClientService;

    /**
     * 订阅链接 - 通过 JWT token 验证用户身份
     * GET /api/v1/xray/sub/{token}
     */
    @GetMapping("/{token}")
    public void subscribe(@PathVariable String token, HttpServletResponse response) {
        try {
            // 验证 token
            if (!JwtUtil.validateToken(token)) {
                response.setStatus(403);
                response.getWriter().write("Invalid or expired token");
                return;
            }

            Long userId = JwtUtil.getUserIdFromToken(token);
            User user = userService.getById(userId);
            if (user == null || user.getStatus() != 1) {
                response.setStatus(403);
                response.getWriter().write("User not found or disabled");
                return;
            }

            // 获取订阅链接
            R result = xrayClientService.getSubscriptionLinks(userId);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> links = (List<Map<String, Object>>) result.getData();

            // 构建订阅内容
            StringBuilder sb = new StringBuilder();
            if (links != null) {
                for (Map<String, Object> item : links) {
                    sb.append(item.get("link")).append("\n");
                }
            }

            String subscriptionContent = Base64.getEncoder().encodeToString(sb.toString().getBytes());

            // 计算用户流量信息
            long upload = user.getOutFlow() != null ? user.getOutFlow() : 0;
            long download = user.getInFlow() != null ? user.getInFlow() : 0;
            long total = user.getFlow() != null ? user.getFlow() * 1024L * 1024L * 1024L : 0;
            long expire = user.getExpTime() != null ? user.getExpTime() / 1000 : 0;

            // 查询 Xray 客户端流量
            List<XrayClient> clients = xrayClientService.list(
                    new QueryWrapper<XrayClient>().eq("user_id", userId));
            for (XrayClient client : clients) {
                upload += client.getUpTraffic() != null ? client.getUpTraffic() : 0;
                download += client.getDownTraffic() != null ? client.getDownTraffic() : 0;
            }

            // 设置响应头
            response.setContentType("text/plain; charset=utf-8");
            response.setHeader("subscription-userinfo",
                    "upload=" + upload + "; download=" + download + "; total=" + total + "; expire=" + expire);
            response.setHeader("Content-Disposition", "attachment; filename=\"flux_subscription\"");

            response.getWriter().write(subscriptionContent);
        } catch (Exception e) {
            try {
                response.setStatus(500);
                response.getWriter().write("Internal error");
            } catch (Exception ignored) {}
        }
    }

    /**
     * 获取当前用户的订阅 token（需要登录）
     */
    @PostMapping("/token")
    public R getSubscriptionToken() {
        Integer userId = JwtUtil.getUserIdFromToken();
        User user = userService.getById(userId);
        if (user == null) {
            return R.err("用户不存在");
        }

        // 生成长期有效的订阅 token
        String token = JwtUtil.generateToken(user);

        Map<String, Object> data = new HashMap<>();
        data.put("token", token);
        return R.ok(data);
    }

    /**
     * 获取当前用户的订阅链接列表
     */
    @PostMapping("/links")
    public R getLinks() {
        Integer userId = JwtUtil.getUserIdFromToken();
        return xrayClientService.getSubscriptionLinks(Long.valueOf(userId));
    }
}
