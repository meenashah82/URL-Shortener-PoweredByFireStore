import { doc, updateDoc, increment, arrayUnion, serverTimestamp, onSnapshot } from "firebase/firestore"
import { db } from "./firebase"

export interface RealTimeClickEvent {
  id: string
  timestamp: any
  userAgent: string
  referer: string
  ip: string
  sessionId: string
  clickSource: "direct" | "analytics_page" | "test"
  coordinates?: { x: number; y: number }
  viewport?: { width: number; height: number }
}

export class RealTimeClickTracker {
  private shortCode: string
  private sessionId: string
  private listeners: (() => void)[] = []

  constructor(shortCode: string) {
    this.shortCode = shortCode
    this.sessionId = this.generateSessionId()
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // Track click immediately when it occurs
  async trackClick(clickSource: "direct" | "analytics_page" | "test" = "direct", additionalData?: any): Promise<void> {
    try {
      const clickEvent: RealTimeClickEvent = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: serverTimestamp(),
        userAgent: navigator.userAgent.substring(0, 200),
        referer: document.referrer.substring(0, 200),
        ip: await this.getClientIP(),
        sessionId: this.sessionId,
        clickSource,
        coordinates: additionalData?.coordinates,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      }

      console.log("🔥 Tracking click in real-time:", clickEvent)

      // Immediately update Firestore
      await this.sendToFirestore(clickEvent)

      console.log("✅ Click tracked successfully")
    } catch (error) {
      console.error("❌ Error tracking click:", error)
    }
  }

  private async sendToFirestore(clickEvent: RealTimeClickEvent): Promise<void> {
    const urlRef = doc(db, "urls", this.shortCode)
    const analyticsRef = doc(db, "analytics", this.shortCode)

    // Only increment URL clicks for direct clicks, not analytics page interactions
    if (clickEvent.clickSource === "direct") {
      // Use Promise.all for concurrent updates
      await Promise.all([
        updateDoc(urlRef, {
          clicks: increment(1),
          lastClickAt: serverTimestamp(),
        }),
        updateDoc(analyticsRef, {
          totalClicks: increment(1),
          lastClickAt: serverTimestamp(),
          clickEvents: arrayUnion(clickEvent),
          lastSessionId: this.sessionId,
        }),
      ])
    } else {
      // For analytics page interactions, only log the event without incrementing clicks
      await updateDoc(analyticsRef, {
        clickEvents: arrayUnion(clickEvent),
        lastSessionId: this.sessionId,
      })
    }
  }

  private async getClientIP(): Promise<string> {
    try {
      // In a real app, you might use a service to get the IP
      // For now, we'll use a placeholder
      return "client-ip"
    } catch {
      return "unknown"
    }
  }

  // Enhanced real-time listener for immediate UI updates without refresh
  subscribeToRealTimeUpdates(callback: (data: any) => void): () => void {
    const analyticsRef = doc(db, "analytics", this.shortCode)
    const urlRef = doc(db, "urls", this.shortCode)

    console.log(`🔗 Setting up real-time subscription for: ${this.shortCode}`)

    // Subscribe to analytics with metadata changes for instant updates
    const unsubscribeAnalytics = onSnapshot(
      analyticsRef,
      {
        includeMetadataChanges: true, // Critical for immediate updates
      },
      (doc) => {
        if (doc.exists()) {
          const data = doc.data()
          console.log("📊 Analytics snapshot received:", {
            shortCode: this.shortCode,
            totalClicks: data.totalClicks,
            clickEventsCount: data.clickEvents?.length || 0,
            fromCache: doc.metadata.fromCache,
            hasPendingWrites: doc.metadata.hasPendingWrites,
            source: doc.metadata.fromCache ? "cache" : "server",
            timestamp: new Date().toISOString(),
          })

          // Always call callback for any change, including pending writes
          callback(data)
        }
      },
      (error) => {
        console.error("❌ Analytics listener error:", error)
        // Retry connection after error
        setTimeout(() => {
          console.log("🔄 Retrying analytics connection...")
          this.subscribeToRealTimeUpdates(callback)
        }, 2000)
      },
    )

    // Also subscribe to URL changes for comprehensive updates
    const unsubscribeUrl = onSnapshot(
      urlRef,
      {
        includeMetadataChanges: true,
      },
      (doc) => {
        if (doc.exists()) {
          const urlData = doc.data()
          console.log("🔗 URL snapshot received:", {
            shortCode: this.shortCode,
            clicks: urlData.clicks,
            fromCache: doc.metadata.fromCache,
            hasPendingWrites: doc.metadata.hasPendingWrites,
          })

          // Trigger analytics refresh when URL data changes
          if (!doc.metadata.fromCache || doc.metadata.hasPendingWrites) {
            // Small delay to ensure analytics is updated after URL
            setTimeout(() => {
              const analyticsDoc = doc(db, "analytics", this.shortCode)
              onSnapshot(
                analyticsDoc,
                (analyticsSnap) => {
                  if (analyticsSnap.exists()) {
                    callback(analyticsSnap.data())
                  }
                },
                { includeMetadataChanges: true },
              )
            }, 100)
          }
        }
      },
      (error) => {
        console.error("❌ URL listener error:", error)
      },
    )

    const cleanup = () => {
      console.log(`🧹 Cleaning up listeners for: ${this.shortCode}`)
      unsubscribeAnalytics()
      unsubscribeUrl()
    }

    this.listeners.push(cleanup)
    return cleanup
  }

  // Clean up listeners
  destroy(): void {
    this.listeners.forEach((unsubscribe) => unsubscribe())
    this.listeners = []
  }
}
