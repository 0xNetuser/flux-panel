package service

import (
	"flux-panel/go-backend/dto"
	"flux-panel/go-backend/model"
	"flux-panel/go-backend/pkg"
	"sort"
	"time"
)

// GetNodeHealthList returns current health status for all nodes.
func GetNodeHealthList() dto.R {
	var nodes []model.Node
	DB.Find(&nodes)

	result := make([]map[string]interface{}, 0, len(nodes))
	for _, n := range nodes {
		online := pkg.WS != nil && pkg.WS.IsNodeOnline(n.ID)
		item := map[string]interface{}{
			"id":        n.ID,
			"name":      n.Name,
			"serverIp":  n.ServerIp,
			"online":    online,
			"version":   n.Version,
		}

		if online {
			sysInfo := pkg.WS.GetNodeSystemInfo(n.ID)
			if sysInfo != nil {
				item["cpuUsage"] = sysInfo.CPUUsage
				item["memUsage"] = sysInfo.MemoryUsage
				item["uptime"] = sysInfo.Uptime
				item["xrayRunning"] = sysInfo.XrayRunning
				item["xrayVersion"] = sysInfo.XrayVersion
			}
		}

		result = append(result, item)
	}
	return dto.Ok(result)
}

// GetForwardLatencyHistory returns latency time-series for a forward.
func GetForwardLatencyHistory(forwardId int64, hours int) dto.R {
	if hours <= 0 {
		hours = 24
	}
	cutoff := time.Now().Unix() - int64(hours*3600)

	var records []model.MonitorLatency
	DB.Where("forward_id = ? AND record_time >= ?", forwardId, cutoff).
		Order("record_time ASC").
		Find(&records)

	return dto.Ok(records)
}

// GetForwardFlowHistory returns incremental flow time-series for a forward.
func GetForwardFlowHistory(forwardId int64, hours int) dto.R {
	if hours <= 0 {
		hours = 24
	}
	// Fetch one extra record before the range for delta computation
	cutoff := time.Now().Unix() - int64((hours+1)*3600)

	var records []model.StatisticsForwardFlow
	DB.Where("forward_id = ? AND record_time >= ?", forwardId, cutoff).
		Order("record_time ASC").
		Find(&records)

	actualCutoff := time.Now().Unix() - int64(hours*3600)

	type FlowPoint struct {
		RecordTime int64 `json:"recordTime"`
		InFlow     int64 `json:"inFlow"`
		OutFlow    int64 `json:"outFlow"`
	}

	result := make([]FlowPoint, 0, len(records))
	for i := 1; i < len(records); i++ {
		if records[i].RecordTime < actualCutoff {
			continue
		}
		deltaIn := records[i].InFlow - records[i-1].InFlow
		deltaOut := records[i].OutFlow - records[i-1].OutFlow
		if deltaIn < 0 {
			deltaIn = 0
		}
		if deltaOut < 0 {
			deltaOut = 0
		}
		result = append(result, FlowPoint{
			RecordTime: records[i].RecordTime,
			InFlow:     deltaIn,
			OutFlow:    deltaOut,
		})
	}

	return dto.Ok(result)
}

// GetTrafficOverview returns global traffic overview with incremental flow per bucket.
func GetTrafficOverview(granularity string, hours int) dto.R {
	if hours <= 0 {
		hours = 24
	}
	// Fetch one extra bucket before the requested range to compute deltas
	cutoff := time.Now().Unix() - int64((hours+1)*3600)

	var records []model.StatisticsForwardFlow
	DB.Where("record_time >= ?", cutoff).
		Order("record_time ASC").
		Find(&records)

	type Bucket struct {
		Time    int64 `json:"time"`
		InFlow  int64 `json:"inFlow"`
		OutFlow int64 `json:"outFlow"`
	}

	bucketSize := int64(3600)
	if granularity == "day" {
		bucketSize = 86400
	}

	// Group records by (forwardId, bucket) → snapshot totals
	type fwBucketKey struct {
		ForwardId int64
		Bucket    int64
	}
	fwBucketSnapshot := make(map[fwBucketKey][2]int64) // [inFlow, outFlow]
	for _, r := range records {
		key := fwBucketKey{r.ForwardId, (r.RecordTime / bucketSize) * bucketSize}
		// Use the last snapshot in each bucket (records are ASC ordered)
		fwBucketSnapshot[key] = [2]int64{r.InFlow, r.OutFlow}
	}

	// Collect all unique (forwardId, bucket) and compute deltas
	bucketMap := make(map[int64]*Bucket)
	// Get sorted unique forward IDs
	fwIds := make(map[int64]bool)
	allBuckets := make(map[int64]bool)
	for k := range fwBucketSnapshot {
		fwIds[k.ForwardId] = true
		allBuckets[k.Bucket] = true
	}

	// Sorted bucket times
	sortedBuckets := make([]int64, 0, len(allBuckets))
	for b := range allBuckets {
		sortedBuckets = append(sortedBuckets, b)
	}
	sort.Slice(sortedBuckets, func(i, j int) bool { return sortedBuckets[i] < sortedBuckets[j] })

	actualCutoff := time.Now().Unix() - int64(hours*3600)
	for fwId := range fwIds {
		var prevIn, prevOut int64
		firstSeen := false
		for _, bt := range sortedBuckets {
			key := fwBucketKey{fwId, bt}
			snap, ok := fwBucketSnapshot[key]
			if !ok {
				continue
			}
			if !firstSeen {
				prevIn = snap[0]
				prevOut = snap[1]
				firstSeen = true
				continue
			}
			// Only include buckets within the requested range
			if bt < actualCutoff {
				prevIn = snap[0]
				prevOut = snap[1]
				continue
			}
			deltaIn := snap[0] - prevIn
			deltaOut := snap[1] - prevOut
			if deltaIn < 0 {
				deltaIn = 0
			}
			if deltaOut < 0 {
				deltaOut = 0
			}
			b, exists := bucketMap[bt]
			if !exists {
				b = &Bucket{Time: bt}
				bucketMap[bt] = b
			}
			b.InFlow += deltaIn
			b.OutFlow += deltaOut
			prevIn = snap[0]
			prevOut = snap[1]
		}
	}

	result := make([]Bucket, 0, len(bucketMap))
	for _, b := range bucketMap {
		result = append(result, *b)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Time < result[j].Time })

	return dto.Ok(result)
}
