"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ExternalLink, Calendar, MousePointer, Globe, Loader2, RefreshCw, Zap, Target } from "lucide-react"
import Link from "next/link"
import { getUrlData, type UrlData } from "@/lib/analytics"
import { RealTimeClickTracker } from "@/lib/real-time-tracker"
import { AutoRefreshAnalytics } from "@/components/auto-refresh-analytics"

export default function AnalyticsPage({
  params,
}: {
  params: { shortCode: string }
}) {
  const { shortCode } = params
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

  // Initialize real-time tracker
  useEffect(() => {
    trackerRef.current = new RealTimeClickTracker(shortCode)

    return () => {
      if (trackerRef.current) {
        trackerRef.current.destroy()
      }
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current)
      }
    }
  }, [shortCode])

  // Track clicks on analytics page elements
  const trackAnalyticsClick = async (element: string, coordinates?: { x: number; y: number }) => {
    if (trackerRef.current) {
      await trackerRef.current.trackClick("analytics_page", {
        element,
        coordinates,
        timestamp: new Date().toISOString(),
      })
    }
  }

  // Handle click tracking on interactive elements
  const handleElementClick = (element: string) => (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const coordinates = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
    trackAnalyticsClick(element, coordinates)
  }

  const refreshData = async () => {
    try {
      const urlResult = await getUrlData(shortCode)
      if (urlResult) {
        setUrlData(urlResult)
      }
    } catch (err) {
      console.error("Error refreshing data:", err)
    }
  }

  useEffect(() => {
    async function fetchInitialData() {
      try {
        const urlResult = await getUrlData(shortCode)
        if (!urlResult) {
          setError("Short code not found")
          return
        }
        setUrlData(urlResult)
        setClickCount(urlResult.clicks || 0)
        previousClickCount.current = urlResult.clicks || 0
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchInitialData()

    // Set up enhanced real-time listener with automatic updates
    if (trackerRef.current) {
      console.log("🔄 Setting up real-time analytics listener...")

      const unsubscribe = trackerRef.current.subscribeToRealTimeUpdates((data) => {
        console.log("📡 Real-time analytics update received:", {
          totalClicks: data.totalClicks,
          clickEventsCount: data.clickEvents?.length || 0,
          timestamp: new Date().toISOString(),
        })

        // Update analytics data immediately
        setAnalyticsData(data)
        setIsRealTime(true)
        setLastUpdate(new Date())
        setConnectionStatus("connected")

        // Handle click count updates with enhanced animation
        const newClickCount = data.totalClicks || 0
        if (newClickCount !== previousClickCount.current) {
          console.log(`🎉 Click count changed! ${previousClickCount.current} → ${newClickCount}`)

          setIsNewClick(true)
          setClickCount(newClickCount)
          previousClickCount.current = newClickCount

          // Auto-refresh URL data to sync with analytics
          refreshData()

          // Clear previous timeout
          if (animationTimeoutRef.current) {
            clearTimeout(animationTimeoutRef.current)
          }

          // Remove animation after 3 seconds
          animationTimeoutRef.current = setTimeout(() => {
            setIsNewClick(false)
          }, 3000)
        }
      })

      // Set up connection monitoring
      const connectionMonitor = setInterval(() => {
        if (!isRealTime) {
          setConnectionStatus("connecting")
        }
      }, 5000)

      return () => {
        console.log("🔌 Cleaning up real-time listeners...")
        unsubscribe()
        clearInterval(connectionMonitor)
        if (animationTimeoutRef.current) {
          clearTimeout(animationTimeoutRef.current)
        }
      }
    }
  }, [shortCode, isRealTime])

  // Auto-refresh URL data when analytics update
  useEffect(() => {
    if (analyticsData && analyticsData.totalClicks > (urlData?.clicks || 0)) {
      refreshData()
    }
  }, [analyticsData])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading real-time analytics...</span>
        </div>
      </div>
    )
  }

  if (error || !urlData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Error Loading Analytics</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">{error || "Failed to load analytics data"}</p>
            <Link href="/">
              <Button>Go to Homepage</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Process analytics for display
  const recentClicks = analyticsData?.clickEvents?.slice(-15).reverse() || []
  const realTimeClicks = recentClicks.filter((click) => click.clickSource === "analytics_page")

  const clicksByDay =
    analyticsData?.clickEvents?.reduce(
      (acc, click) => {
        if (click.timestamp && click.timestamp.toDate) {
          const date = click.timestamp.toDate().toDateString()
          acc[date] = (acc[date] || 0) + 1
        }
        return acc
      },
      {} as Record<string, number>,
    ) || {}

  const topReferrers =
    analyticsData?.clickEvents
      ?.filter((click) => click.referer && click.referer !== "")
      .reduce(
        (acc, click) => {
          try {
            const domain = new URL(click.referer!).hostname
            acc[domain] = (acc[domain] || 0) + 1
          } catch {
            // Invalid URL, skip
          }
          return acc
        },
        {} as Record<string, number>,
      ) || {}

  const shortUrl = `${window.location.origin}/${shortCode}`

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <AutoRefreshAnalytics
            shortCode={shortCode}
            onDataUpdate={(data) => {
              console.log("🔄 Auto-refresh triggered data update")
              setAnalyticsData(data)
              setIsRealTime(true)
              setLastUpdate(new Date())

              // Update click count if changed
              const newClickCount = data.totalClicks || 0
              if (newClickCount !== previousClickCount.current) {
                setIsNewClick(true)
                setClickCount(newClickCount)
                previousClickCount.current = newClickCount

                // Auto-refresh URL data
                refreshData()

                // Clear animation after delay
                if (animationTimeoutRef.current) {
                  clearTimeout(animationTimeoutRef.current)
                }
                animationTimeoutRef.current = setTimeout(() => {
                  setIsNewClick(false)
                }, 3000)
              }
            }}
          >
            {/* All existing content goes here - Header, Cards, etc. */}
            {/* Header with Real-time Status */}
            <div className="flex items-center gap-4 mb-8">
              <Link href="/">
                <Button variant="outline" size="sm" onClick={handleElementClick("back-button")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Auto-Updating Analytics Dashboard</h1>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  handleElementClick("refresh-button")(e)
                  refreshData()
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Manual Refresh
              </Button>
            </div>

            {/* Rest of the existing content remains the same */}
            {/* Real-time Click Counter with Enhanced Animation */}
            <Card
              className={`mb-8 transition-all duration-500 ${
                isNewClick ? "border-4 border-green-400 shadow-lg shadow-green-200" : "border-2 border-blue-200"
              }`}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap
                    className={`h-6 w-6 transition-all duration-300 ${
                      isNewClick ? "text-yellow-500 animate-bounce scale-125" : "text-blue-600"
                    }`}
                  />
                  Auto-Updating Click Counter
                  {isNewClick && (
                    <div className="flex items-center gap-1 text-green-600 animate-pulse">
                      <Target className="h-4 w-4" />
                      <span className="text-sm font-bold">AUTO-UPDATED!</span>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div
                    className={`text-8xl font-bold transition-all duration-700 ${
                      isNewClick ? "text-green-600 scale-110 drop-shadow-lg" : "text-blue-600"
                    }`}
                    onClick={handleElementClick("click-counter")}
                  >
                    {clickCount}
                  </div>
                  <p className="text-gray-600 mt-2 text-lg">Total Clicks (Auto-Updated)</p>
                  {isNewClick && (
                    <div className="mt-4 p-3 bg-green-100 rounded-lg border border-green-300">
                      <div className="text-green-700 font-bold text-lg animate-bounce">
                        🎉 Updated automatically - No refresh needed!
                      </div>
                      <div className="text-green-600 text-sm mt-1">Real-time Firestore sync active</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Continue with all other existing cards and content... */}
            {/* The rest of your existing JSX remains exactly the same */}
            {/* URL Info */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  URL Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Short URL:</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 p-2 bg-gray-100 rounded text-sm">{shortUrl}</code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        handleElementClick("open-short-url")(e)
                        window.open(shortUrl, "_blank")
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Original URL:</label>
                  <p className="text-sm text-gray-600 mt-1 break-all">{urlData.originalUrl}</p>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Created {urlData.createdAt?.toDate?.()?.toLocaleDateString() || "Unknown"}
                  </div>
                  <div className="flex items-center gap-1">
                    <MousePointer className="h-4 w-4" />
                    {analyticsData?.totalClicks || urlData.clicks || 0} total clicks
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Real-time Clicks Feed */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Recent Clicks (Real-time)
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recentClicks.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500 text-sm mb-2">No clicks yet</p>
                      <p className="text-xs text-gray-400">Share your short URL to see real-time analytics</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {recentClicks.map((click, index) => (
                        <div
                          key={click.id || index}
                          className={`p-3 rounded-lg transition-all duration-500 ${
                            index === 0 && isNewClick
                              ? "bg-gradient-to-r from-green-100 to-blue-100 border-2 border-green-300 animate-pulse shadow-md"
                              : click.clickSource === "analytics_page"
                                ? "bg-blue-50 border border-blue-200"
                                : "bg-gray-50"
                          }`}
                          onClick={handleElementClick(`click-item-${index}`)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">
                              {click.timestamp?.toDate?.()?.toLocaleString() || "Just now"}
                            </div>
                            <div className="flex items-center gap-2">
                              {index === 0 && isNewClick && (
                                <span className="text-green-600 text-xs font-bold animate-bounce">NEW!</span>
                              )}
                              {click.clickSource === "analytics_page" && (
                                <span className="text-blue-600 text-xs bg-blue-100 px-2 py-1 rounded">Analytics</span>
                              )}
                            </div>
                          </div>
                          {click.referer && (
                            <div className="text-xs text-gray-600 mt-1">
                              From: {(() => {
                                try {
                                  return new URL(click.referer).hostname
                                } catch {
                                  return click.referer
                                }
                              })()}
                            </div>
                          )}
                          {click.sessionId && (
                            <div className="text-xs text-gray-500 mt-1">
                              Session: {click.sessionId.substring(0, 8)}...
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Analytics Page Interactions */}
              <Card>
                <CardHeader>
                  <CardTitle>Analytics Page Interactions</CardTitle>
                </CardHeader>
                <CardContent>
                  {realTimeClicks.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500 text-sm mb-2">No analytics interactions yet</p>
                      <p className="text-xs text-gray-400">Click elements on this page to see tracking</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {realTimeClicks.slice(0, 10).map((click, index) => (
                        <div key={click.id || index} className="p-2 bg-blue-50 rounded border border-blue-200">
                          <div className="text-sm font-medium">
                            {click.timestamp?.toDate?.()?.toLocaleString() || "Just now"}
                          </div>
                          <div className="text-xs text-blue-600 mt-1">Element: {click.element || "Unknown"}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Test Real-time Tracking */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Test Real-time Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={(e) => {
                      handleElementClick("test-button-1")(e)
                      if (trackerRef.current) {
                        trackerRef.current.trackClick("test", { testType: "button-1" })
                      }
                    }}
                    variant="outline"
                  >
                    Test Click 1
                  </Button>
                  <Button
                    onClick={(e) => {
                      handleElementClick("test-button-2")(e)
                      if (trackerRef.current) {
                        trackerRef.current.trackClick("test", { testType: "button-2" })
                      }
                    }}
                    variant="outline"
                  >
                    Test Click 2
                  </Button>
                  <Button
                    onClick={(e) => {
                      handleElementClick("simulate-multiple")(e)
                      // Simulate multiple clicks
                      if (trackerRef.current) {
                        for (let i = 0; i < 3; i++) {
                          setTimeout(() => {
                            trackerRef.current?.trackClick("test", { testType: "multiple", index: i })
                          }, i * 500)
                        }
                      }
                    }}
                    variant="outline"
                  >
                    Simulate Multiple Clicks
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Click these buttons to test real-time tracking. Watch the analytics update instantly!
                </p>
              </CardContent>
            </Card>

            {/* Clicks by Day */}
            {Object.keys(clicksByDay).length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Clicks by Day</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(clicksByDay)
                      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                      .slice(0, 7)
                      .map(([date, count]) => (
                        <div
                          key={date}
                          className="flex justify-between items-center p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                          onClick={handleElementClick(`day-${date}`)}
                        >
                          <span className="text-sm font-medium">{date}</span>
                          <span className="text-sm text-gray-600">{count} clicks</span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </AutoRefreshAnalytics>
        </div>
      </div>
    </div>
  )
}
