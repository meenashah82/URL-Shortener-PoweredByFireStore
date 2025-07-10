import { doc, onSnapshot, collection, query, where, orderBy, limit } from "firebase/firestore"
import { db } from "./firebase"

export interface RealTimeAnalyticsData {
  shortCode: string
  totalClicks: number
  createdAt: any
  lastClickAt?: any
  clickEvents: Array<{
    id: string
    timestamp: any
    userAgent?: string
    referer?: string
    ip?: string
    clickSource: "direct" | "analytics_page" | "test"
    sessionId?: string
  }>
}

export interface RealTimeUrlData {
  originalUrl: string
  shortCode: string
  createdAt: any
  clicks: number
  isActive: boolean
  expiresAt: any
  lastClickAt?: any
}

export class RealTimeAnalyticsManager {
  private listeners: Map<string, () => void> = new Map()
  private connectionStatus: "connecting" | "connected" | "disconnected" = "connecting"
  private statusCallbacks: Set<(status: string) => void> = new Set()

  constructor() {
    console.log("🚀 RealTimeAnalyticsManager initialized")
  }

  // Subscribe to real-time analytics updates for a specific short code
  subscribeToAnalytics(shortCode: string, callback: (data: RealTimeAnalyticsData | null) => void): () => void {
    console.log(`📡 Setting up real-time analytics subscription for: ${shortCode}`)

    const analyticsRef = doc(db, "analytics", shortCode)
    const urlRef = doc(db, "urls", shortCode)

    let analyticsData: RealTimeAnalyticsData | null = null
    let urlData: RealTimeUrlData | null = null

    // Subscribe to analytics document
    const unsubscribeAnalytics = onSnapshot(
      analyticsRef,
      {
        includeMetadataChanges: true, // Critical for real-time updates
      },
      (doc) => {
        if (doc.exists()) {
          analyticsData = doc.data() as RealTimeAnalyticsData

          console.log("📊 Real-time analytics update:", {
            shortCode,
            totalClicks: analyticsData.totalClicks,
            clickEventsCount: analyticsData.clickEvents?.length || 0,
            fromCache: doc.metadata.fromCache,
            hasPendingWrites: doc.metadata.hasPendingWrites,
            source: doc.metadata.fromCache ? "cache" : "server",
            timestamp: new Date().toISOString(),
          })

          this.updateConnectionStatus("connected")
          callback(analyticsData)
        } else {
          console.log(`❌ No analytics document found for: ${shortCode}`)
          callback(null)
        }
      },
      (error) => {
        console.error("❌ Analytics subscription error:", error)
        this.updateConnectionStatus("disconnected")
        callback(null)
      },
    )

    // Subscribe to URL document for click count sync
    const unsubscribeUrl = onSnapshot(
      urlRef,
      {
        includeMetadataChanges: true,
      },
      (doc) => {
        if (doc.exists()) {
          urlData = doc.data() as RealTimeUrlData

          console.log("🔗 Real-time URL update:", {
            shortCode,
            clicks: urlData.clicks,
            fromCache: doc.metadata.fromCache,
            hasPendingWrites: doc.metadata.hasPendingWrites,
          })

          // If URL clicks changed, trigger analytics callback with updated data
          if (analyticsData && urlData.clicks !== analyticsData.totalClicks) {
            console.log(`🔄 Click count sync: Analytics=${analyticsData.totalClicks}, URL=${urlData.clicks}`)

            // Update analytics data with URL click count for consistency
            const syncedData = {
              ...analyticsData,
              totalClicks: urlData.clicks,
            }
            callback(syncedData)
          }
        }
      },
      (error) => {
        console.error("❌ URL subscription error:", error)
      },
    )

    // Combined cleanup function
    const cleanup = () => {
      console.log(`🧹 Cleaning up real-time subscriptions for: ${shortCode}`)
      unsubscribeAnalytics()
      unsubscribeUrl()
      this.listeners.delete(shortCode)
    }

    this.listeners.set(shortCode, cleanup)
    return cleanup
  }

  // Subscribe to real-time dashboard data (all URLs)
  subscribeToDashboard(
    callback: (data: {
      recentClicks: Array<any>
      topUrls: Array<{ shortCode: string; clicks: number; originalUrl: string }>
    }) => void,
  ): () => void {
    console.log("📊 Setting up real-time dashboard subscription")

    // Subscribe to recent analytics updates
    const analyticsQuery = query(
      collection(db, "analytics"),
      where("totalClicks", ">", 0),
      orderBy("lastClickAt", "desc"),
      limit(50),
    )

    const unsubscribeAnalytics = onSnapshot(
      analyticsQuery,
      {
        includeMetadataChanges: true,
      },
      (snapshot) => {
        const recentClicks: Array<any> = []

        snapshot.forEach((doc) => {
          const data = doc.data() as RealTimeAnalyticsData
          if (data.clickEvents && data.clickEvents.length > 0) {
            const recentUrlClicks = data.clickEvents.slice(-5).map((click) => ({
              ...click,
              shortCode: data.shortCode,
            }))
            recentClicks.push(...recentUrlClicks)
          }
        })

        // Sort by timestamp
        recentClicks.sort((a, b) => {
          const aTime = a.timestamp?.seconds || 0
          const bTime = b.timestamp?.seconds || 0
          return bTime - aTime
        })

        console.log("📈 Dashboard analytics update:", {
          recentClicksCount: recentClicks.length,
          timestamp: new Date().toISOString(),
        })

        callback({ recentClicks: recentClicks.slice(0, 20), topUrls: [] })
      },
      (error) => {
        console.error("❌ Dashboard analytics subscription error:", error)
      },
    )

    // Subscribe to top URLs
    const urlsQuery = query(
      collection(db, "urls"),
      where("isActive", "==", true),
      where("clicks", ">", 0),
      orderBy("clicks", "desc"),
      limit(10),
    )

    const unsubscribeUrls = onSnapshot(
      urlsQuery,
      {
        includeMetadataChanges: true,
      },
      (snapshot) => {
        const topUrls = snapshot.docs.map((doc) => {
          const data = doc.data() as RealTimeUrlData
          return {
            shortCode: data.shortCode,
            clicks: data.clicks,
            originalUrl: data.originalUrl,
          }
        })

        console.log("🏆 Top URLs update:", {
          topUrlsCount: topUrls.length,
          timestamp: new Date().toISOString(),
        })

        // Get current recent clicks and combine with top URLs
        // This is a simplified approach - in production you might want to optimize this
        callback({ recentClicks: [], topUrls })
      },
      (error) => {
        console.error("❌ Top URLs subscription error:", error)
      },
    )

    const cleanup = () => {
      console.log("🧹 Cleaning up dashboard subscriptions")
      unsubscribeAnalytics()
      unsubscribeUrls()
    }

    return cleanup
  }

  // Monitor connection status
  onConnectionStatusChange(callback: (status: string) => void): () => void {
    this.statusCallbacks.add(callback)

    // Immediately call with current status
    callback(this.connectionStatus)

    return () => {
      this.statusCallbacks.delete(callback)
    }
  }

  private updateConnectionStatus(status: "connecting" | "connected" | "disconnected") {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status
      console.log(`🔄 Connection status changed to: ${status}`)

      this.statusCallbacks.forEach((callback) => {
        callback(status)
      })
    }
  }

  // Clean up all listeners
  destroy() {
    console.log("🧹 Destroying RealTimeAnalyticsManager")
    this.listeners.forEach((cleanup) => cleanup())
    this.listeners.clear()
    this.statusCallbacks.clear()
  }
}

// Global instance
export const realTimeAnalytics = new RealTimeAnalyticsManager()
