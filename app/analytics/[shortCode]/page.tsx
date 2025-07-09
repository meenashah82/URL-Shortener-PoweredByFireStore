"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ExternalLink, Calendar, MousePointer, Globe, Loader2, Activity, RefreshCw } from "lucide-react"
import Link from "next/link"
import { subscribeToAnalytics, getUrlData, type AnalyticsData, type UrlData } from "@/lib/analytics"

export default function AnalyticsPage({
  params,
}: {
  params: { shortCode: string }
}) {
  const { shortCode } = params
  const [urlData, setUrlData] = useState<UrlData | null>(null)
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRealTime, setIsRealTime] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

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
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchInitialData()

    // Set up real-time listener for analytics
    const unsubscribe = subscribeToAnalytics(shortCode, (data) => {
      console.log("Analytics data updated:", data)
      setAnalyticsData(data)
      setIsRealTime(true)
      setLastUpdate(new Date())
    })

    return () => unsubscribe()
  }, [shortCode])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading analytics...</span>
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
  const recentClicks = analyticsData?.clickEvents?.slice(-10).reverse() || []

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
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
            <Button variant="outline" size="sm" onClick={refreshData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            {isRealTime && (
              <div className="flex items-center gap-1 text-green-600 text-sm">
                <Activity className="h-4 w-4" />
                Real-time
                {lastUpdate && (
                  <span className="text-xs text-gray-500 ml-2">Updated: {lastUpdate.toLocaleTimeString()}</span>
                )}
              </div>
            )}
          </div>

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
                  <Button size="sm" variant="outline" onClick={() => window.open(shortUrl, "_blank")}>
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
            {/* Recent Clicks */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Clicks</CardTitle>
              </CardHeader>
              <CardContent>
                {recentClicks.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm mb-2">No clicks yet</p>
                    <p className="text-xs text-gray-400">Share your short URL to see analytics here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentClicks.map((click, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-sm font-medium">
                          {click.timestamp?.toDate?.()?.toLocaleString() || "Unknown time"}
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
                        {click.country && (
                          <div className="text-xs text-gray-500 mt-1">
                            Location: {click.city ? `${click.city}, ` : ""}
                            {click.country}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Referrers */}
            <Card>
              <CardHeader>
                <CardTitle>Top Referrers</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(topReferrers).length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm">No referrer data available</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(topReferrers)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 5)
                      .map(([domain, count]) => (
                        <div key={domain} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <span className="text-sm font-medium">{domain}</span>
                          <span className="text-sm text-gray-600">{count} clicks</span>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

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
                      <div key={date} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="text-sm font-medium">{date}</span>
                        <span className="text-sm text-gray-600">{count} clicks</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Debug Info */}
          {process.env.NODE_ENV === "development" && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Debug Info</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                  {JSON.stringify({ analyticsData, urlData }, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
