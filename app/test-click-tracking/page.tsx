"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { db } from "@/lib/firebase"
import { doc, onSnapshot } from "firebase/firestore"
import { ExternalLink, RefreshCw, Activity } from "lucide-react"

export default function TestClickTracking() {
  const [shortCode, setShortCode] = useState("")
  const [analyticsData, setAnalyticsData] = useState<any>(null)
  const [isListening, setIsListening] = useState(false)
  const [clickHistory, setClickHistory] = useState<any[]>([])

  // Real-time listener for analytics
  useEffect(() => {
    if (!shortCode || !isListening) return

    console.log(`🔗 Setting up real-time listener for: ${shortCode}`)

    const analyticsRef = doc(db, "analytics", shortCode)

    const unsubscribe = onSnapshot(
      analyticsRef,
      { includeMetadataChanges: true },
      (doc) => {
        if (doc.exists()) {
          const data = doc.data()
          console.log("📊 Analytics update received:", {
            totalClicks: data.totalClicks,
            clicks: data.clicks,
            clickEventsCount: data.clickEvents?.length || 0,
            fromCache: doc.metadata.fromCache,
            hasPendingWrites: doc.metadata.hasPendingWrites,
            timestamp: new Date().toISOString(),
          })

          setAnalyticsData(data)

          // Add to click history if this is a new update
          if (!doc.metadata.fromCache) {
            setClickHistory((prev) =>
              [
                ...prev,
                {
                  timestamp: new Date().toISOString(),
                  totalClicks: data.totalClicks,
                  clickEventsCount: data.clickEvents?.length || 0,
                },
              ].slice(-10),
            ) // Keep last 10 updates
          }
        } else {
          console.log("❌ No analytics document found")
          setAnalyticsData(null)
        }
      },
      (error) => {
        console.error("❌ Listener error:", error)
      },
    )

    return () => {
      console.log("🧹 Cleaning up listener")
      unsubscribe()
    }
  }, [shortCode, isListening])

  const startListening = () => {
    if (!shortCode) return
    setIsListening(true)
    setClickHistory([])
  }

  const stopListening = () => {
    setIsListening(false)
  }

  const testClick = async () => {
    if (!shortCode) return

    console.log(`🖱️ Testing click for: ${shortCode}`)

    try {
      const response = await fetch(`/api/redirect/${shortCode}`)
      const data = await response.json()

      console.log("🔄 Click test result:", {
        status: response.status,
        success: data.success,
        redirectUrl: data.redirectUrl,
      })
    } catch (error) {
      console.error("❌ Click test failed:", error)
    }
  }

  const openShortUrl = () => {
    if (!shortCode) return
    const shortUrl = `${window.location.origin}/${shortCode}`
    window.open(shortUrl, "_blank")
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">🔍 Click Tracking Debug Tool</h1>
        <p className="text-gray-600">Monitor real-time analytics updates when short URLs are clicked</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Setup Real-time Monitoring</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Short Code to Monitor:</label>
            <Input
              value={shortCode}
              onChange={(e) => setShortCode(e.target.value)}
              placeholder="Enter short code (e.g., abc123)"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={startListening} disabled={!shortCode || isListening} className="flex-1">
              {isListening ? (
                <>
                  <Activity className="h-4 w-4 mr-2 animate-pulse" />
                  Monitoring Active
                </>
              ) : (
                "Start Monitoring"
              )}
            </Button>

            <Button onClick={stopListening} disabled={!isListening} variant="outline">
              Stop
            </Button>
          </div>

          {isListening && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-700 font-medium">Real-time monitoring active for: /{shortCode}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Test Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Test Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={testClick} disabled={!shortCode} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Test Click (API Call)
            </Button>

            <Button onClick={openShortUrl} disabled={!shortCode} variant="outline" className="w-full bg-transparent">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Short URL (New Tab)
            </Button>

            <div className="text-xs text-gray-500 space-y-1">
              <p>
                <strong>Instructions:</strong>
              </p>
              <p>1. Enter a short code and start monitoring</p>
              <p>2. Click "Test Click" or "Open Short URL"</p>
              <p>3. Watch the analytics update in real-time</p>
            </div>
          </CardContent>
        </Card>

        {/* Current Analytics */}
        <Card>
          <CardHeader>
            <CardTitle>Current Analytics Data</CardTitle>
          </CardHeader>
          <CardContent>
            {!analyticsData ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No analytics data</p>
                <p className="text-xs text-gray-400 mt-1">Start monitoring to see data</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-blue-50 p-3 rounded">
                    <div className="text-2xl font-bold text-blue-600">{analyticsData.totalClicks || 0}</div>
                    <div className="text-sm text-blue-700">Total Clicks</div>
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm font-medium mb-2">Click Events: {analyticsData.clickEvents?.length || 0}</div>
                  <div className="text-xs text-gray-600">
                    Last Update: {analyticsData.lastClickAt?.toDate?.()?.toLocaleString() || "Never"}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Click History */}
      {clickHistory.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Real-time Update History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {clickHistory.map((update, index) => (
                <div
                  key={index}
                  className={`p-2 rounded border ${index === 0 ? "bg-green-50 border-green-200" : "bg-gray-50"}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-mono">
                      totalClicks: {update.totalClicks}, events: {update.clickEventsCount}
                    </span>
                    <span className="text-xs text-gray-500">{new Date(update.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
