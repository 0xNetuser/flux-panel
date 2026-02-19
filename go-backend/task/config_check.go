package task

import "log"

// RunConfigCheck is called when a node comes online.
// Actual config cleanup happens via /flow/config endpoint when the node sends its config.
func RunConfigCheck(nodeId int64) {
	log.Printf("[ConfigCheck] Node %d online, awaiting config via /flow/config", nodeId)
}
