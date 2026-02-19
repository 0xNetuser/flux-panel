FROM alpine:latest
ARG TARGETARCH
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY app-${TARGETARCH} ./app
RUN chmod +x ./app
EXPOSE 6365
CMD ["./app"]
