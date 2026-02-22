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
USE_IPV6=$4

if [ -z "$NODE_ID" ] || [ -z "$NODE_SECRET" ] || [ -z "$PANEL_ADDR" ]; then
    echo "Usage: $0 <node_id> <node_secret> <panel_addr> [6]"
    exit 1
fi

CURL_FLAGS="-fsSL"
if [ "$USE_IPV6" = "6" ]; then
    CURL_FLAGS="-6fsSL"
    echo "IPv6 mode enabled"
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
curl $CURL_FLAGS "$PANEL_ADDR/node-install/binary/$ARCH" -o /usr/local/bin/gost-node
chmod +x /usr/local/bin/gost-node

# Create data directory
mkdir -p /etc/gost

# Install Xray from panel
if [ -x /usr/local/bin/xray ]; then
    echo "Xray already installed, skipping..."
else
    echo "Installing Xray for $ARCH..."
    curl $CURL_FLAGS "$PANEL_ADDR/node-install/xray/$ARCH" -o /usr/local/bin/xray || { echo "Warning: Xray download failed, skipping"; }
    if [ -f /usr/local/bin/xray ]; then
        chmod +x /usr/local/bin/xray
        cp /usr/local/bin/xray /etc/gost/xray
        echo "Xray installed: $(/usr/local/bin/xray version 2>/dev/null | head -1)"
    fi
fi

# Detect TLS from panel address
USE_TLS=false
ADDR_VALUE="$PANEL_ADDR"
case "$ADDR_VALUE" in
    https://*) USE_TLS=true ;;
esac
ADDR_VALUE="${ADDR_VALUE#http://}"
ADDR_VALUE="${ADDR_VALUE#https://}"
ADDR_VALUE="${ADDR_VALUE%/}"

# Generate config.json
cat > /etc/gost/config.json << EOF
{
  "addr": "$ADDR_VALUE",
  "secret": "$NODE_SECRET",
  "use_tls": $USE_TLS
}
EOF

# Ensure runtime config file exists
if [ ! -f /etc/gost/gost.json ]; then
    echo "{}" > /etc/gost/gost.json
fi

# Create systemd service
cat > /etc/systemd/system/gost-node.service << EOF
[Unit]
Description=GOST Node
After=network.target

[Service]
Type=simple
WorkingDirectory=/etc/gost
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
echo "Config: /etc/gost/config.json"
echo "Logs: journalctl -u gost-node -f"
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

	binaryPath := filepath.Join(config.Cfg.NodeBinaryDir, fmt.Sprintf("gost-%s", arch))

	if _, err := os.Stat(binaryPath); os.IsNotExist(err) {
		c.String(http.StatusNotFound, "Binary not found for architecture: "+arch)
		return
	}

	c.Header("Content-Type", "application/octet-stream")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=gost-%s", arch))
	c.File(binaryPath)
}

func NodeInstallXray(c *gin.Context) {
	arch := c.Param("arch")
	if !allowedArchs[arch] {
		c.String(http.StatusBadRequest, "invalid architecture")
		return
	}

	binaryPath := filepath.Join(config.Cfg.NodeBinaryDir, fmt.Sprintf("xray-%s", arch))

	if _, err := os.Stat(binaryPath); os.IsNotExist(err) {
		c.String(http.StatusNotFound, "Xray binary not found for architecture: "+arch)
		return
	}

	c.Header("Content-Type", "application/octet-stream")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=xray-%s", arch))
	c.File(binaryPath)
}
