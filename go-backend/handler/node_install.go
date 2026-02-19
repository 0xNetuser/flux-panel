package handler

import (
	"flux-panel/go-backend/config"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
)

func NodeInstallScript(c *gin.Context) {
	script := `#!/bin/bash
set -e

NODE_ID=$1
NODE_SECRET=$2
PANEL_ADDR=$3

if [ -z "$NODE_ID" ] || [ -z "$NODE_SECRET" ] || [ -z "$PANEL_ADDR" ]; then
    echo "Usage: $0 <node_id> <node_secret> <panel_addr>"
    exit 1
fi

# Detect architecture
ARCH=$(uname -m)
case $ARCH in
    x86_64) ARCH="amd64" ;;
    aarch64) ARCH="arm64" ;;
    armv7l) ARCH="arm" ;;
    *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

# Download binary
echo "Downloading gost-node for $ARCH..."
curl -fsSL "$PANEL_ADDR/node-install/binary/$ARCH" -o /usr/local/bin/gost-node
chmod +x /usr/local/bin/gost-node

# Convert panel address to WebSocket address
WS_ADDR=$(echo "$PANEL_ADDR" | sed 's|^https://|wss://|; s|^http://|ws://|')

# Create systemd service
cat > /etc/systemd/system/gost-node.service << EOF
[Unit]
Description=GOST Node
After=network.target

[Service]
Type=simple
Environment=NODE_ID=$NODE_ID
Environment=NODE_SECRET=$NODE_SECRET
Environment=WS_ADDR=${WS_ADDR}/system-info
Environment=FLOW_ADDR=$PANEL_ADDR
ExecStart=/usr/local/bin/gost-node
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable gost-node
systemctl restart gost-node

echo "GOST Node installed and started successfully!"
echo "Node ID: $NODE_ID"
`
	c.Header("Content-Type", "text/plain; charset=utf-8")
	c.String(http.StatusOK, script)
}

var allowedArchs = map[string]bool{
	"amd64": true,
	"arm64": true,
	"arm":   true,
}

func NodeInstallBinary(c *gin.Context) {
	arch := c.Param("arch")
	if !allowedArchs[arch] {
		c.String(http.StatusBadRequest, "invalid architecture")
		return
	}

	binaryPath := filepath.Join(config.Cfg.NodeBinaryDir, fmt.Sprintf("gost-node-%s", arch))

	if _, err := os.Stat(binaryPath); os.IsNotExist(err) {
		c.String(http.StatusNotFound, "Binary not found for architecture: "+arch)
		return
	}

	c.Header("Content-Type", "application/octet-stream")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=gost-node-%s", arch))
	c.File(binaryPath)
}
