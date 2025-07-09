"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, TrendingUp, Clock } from "lucide-react"
import { subscribeToRecentClicks, subscribeToTopUrls, type ClickEvent } from "@/lib/analytics"

export function RealTimeDashboard() {
  const [recentClicks, setRecentClicks] = useState<Array<ClickEvent & { shortCode: string }>>([])
  const [topUrls, setTopUrls] = useState<Array<{ shortCode: string; clicks: number; originalUrl: string }>>([])
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Subscribe to recent clicks
    const unsubscribeClicks = subscribeToRecentClicks((clicks) => {
      setRecentClicks(clicks)
      setIsConnected(true)
    })

    // Subscribe to top URLs
    const unsubscribeUrls = subscribeToTopUrls((urls) => {
      setTopUrls(urls)
    })

    return () => {
      unsubscribeClicks()
      unsubscribeUrls()
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Status Indicator */}
      <div className="flex items-center gap-2 text-sm">
        <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-gray-400"}`} />
        <span className={isConnected ? "text-green-600" : "text-gray-500"}>
          {isConnected ? "Real-time updates active" : "Connecting..."}
        </span>
        {isConnected && <Activity className="h-4 w-4 text-green-600" />}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentClicks.length === 0 ? (
              <p className="text-gray-500 text-sm">No recent activity</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {recentClicks.map((click, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <code className="text-sm font-mono text-blue-600">/{click.shortCode}</code>
                      <span className="text-xs text-gray-500">{click.timestamp.toDate().toLocaleTimeString()}</span>
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
              Top Performing URLs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topUrls.length === 0 ? (
              <p className="text-gray-500 text-sm">No URLs created yet</p>
            ) : (
              <div className="space-y-3">
                {topUrls.map((url, index) => (
                  <div key={url.shortCode} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <code className="text-sm font-mono text-blue-600">/{url.shortCode}</code>
                      <span className="text-sm font-medium text-gray-900">{url.clicks} clicks</span>
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
