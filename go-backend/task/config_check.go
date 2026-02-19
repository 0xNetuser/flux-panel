package task

import (
	"flux-panel/go-backend/service"
	"log"
	"time"
)

// RunConfigCheck is called when a node comes online.
// It delays briefly then triggers a full config reconciliation.
func RunConfigCheck(nodeId int64) {
	log.Printf("[ConfigCheck] Node %d online, scheduling reconcile", nodeId)
	go func() {
		time.Sleep(2 * time.Second)
		service.ReconcileNode(nodeId)
	}()
}
