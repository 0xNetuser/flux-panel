FROM golang:1.23-alpine AS builder

ARG TARGETARCH

WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=${TARGETARCH} go build -ldflags="-s -w" -o /gost

FROM alpine:latest

RUN echo "@testing https://dl-cdn.alpinelinux.org/alpine/edge/testing" >> /etc/apk/repositories && \
    apk add --no-cache \
    ca-certificates \
    dsniff@testing

WORKDIR /etc/gost

COPY --from=builder /gost /etc/gost/gost

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
