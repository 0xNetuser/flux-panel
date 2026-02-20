FROM alpine:latest

ARG TARGETARCH
ARG XRAY_VERSION=25.1.30

RUN apk add --no-cache ca-certificates iproute2 wget unzip

# Install Xray binary (optional, controlled by XRAY_ENABLE at runtime)
RUN XRAY_ARCH=$(case ${TARGETARCH} in amd64) echo "64";; arm64) echo "arm64-v8a";; *) echo "64";; esac) && \
    wget -q "https://github.com/XTLS/Xray-core/releases/download/v${XRAY_VERSION}/Xray-linux-${XRAY_ARCH}.zip" -O /tmp/xray.zip && \
    unzip -q /tmp/xray.zip -d /tmp/xray && \
    mv /tmp/xray/xray /usr/local/bin/xray && \
    chmod +x /usr/local/bin/xray && \
    rm -rf /tmp/xray /tmp/xray.zip || true

WORKDIR /etc/gost

COPY gost-${TARGETARCH} /usr/local/bin/gost
RUN chmod +x /usr/local/bin/gost

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
