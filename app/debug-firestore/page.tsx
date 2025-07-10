"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { db } from "@/lib/firebase"
import { collection, getDocs, doc, getDoc, query, orderBy, limit, where } from "firebase/firestore"

export default function DebugFirestore() {
  const [urlsData, setUrlsData] = useState<any[]>([])
  const [analyticsData, setAnalyticsData] = useState<any[]>([])
  const [specificDoc, setSpecificDoc] = useState<any>(null)
  const [shortCode, setShortCode] = useState("")
  const [loading, setLoading] = useState(false)

  // Load all URLs
  const loadAllUrls = async () => {
    setLoading(true)
    try {
      const urlsRef = collection(db, "urls")
      const urlsQuery = query(urlsRef, orderBy("createdAt", "desc"), limit(20))
      const snapshot = await getDocs(urlsQuery)

      const urls = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || "Unknown",
      }))

      setUrlsData(urls)
      console.log("📄 URLs loaded:", urls)
    } catch (error) {
      console.error("❌ Error loading URLs:", error)
    } finally {
      setLoading(false)
    }
  }

  // Load all analytics
  const loadAllAnalytics = async () => {
    setLoading(true)
    try {
      const analyticsRef = collection(db, "analytics")
      const analyticsQuery = query(
        analyticsRef,
        where("totalClicks", ">", 0),
        orderBy("totalClicks", "desc"),
        limit(20),
      )
      const snapshot = await getDocs(analyticsQuery)

      const analytics = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || "Unknown",
        clickEventsCount: doc.data().clickEvents?.length || 0,
      }))

      setAnalyticsData(analytics)
      console.log("📊 Analytics loaded:", analytics)
    } catch (error) {
      console.error("❌ Error loading analytics:", error)
    } finally {
      setLoading(false)
    }
  }

  // Load specific document
  const loadSpecificDoc = async () => {
    if (!shortCode) return

    setLoading(true)
    try {
      const urlRef = doc(db, "urls", shortCode)
      const analyticsRef = doc(db, "analytics", shortCode)

      const [urlSnap, analyticsSnap] = await Promise.all([getDoc(urlRef), getDoc(analyticsRef)])

      const result = {
        shortCode,
        urlExists: urlSnap.exists(),
        analyticsExists: analyticsSnap.exists(),
        urlData: urlSnap.exists()
          ? {
              ...urlSnap.data(),
              createdAt: urlSnap.data()?.createdAt?.toDate?.()?.toISOString(),
            }
          : null,
        analyticsData: analyticsSnap.exists()
          ? {
              ...analyticsSnap.data(),
              createdAt: analyticsSnap.data()?.createdAt?.toDate?.()?.toISOString(),
              clickEventsCount: analyticsSnap.data()?.clickEvents?.length || 0,
            }
          : null,
      }

      setSpecificDoc(result)
      console.log("🔍 Specific document loaded:", result)
    } catch (error) {
      console.error("❌ Error loading specific document:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllUrls()
    loadAllAnalytics()
  }, [])

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">🔍 Firestore Database Inspector</h1>
        <p className="text-gray-600">Inspect your Firestore collections and documents directly</p>
      </div>

      {/* Specific Document Lookup */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>🎯 Inspect Specific Short Code</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Enter short code (e.g., abc123)"
              value={shortCode}
              onChange={(e) => setShortCode(e.target.value)}
            />
            <Button onClick={loadSpecificDoc} disabled={loading || !shortCode}>
              Inspect
            </Button>
          </div>

          {specificDoc && (
            <div className="bg-gray-100 p-4 rounded-lg">
              <pre className="text-sm overflow-auto">{JSON.stringify(specificDoc, null, 2)}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* URLs Collection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              📄 URLs Collection
              <Button size="sm" onClick={loadAllUrls} disabled={loading}>
                Refresh
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {urlsData.length === 0 ? (
              <p className="text-gray-500">No URLs found</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {urlsData.map((url, index) => (
                  <div key={url.id} className="p-3 bg-gray-50 rounded border">
                    <div className="font-mono text-sm text-blue-600 mb-1">/{url.shortCode}</div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div>
                        <strong>URL:</strong> {url.originalUrl}
                      </div>
                      <div>
                        <strong>Clicks:</strong> {url.clicks}
                      </div>
                      <div>
                        <strong>Active:</strong> {url.isActive ? "✅" : "❌"}
                      </div>
                      <div>
                        <strong>Created:</strong> {url.createdAt}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Analytics Collection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              📊 Analytics Collection
              <Button size="sm" onClick={loadAllAnalytics} disabled={loading}>
                Refresh
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsData.length === 0 ? (
              <p className="text-gray-500">No analytics found</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {analyticsData.map((analytics, index) => (
                  <div key={analytics.id} className="p-3 bg-gray-50 rounded border">
                    <div className="font-mono text-sm text-green-600 mb-1">/{analytics.shortCode}</div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div>
                        <strong>Total Clicks:</strong> {analytics.totalClicks}
                      </div>
                      <div>
                        <strong>Click Events:</strong> {analytics.clickEventsCount}
                      </div>
                      <div>
                        <strong>Created:</strong> {analytics.createdAt}
                      </div>
                      <div>
                        <strong>Last Click:</strong> {analytics.lastClickAt?.toDate?.()?.toISOString() || "Never"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Raw Data Export */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>📋 Raw Data Export</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button
              onClick={() => {
                const data = { urls: urlsData, analytics: analyticsData }
                navigator.clipboard.writeText(JSON.stringify(data, null, 2))
                alert("Data copied to clipboard!")
              }}
              variant="outline"
            >
              Copy All Data
            </Button>
            <Button
              onClick={() => {
                const data = { urls: urlsData, analytics: analyticsData }
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = "firestore-data.json"
                a.click()
              }}
              variant="outline"
            >
              Download JSON
            </Button>
          </div>

          <div className="text-xs text-gray-500">
            <p>
              <strong>Collections:</strong>
            </p>
            <ul className="ml-4 space-y-1">
              <li>
                • <code>urls/</code> - {urlsData.length} documents
              </li>
              <li>
                • <code>analytics/</code> - {analyticsData.length} documents
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
