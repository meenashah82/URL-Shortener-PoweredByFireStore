"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, TrendingUp, Clock, Zap, Wifi } from "lucide-react"
import { realTimeAnalytics } from "@/lib/real-time-analytics"

export function RealTimeDashboard() {
  const [recentClicks, setRecentClicks] = useState<any[]>([])
  const [topUrls, setTopUrls] = useState<any[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [liveClickCount, setLiveClickCount] = useState(0)
  const [lastClickTime, setLastClickTime] = useState<Date | null>(null)

  useEffect(() => {
    console.log("📊 Setting up real-time dashboard")

    // Subscribe to dashboard data
    const unsubscribe = realTimeAnalytics.subscribeToDashboard((data) => {
      console.log("📈 Dashboard data update:", {
        recentClicksCount: data.recentClicks.length,
        topUrlsCount: data.topUrls.length,
      })

      if (data.recentClicks.length > 0) {
        setRecentClicks(data.recentClicks)
        setLiveClickCount(data.recentClicks.length)
        setLastClickTime(new Date())
      }

      if (data.topUrls.length > 0) {
        setTopUrls(data.topUrls)
      }

      setIsConnected(true)
    })

    // Monitor connection status
    const statusUnsubscribe = realTimeAnalytics.onConnectionStatusChange((status) => {
      setIsConnected(status === "connected")
    })

    return () => {
      unsubscribe()
      statusUnsubscribe()
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Real-time Status */}
      <Card className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-green-600" />
            Real-Time WebSocket Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
              <span className={`font-medium ${isConnected ? "text-green-600" : "text-gray-500"}`}>
                {isConnected ? "🔥 Firestore WebSocket connected - Live updates active!" : "Connecting..."}
              </span>
              {isConnected && <Activity className="h-4 w-4 text-green-600" />}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">{liveClickCount}</div>
              <div className="text-sm text-gray-500">Live Events</div>
            </div>
          </div>
          {lastClickTime && (
            <div className="mt-2 text-xs text-gray-500">Last update: {lastClickTime.toLocaleTimeString()}</div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Real-time Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Live Activity Feed
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentClicks.length === 0 ? (
              <div className="text-center py-8">
                <Zap className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Waiting for real-time click activity...</p>
                <p className="text-xs text-gray-400 mt-1">WebSocket ready for instant updates!</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {recentClicks.slice(0, 10).map((click, index) => (
                  <div
                    key={click.id || index}
                    className={`p-3 rounded-lg transition-all duration-500 cursor-pointer hover:bg-gray-100 ${
                      index === 0 ? "bg-green-100 border-2 border-green-300 animate-pulse" : "bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <code className="text-sm font-mono text-blue-600">/{click.shortCode}</code>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {click.timestamp?.toDate?.()?.toLocaleTimeString() || "Just now"}
                        </span>
                        {index === 0 && <span className="text-green-600 text-xs font-bold animate-bounce">LIVE!</span>}
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
                    {click.clickSource && (
                      <div className="text-xs text-blue-600 mt-1">
                        Source: {click.clickSource}
                        {click.clickSource === "direct" && " 🎯"}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Performing URLs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top Performing URLs (Live)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topUrls.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No URLs created yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topUrls.map((url, index) => (
                  <div
                    key={url.shortCode}
                    className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <code className="text-sm font-mono text-blue-600">/{url.shortCode}</code>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{url.clicks} clicks</span>
                        {index === 0 && <span className="text-yellow-600 text-xs">👑 TOP</span>}
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 truncate">{url.originalUrl}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
