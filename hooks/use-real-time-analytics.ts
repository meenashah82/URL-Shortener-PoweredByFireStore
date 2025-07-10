"use client"

import { useState, useEffect, useRef } from "react"
import { realTimeAnalytics, type RealTimeAnalyticsData } from "@/lib/real-time-analytics"
import { getUrlData, type UrlData } from "@/lib/analytics"

export function useRealTimeAnalytics(shortCode: string) {
  const [urlData, setUrlData] = useState<UrlData | null>(null)
  const [analyticsData, setAnalyticsData] = useState<RealTimeAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting")
  const [clickCount, setClickCount] = useState(0)
  const [isNewClick, setIsNewClick] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const previousClickCount = useRef(0)
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const statusUnsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    console.log(`🚀 Initializing real-time analytics hook for: ${shortCode}`)

    // Load initial data
    async function loadInitialData() {
      try {
        const urlResult = await getUrlData(shortCode)
        if (!urlResult) {
          setError("Short code not found")
          return
        }

        setUrlData(urlResult)
        setClickCount(urlResult.clicks || 0)
        previousClickCount.current = urlResult.clicks || 0

        console.log("✅ Initial data loaded:", {
          shortCode,
          clicks: urlResult.clicks,
        })
      } catch (err) {
        console.error("❌ Error loading initial data:", err)
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    loadInitialData()

    // Set up real-time subscription
    const unsubscribe = realTimeAnalytics.subscribeToAnalytics(shortCode, (data) => {
      if (data) {
        console.log("📡 Real-time analytics data received:", {
          shortCode,
          totalClicks: data.totalClicks,
          clickEventsCount: data.clickEvents?.length || 0,
        })

        setAnalyticsData(data)
        setLastUpdate(new Date())

        // Handle click count changes with animation
        const newClickCount = data.totalClicks || 0
        if (newClickCount !== previousClickCount.current) {
          console.log(`🎉 Real-time click update! ${previousClickCount.current} → ${newClickCount}`)

          setIsNewClick(true)
          setClickCount(newClickCount)
          previousClickCount.current = newClickCount

          // Update URL data to keep in sync
          getUrlData(shortCode).then((updatedUrlData) => {
            if (updatedUrlData) {
              setUrlData(updatedUrlData)
            }
          })

          // Clear previous animation timeout
          if (animationTimeoutRef.current) {
            clearTimeout(animationTimeoutRef.current)
          }

          // Remove animation after 3 seconds
          animationTimeoutRef.current = setTimeout(() => {
            setIsNewClick(false)
          }, 3000)
        }
      } else {
        console.log("❌ No analytics data received")
      }
    })

    unsubscribeRef.current = unsubscribe

    // Monitor connection status
    const statusUnsubscribe = realTimeAnalytics.onConnectionStatusChange((status) => {
      setConnectionStatus(status)
    })

    statusUnsubscribeRef.current = statusUnsubscribe

    return () => {
      console.log(`🧹 Cleaning up real-time analytics hook for: ${shortCode}`)

      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }

      if (statusUnsubscribeRef.current) {
        statusUnsubscribeRef.current()
      }

      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current)
      }
    }
  }, [shortCode])

  return {
    urlData,
    analyticsData,
    loading,
    error,
    connectionStatus,
    clickCount,
    isNewClick,
    lastUpdate,
  }
}
