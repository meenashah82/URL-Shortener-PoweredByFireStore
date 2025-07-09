"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { RealTimeClickTracker } from "@/lib/real-time-tracker"
import { getUrlData, type UrlData } from "@/lib/analytics"

export function useNoRefreshAnalytics(shortCode: string) {
  const [urlData, setUrlData] = useState<UrlData | null>(null)
  const [analyticsData, setAnalyticsData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRealTime, setIsRealTime] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [clickCount, setClickCount] = useState(0)
  const [isNewClick, setIsNewClick] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting")

  const trackerRef = useRef<RealTimeClickTracker | null>(null)
  const previousClickCount = useRef(0)
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize tracker
  useEffect(() => {
    console.log(`🚀 Initializing no-refresh analytics for: ${shortCode}`)
    trackerRef.current = new RealTimeClickTracker(shortCode)

    return () => {
      console.log(`🧹 Cleaning up no-refresh analytics for: ${shortCode}`)
      if (trackerRef.current) {
        trackerRef.current.destroy()
      }
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current)
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [shortCode])

  // Refresh URL data
  const refreshData = useCallback(async () => {
    try {
      const urlResult = await getUrlData(shortCode)
      if (urlResult) {
        setUrlData(urlResult)
        console.log("🔄 URL data refreshed automatically")
      }
    } catch (err) {
      console.error("❌ Error refreshing URL data:", err)
    }
  }, [shortCode])

  // Handle real-time updates
  const handleRealTimeUpdate = useCallback(
    (data: any) => {
      console.log("📡 No-refresh update received:", {
        totalClicks: data.totalClicks,
        timestamp: new Date().toISOString(),
      })

      setAnalyticsData(data)
      setIsRealTime(true)
      setLastUpdate(new Date())
      setConnectionStatus("connected")

      // Handle click count changes
      const newClickCount = data.totalClicks || 0
      if (newClickCount !== previousClickCount.current) {
        console.log(`🎉 Auto-update: Click count changed! ${previousClickCount.current} → ${newClickCount}`)

        setIsNewClick(true)
        setClickCount(newClickCount)
        previousClickCount.current = newClickCount

        // Auto-refresh URL data
        refreshData()

        // Clear previous animation timeout
        if (animationTimeoutRef.current) {
          clearTimeout(animationTimeoutRef.current)
        }

        // Remove animation after 3 seconds
        animationTimeoutRef.current = setTimeout(() => {
          setIsNewClick(false)
        }, 3000)
      }
    },
    [refreshData],
  )

  // Set up real-time subscription
  useEffect(() => {
    async function initializeData() {
      try {
        console.log(`📊 Loading initial data for: ${shortCode}`)
        const urlResult = await getUrlData(shortCode)
        if (!urlResult) {
          setError("Short code not found")
          return
        }
        setUrlData(urlResult)
        setClickCount(urlResult.clicks || 0)
        previousClickCount.current = urlResult.clicks || 0
        console.log("✅ Initial data loaded successfully")
      } catch (err) {
        console.error("❌ Error loading initial data:", err)
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    initializeData()

    // Set up real-time listener with auto-reconnect
    if (trackerRef.current) {
      console.log("🔗 Setting up real-time subscription...")

      const setupSubscription = () => {
        const unsubscribe = trackerRef.current!.subscribeToRealTimeUpdates((data) => {
          handleRealTimeUpdate(data)

          // Clear any pending reconnect attempts
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
          }
        })

        // Monitor connection and auto-reconnect if needed
        const connectionMonitor = setInterval(() => {
          if (!isRealTime) {
            console.log("⚠️ Connection seems inactive, attempting reconnect...")
            setConnectionStatus("connecting")

            // Attempt reconnection
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log("🔄 Reconnecting real-time subscription...")
              unsubscribe()
              setupSubscription()
            }, 2000)
          }
        }, 15000) // Check every 15 seconds

        return () => {
          unsubscribe()
          clearInterval(connectionMonitor)
        }
      }

      const cleanup = setupSubscription()
      return cleanup
    }
  }, [shortCode, handleRealTimeUpdate, isRealTime])

  // Track analytics page interactions
  const trackAnalyticsClick = useCallback(async (element: string, coordinates?: { x: number; y: number }) => {
    if (trackerRef.current) {
      await trackerRef.current.trackClick("analytics_page", {
        element,
        coordinates,
        timestamp: new Date().toISOString(),
      })
      console.log(`🖱️ Tracked analytics click: ${element}`)
    }
  }, [])

  return {
    urlData,
    analyticsData,
    loading,
    error,
    isRealTime,
    lastUpdate,
    clickCount,
    isNewClick,
    connectionStatus,
    refreshData,
    trackAnalyticsClick,
  }
}
