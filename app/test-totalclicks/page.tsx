"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { db } from "@/lib/firebase"
import { doc, onSnapshot } from "firebase/firestore"
import { ExternalLink, RefreshCw, Activity, Target } from "lucide-react"

export default function TestTotalClicks() {
  const [shortCode, setShortCode] = useState("")
  const [analyticsData, setAnalyticsData] = useState<any>(null)
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [clickHistory, setClickHistory] = useState<any[]>([])

  // Real-time listener
  useEffect(() => {
    if (!shortCode || !isMonitoring) return

    console.log(`🔗 Monitoring totalClicks for: ${shortCode}`)

    const analyticsRef = doc(db, "analytics", shortCode)
    const unsubscribe = onSnapshot(
      analyticsRef,
      { includeMetadataChanges: true },
      (doc) => {
        if (doc.exists()) {
          const data = doc.data()
          console.log("📊 totalClicks update:", {
            totalClicks: data.totalClicks,
            timestamp: new Date().toISOString(),
            fromCache: doc.metadata.fromCache,
          })

          setAnalyticsData(data)

          // Track changes
          if (!doc.metadata.fromCache) {
            setClickHistory((prev) => [
              {
                totalClicks: data.totalClicks,
                timestamp: new Date().toISOString(),
              },
              ...prev.slice(0, 9),
            ])
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

    return () => unsubscribe()
  }, [shortCode, isMonitoring])

  const startMonitoring = () => {
    if (!shortCode) return
    setIsMonitoring(true)
    setClickHistory([])
  }

  const stopMonitoring = () => {
    setIsMonitoring(false)
  }

  const testClick = async () => {
    if (!shortCode) return

    try {
      console.log(`🖱️ Testing click for: ${shortCode}`)
      const response = await fetch(`/api/redirect/${shortCode}`)
      const data = await response.json()

      console.log("API Response:", {
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
        <h1 className="text-3xl font-bold mb-4">🎯 Test totalClicks Updates</h1>
        <p className="text-gray-600">Monitor real-time totalClicks field updates in Firestore</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Monitor totalClicks Field</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Short Code:</label>
            <Input
              value={shortCode}
              onChange={(e) => setShortCode(e.target.value)}
              placeholder="Enter short code (e.g., abc123)"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={startMonitoring} disabled={!shortCode || isMonitoring} className="flex-1">
              {isMonitoring ? (
                <>
                  <Activity className="h-4 w-4 mr-2 animate-pulse" />
                  Monitoring Active
                </>
              ) : (
                "Start Monitoring"
              )}
            </Button>
            <Button onClick={stopMonitoring} disabled={!isMonitoring} variant="outline">
              Stop
            </Button>
          </div>

          {isMonitoring && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-700 font-medium">Monitoring totalClicks field for: /{shortCode}</span>
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
              Test API Call
            </Button>

            <Button onClick={openShortUrl} disabled={!shortCode} variant="outline" className="w-full bg-transparent">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Short URL
            </Button>

            <div className="text-xs text-gray-500 space-y-1">
              <p>
                <strong>Instructions:</strong>
              </p>
              <p>1. Enter your short code and start monitoring</p>
              <p>2. Click "Test API Call" or "Open Short URL"</p>
              <p>3. Watch the totalClicks field update in real-time</p>
            </div>
          </CardContent>
        </Card>

        {/* Current Data */}
        <Card>
          <CardHeader>
            <CardTitle>Current totalClicks</CardTitle>
          </CardHeader>
          <CardContent>
            {!analyticsData ? (
              <div className="text-center py-8">
                <Target className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No data yet</p>
                <p className="text-xs text-gray-400">Start monitoring to see updates</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-6xl font-bold text-blue-600 mb-2">{analyticsData.totalClicks || 0}</div>
                <div className="text-sm text-gray-600">Total Clicks</div>
                <div className="text-xs text-gray-500 mt-2">Events: {analyticsData.clickEvents?.length || 0}</div>
                {analyticsData.lastClickAt && (
                  <div className="text-xs text-gray-500 mt-1">
                    Last: {analyticsData.lastClickAt.toDate?.()?.toLocaleTimeString()}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Update History */}
      {clickHistory.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>totalClicks Update History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {clickHistory.map((update, index) => (
                <div
                  key={index}
                  className={`p-2 rounded border ${index === 0 ? "bg-green-50 border-green-200" : "bg-gray-50"}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-sm">totalClicks: {update.totalClicks}</span>
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
