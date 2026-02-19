package service

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"flux-panel/go-backend/model"
	"flux-panel/go-backend/pkg"
	"log"
	"time"

	"github.com/go-acme/lego/v4/certcrypto"
	"github.com/go-acme/lego/v4/certificate"
	"github.com/go-acme/lego/v4/challenge/dns01"
	"github.com/go-acme/lego/v4/lego"
	"github.com/go-acme/lego/v4/providers/dns/cloudflare"
	"github.com/go-acme/lego/v4/registration"
)

// AcmeUser implements lego's registration.User interface
type AcmeUser struct {
	Email        string
	Registration *registration.Resource
	Key          crypto.PrivateKey
}

func (u *AcmeUser) GetEmail() string                        { return u.Email }
func (u *AcmeUser) GetRegistration() *registration.Resource { return u.Registration }
func (u *AcmeUser) GetPrivateKey() crypto.PrivateKey         { return u.Key }

// issueCertViaAcme handles ACME certificate issuance for a given cert record.
func issueCertViaAcme(cert *model.XrayTlsCert) error {
	if cert.AcmeEmail == "" {
		return fmt.Errorf("ACME email 未配置")
	}

	// Generate a private key for the ACME user
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return fmt.Errorf("生成密钥失败: %w", err)
	}

	user := &AcmeUser{
		Email: cert.AcmeEmail,
		Key:   privateKey,
	}

	config := lego.NewConfig(user)
	config.Certificate.KeyType = certcrypto.RSA2048

	client, err := lego.NewClient(config)
	if err != nil {
		return fmt.Errorf("创建 ACME 客户端失败: %w", err)
	}

	// Register with ACME server
	reg, err := client.Registration.Register(registration.RegisterOptions{TermsOfServiceAgreed: true})
	if err != nil {
		return fmt.Errorf("ACME 注册失败: %w", err)
	}
	user.Registration = reg

	// Configure challenge based on type
	switch cert.ChallengeType {
	case "dns01":
		if err := configureDnsChallenge(client, cert); err != nil {
			return err
		}
	default:
		return fmt.Errorf("不支持的验证方式: %s (目前仅支持 dns01)", cert.ChallengeType)
	}

	// Request certificate
	request := certificate.ObtainRequest{
		Domains: []string{cert.Domain},
		Bundle:  true,
	}

	certificates, err := client.Certificate.Obtain(request)
	if err != nil {
		return fmt.Errorf("证书签发失败: %w", err)
	}

	// Parse certificate to get expiry time
	var expireTime int64
	block, _ := pem.Decode(certificates.Certificate)
	if block != nil {
		parsedCert, err := x509.ParseCertificate(block.Bytes)
		if err == nil {
			expireTime = parsedCert.NotAfter.UnixMilli()
		}
	}

	now := time.Now().UnixMilli()

	// Update database
	updates := map[string]interface{}{
		"public_key":      string(certificates.Certificate),
		"private_key":     string(certificates.PrivateKey),
		"expire_time":     expireTime,
		"last_renew_time": now,
		"renew_error":     "",
		"auto_renew":      1,
		"updated_time":    now,
	}
	DB.Model(cert).Updates(updates)

	// Deploy to node
	node := GetNodeById(cert.NodeId)
	if node != nil {
		result := pkg.XrayDeployCert(node.ID, cert.Domain,
			string(certificates.Certificate), string(certificates.PrivateKey))
		if result != nil && result.Msg != "OK" {
			log.Printf("部署 ACME 证书到节点 %d 失败: %s", node.ID, result.Msg)
		}
	}

	log.Printf("[ACME] 证书签发成功: domain=%s, expires=%s",
		cert.Domain, time.UnixMilli(expireTime).Format("2006-01-02"))

	return nil
}

// configureDnsChallenge sets up DNS-01 challenge provider
func configureDnsChallenge(client *lego.Client, cert *model.XrayTlsCert) error {
	switch cert.DnsProvider {
	case "cloudflare":
		return configureCloudflare(client, cert)
	default:
		return fmt.Errorf("不支持的 DNS provider: %s", cert.DnsProvider)
	}
}

// configureCloudflare sets up Cloudflare DNS provider
func configureCloudflare(client *lego.Client, cert *model.XrayTlsCert) error {
	var dnsConfig map[string]string
	if err := json.Unmarshal([]byte(cert.DnsConfig), &dnsConfig); err != nil {
		return fmt.Errorf("DNS 配置解析失败: %w", err)
	}

	apiToken := dnsConfig["apiToken"]
	if apiToken == "" {
		return fmt.Errorf("Cloudflare API Token 未配置")
	}

	cfConfig := cloudflare.NewDefaultConfig()
	cfConfig.AuthToken = apiToken

	provider, err := cloudflare.NewDNSProviderConfig(cfConfig)
	if err != nil {
		return fmt.Errorf("创建 Cloudflare provider 失败: %w", err)
	}

	return client.Challenge.SetDNS01Provider(provider, dns01.AddDNSTimeout(60*time.Second))
}

// RenewExpiringSoon checks for ACME-enabled certificates expiring within 30 days
// and attempts to renew them. Called by the scheduler.
func RenewExpiringSoon() {
	thirtyDaysFromNow := time.Now().Add(30 * 24 * time.Hour).UnixMilli()
	now := time.Now().UnixMilli()

	var certs []model.XrayTlsCert
	DB.Where("acme_enabled = 1 AND expire_time > 0 AND expire_time < ? AND expire_time > ?",
		thirtyDaysFromNow, now).Find(&certs)

	if len(certs) == 0 {
		return
	}

	log.Printf("[ACME] 发现 %d 个即将到期的证书需要续签", len(certs))

	for _, cert := range certs {
		err := issueCertViaAcme(&cert)
		if err != nil {
			log.Printf("[ACME] 续签失败: domain=%s, error=%s", cert.Domain, err.Error())
			DB.Model(&cert).Updates(map[string]interface{}{
				"renew_error":  err.Error(),
				"updated_time": time.Now().UnixMilli(),
			})
		} else {
			log.Printf("[ACME] 续签成功: domain=%s", cert.Domain)
		}
	}
}
