package port

import (
	"fmt"
	"net"
	"os/exec"
	"strconv"
)

func ForceClosePortConnections(addr string) (err error) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("⚠️ ForceClosePortConnections panic recovered: %v\n", r)
			err = nil // 永远返回 nil
		}
	}()

	if addr == "" {
		fmt.Println("⚠️ 地址为空")
		return nil
	}

	_, portStr, err := net.SplitHostPort(addr)
	if err != nil {
		fmt.Printf("⚠️ 地址解析失败: %v\n", err)
		return nil
	}

	port, err := strconv.Atoi(portStr)
	if err != nil {
		fmt.Printf("⚠️ 端口非法: %v\n", err)
		return nil
	}

	cmd := exec.Command("ss", "-K", "sport", "=", fmt.Sprintf(":%d", port))
	if output, err := cmd.CombinedOutput(); err != nil {
		fmt.Printf("⚠️ ss -K 断开连接失败: %v, output: %s\n", err, string(output))
		return nil
	}

	fmt.Printf("✅ 已断开端口 %d 上的所有连接\n", port)
	return nil
}
