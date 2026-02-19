package xray

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/go-gost/x/internal/util/crypto"
)

// TrafficReporter periodically queries Xray traffic stats and uploads to the panel
type TrafficReporter struct {
	grpcClient *XrayGrpcClient
	panelURL   string // Panel base URL (e.g., http://panel:6365)
	secret     string // Node secret for authentication
	interval   time.Duration
	ctx        context.Context
	cancel     context.CancelFunc
	aesCrypto  *crypto.AESCrypto
	useTLS     bool
}

// TrafficUploadPayload is the JSON payload sent to the panel
type TrafficUploadPayload struct {
	Clients []TrafficStat `json:"clients"`
}

// NewTrafficReporter creates a new TrafficReporter
func NewTrafficReporter(grpcAddr, panelURL, secret string, useTLS bool) *TrafficReporter {
	ctx, cancel := context.WithCancel(context.Background())

	var aesCrypto *crypto.AESCrypto
	if secret != "" {
		var err error
		aesCrypto, err = crypto.NewAESCrypto(secret)
		if err != nil {
			fmt.Printf("⚠️ Xray TrafficReporter: failed to create AES crypto: %v\n", err)
		}
	}

	return &TrafficReporter{
		grpcClient: NewXrayGrpcClient(grpcAddr),
		panelURL:   panelURL,
		secret:     secret,
		interval:   30 * time.Second,
		ctx:        ctx,
		cancel:     cancel,
		aesCrypto:  aesCrypto,
		useTLS:     useTLS,
	}
}

// Start begins the traffic reporting loop
func (r *TrafficReporter) Start() {
	go r.run()
}

// Stop stops the traffic reporter
func (r *TrafficReporter) Stop() {
	r.cancel()
}

func (r *TrafficReporter) run() {
	ticker := time.NewTicker(r.interval)
	defer ticker.Stop()

	for {
		select {
		case <-r.ctx.Done():
			return
		case <-ticker.C:
			r.reportTraffic()
		}
	}
}

func (r *TrafficReporter) reportTraffic() {
	// Query traffic with reset=true to get incremental stats
	stats, err := r.grpcClient.QueryTraffic(true)
	if err != nil {
		fmt.Printf("⚠️ Xray traffic query failed: %v\n", err)
		return
	}

	if len(stats) == 0 {
		return
	}

	// Filter out zero-traffic entries
	var nonZeroStats []TrafficStat
	for _, stat := range stats {
		if stat.Uplink > 0 || stat.Downlink > 0 {
			nonZeroStats = append(nonZeroStats, stat)
		}
	}

	if len(nonZeroStats) == 0 {
		return
	}

	// Build upload payload
	payload := TrafficUploadPayload{
		Clients: nonZeroStats,
	}

	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		fmt.Printf("⚠️ Failed to marshal traffic data: %v\n", err)
		return
	}

	// Upload to panel
	scheme := "http"
	if r.useTLS {
		scheme = "https"
	}
	url := fmt.Sprintf("%s://%s/flow/xray-upload?secret=%s", scheme, r.panelURL, r.secret)

	var bodyData []byte
	if r.aesCrypto != nil {
		// Encrypt the payload
		encrypted, err := r.aesCrypto.Encrypt(payloadJSON)
		if err != nil {
			fmt.Printf("⚠️ Failed to encrypt traffic data: %v\n", err)
			bodyData = payloadJSON
		} else {
			wrapper := map[string]interface{}{
				"encrypted": true,
				"data":      encrypted,
				"timestamp": time.Now().Unix(),
			}
			bodyData, _ = json.Marshal(wrapper)
		}
	} else {
		bodyData = payloadJSON
	}

	resp, err := http.Post(url, "application/json", bytes.NewReader(bodyData))
	if err != nil {
		fmt.Printf("⚠️ Failed to upload Xray traffic: %v\n", err)
		return
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)

	fmt.Printf("📊 Xray traffic reported: %d clients\n", len(nonZeroStats))
}
