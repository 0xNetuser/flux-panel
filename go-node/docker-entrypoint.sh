#!/bin/sh
set -e

CONFIG_FILE="/etc/node/config.json"
RUNTIME_CONFIG="/etc/node/runtime.json"
BIN_NAME="node-svc"
AUX_NAME="svc-runtime"
AUX_CFG="service.json"

if [ -n "$APP_NAME" ]; then
  BIN_NAME="$APP_NAME"
fi
if [ -n "$SEC_NAME" ]; then
  AUX_NAME="$SEC_NAME"
fi
if [ -n "$SEC_CFG" ]; then
  AUX_CFG="$SEC_CFG"
fi

read_json_value() {
  key="$1"
  file="$2"
  sed -n "s/.*\\\"$key\\\"[[:space:]]*:[[:space:]]*\\\"\\([^\\\"]*\\)\\\".*/\\1/p" "$file" | head -n 1
}

# Generate config.json from environment variables if set
if [ -n "$PANEL_ADDR" ] && [ -n "$SECRET" ]; then
  ADDR_VALUE="$PANEL_ADDR"
  USE_TLS=false
  case "$ADDR_VALUE" in
    https://*) USE_TLS=true ;;
  esac
  ADDR_VALUE="${ADDR_VALUE#http://}"
  ADDR_VALUE="${ADDR_VALUE#https://}"
  ADDR_VALUE="${ADDR_VALUE%/}"

  cat > "$CONFIG_FILE" <<EOF
{
  "addr": "$ADDR_VALUE",
  "secret": "$SECRET",
  "use_tls": $USE_TLS,
  "v_bin": "$AUX_NAME",
  "v_cfg": "$AUX_CFG"
}
EOF
else
  if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: PANEL_ADDR/SECRET not set and $CONFIG_FILE not found."
    echo "Provide configuration via one of:"
    echo "  1. Environment: -e PANEL_ADDR=http://panel:6366 -e SECRET=<secret>"
    echo "  2. Mount config: -v ./config.json:/etc/node/config.json"
    exit 1
  fi
  if [ -z "$SEC_NAME" ]; then
    cfg_v_bin="$(read_json_value "v_bin" "$CONFIG_FILE")"
    if [ -n "$cfg_v_bin" ]; then
      AUX_NAME="$cfg_v_bin"
    fi
  fi
  if [ -z "$SEC_CFG" ]; then
    cfg_v_cfg="$(read_json_value "v_cfg" "$CONFIG_FILE")"
    if [ -n "$cfg_v_cfg" ]; then
      AUX_CFG="$cfg_v_cfg"
    fi
  fi
fi

# Migrate legacy config files before cleanup
if [ -f /etc/node/gost.json ] && [ ! -f "$RUNTIME_CONFIG" ]; then
  mv /etc/node/gost.json "$RUNTIME_CONFIG"
fi
if [ -f /etc/node/xray_config.json ] && [ ! -f "/etc/node/$AUX_CFG" ]; then
  mv /etc/node/xray_config.json "/etc/node/$AUX_CFG"
fi
# Clean up legacy persisted files from old versions
rm -f /etc/node/gost /etc/node/gost-node /etc/node/xray
rm -f /etc/node/gost.json /etc/node/xray_config.json

# Ensure runtime config exists
if [ ! -f "$RUNTIME_CONFIG" ]; then
  echo "{}" > "$RUNTIME_CONFIG"
fi

# Detect image update: compare image binary checksum with persisted marker.
# If the image was updated (docker compose pull), clear persisted binaries
# so the new image binary takes effect instead of the old persisted one.
IMAGE_HASH=$(md5sum /usr/local/bin/node-svc 2>/dev/null | cut -d' ' -f1)
STORED_HASH=$(cat /etc/node/.image_hash 2>/dev/null || echo "")
if [ "$IMAGE_HASH" != "$STORED_HASH" ]; then
  # New image detected, remove persisted binaries
  rm -f /etc/node/node-svc /etc/node/svc-runtime
  rm -f "/etc/node/$BIN_NAME" "/etc/node/$AUX_NAME"
  echo "$IMAGE_HASH" > /etc/node/.image_hash
else
  # Same image, restore persisted binaries (from panel binary-only update)
  if [ -f /etc/node/node-svc ]; then
    cp /etc/node/node-svc /usr/local/bin/node-svc
    chmod +x /usr/local/bin/node-svc
  fi
  if [ -f /etc/node/svc-runtime ]; then
    cp /etc/node/svc-runtime /usr/local/bin/svc-runtime
    chmod +x /usr/local/bin/svc-runtime
  fi
  if [ -f "/etc/node/$BIN_NAME" ]; then
    cp "/etc/node/$BIN_NAME" "/usr/local/bin/$BIN_NAME"
    chmod +x "/usr/local/bin/$BIN_NAME"
  fi
  if [ -f "/etc/node/$AUX_NAME" ]; then
    cp "/etc/node/$AUX_NAME" "/usr/local/bin/$AUX_NAME"
    chmod +x "/usr/local/bin/$AUX_NAME"
  fi
fi

if [ "$BIN_NAME" != "node-svc" ]; then
  if [ ! -f "/usr/local/bin/$BIN_NAME" ]; then
    cp /usr/local/bin/node-svc "/usr/local/bin/$BIN_NAME"
    chmod +x "/usr/local/bin/$BIN_NAME"
  fi
fi

if [ "$AUX_NAME" != "svc-runtime" ]; then
  if [ ! -f "/usr/local/bin/$AUX_NAME" ]; then
    cp /usr/local/bin/svc-runtime "/usr/local/bin/$AUX_NAME"
    chmod +x "/usr/local/bin/$AUX_NAME"
  fi
fi

exec "/usr/local/bin/$BIN_NAME"
