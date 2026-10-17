/**
 * Smoke: npx tsx server/services/analytics-events.service.test.ts
 */
import assert from "node:assert/strict"
import {
  __resetAnalyticsForTests,
  analyticsStats,
  ingestAnalyticsEvents,
  listRecentAnalytics,
} from "./analytics-events.service.js"

__resetAnalyticsForTests()

const r1 = ingestAnalyticsEvents([
  { event: "tickets_page_view", sessionId: "s1", stage: "catalog", timestamp: new Date().toISOString() },
  { event: "pix_qr_visible", sessionId: "s1", stage: "pix" },
  { event: "" },
])
assert.equal(r1.accepted, 2)
assert.equal(r1.rejected, 1)

const recent = listRecentAnalytics(10)
assert.equal(recent[0].event, "pix_qr_visible")

const stats = analyticsStats()
assert.equal(stats.total, 2)
assert.equal(stats.byStage.catalog, 1)
assert.equal(stats.byStage.pix, 1)

console.log("analytics-events.service.test.ts OK")
