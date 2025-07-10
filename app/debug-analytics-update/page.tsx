"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { db } from "@/lib/firebase"
import { doc, getDoc, runTransaction, increment, serverTimestamp, arrayUnion } from "firebase/firestore"
import { RefreshCw, Target, AlertCircle } from "lucide-react"

export default function DebugAnalyticsUpdate() {
  const [shortCode, setShortCode] = useState("")
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const checkAnalyticsDoc = async () => {
    if (!shortCode) return

    setLoading(true)
    try {
      const analyticsRef = doc(db, "analytics", shortCode)
      const analyticsSnap = await getDoc(analyticsRef)

      if (analyticsSnap.exists()) {
        const data = analyticsSnap.data()
        setResult({
          exists: true,
          data,
          timestamp: new Date().toISOString(),
        })
      } else {
        setResult({
          exists: false,
          message: "Analytics document does not exist",
          timestamp: new Date().toISOString(),
        })
      }
    } catch (error) {
      setResult({
        error: error.message,
        timestamp: new Date().toISOString(),
      })
    } finally {
      setLoading(false)
    }
  }

  const manuallyIncrementClicks = async () => {
    if (!shortCode) return

    setLoading(true)
    try {
      const analyticsRef = doc(db, "analytics", shortCode)

      await runTransaction(db, async (transaction) => {
        const analyticsDoc = await transaction.get(analyticsRef)

        const clickEvent = {
          id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: serverTimestamp(),
          userAgent: "Manual Test",
          referer: "Debug Page",
          ip: "127.0.0.1",
          sessionId: `manual-${Date.now()}`,
          clickSource: "test" as const,
        }

        if (analyticsDoc.exists()) {
          console.log("📈 Manually incrementing existing analytics")
          transaction.update(analyticsRef, {
            totalClicks: increment(1),
            lastClickAt: serverTimestamp(),
            clickEvents: arrayUnion(clickEvent),
          })
        } else {
          console.log("📝 Creating new analytics document")
          transaction.set(analyticsRef, {
            shortCode,
            totalClicks: 1,
            createdAt: serverTimestamp(),
            lastClickAt: serverTimestamp(),
            clickEvents: [clickEvent],
          })
        }
      })

      setResult({
        success: true,
        message: "Manually incremented totalClicks",
        timestamp: new Date().toISOString(),
      })

      // Refresh the data
      setTimeout(checkAnalyticsDoc, 1000)
    } catch (error) {
      setResult({
        error: error.message,
        timestamp: new Date().toISOString(),
      })
    } finally {
      setLoading(false)
    }
  }

  const testRedirectAPI = async () => {
    if (!shortCode) return

    setLoading(true)
    try {
      console.log(`🔗 Testing redirect API for: ${shortCode}`)

      const response = await fetch(`/api/redirect/${shortCode}`)
      const data = await response.json()

      setResult({
        apiTest: true,
        status: response.status,
        response: data,
        timestamp: new Date().toISOString(),
      })

      // Check analytics after API call
      setTimeout(checkAnalyticsDoc, 2000)
    } catch (error) {
      setResult({
        error: error.message,
        timestamp: new Date().toISOString(),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">🔧 Debug Analytics Updates</h1>
        <p className="text-gray-600">Debug why totalClicks field is not updating in Firestore</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Analytics Debug Tools</CardTitle>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Button onClick={checkAnalyticsDoc} disabled={loading || !shortCode}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Check Analytics Doc
            </Button>

            <Button onClick={manuallyIncrementClicks} disabled={loading || !shortCode} variant="outline">
              <Target className="h-4 w-4 mr-2" />
              Manual Increment
            </Button>

            <Button onClick={testRedirectAPI} disabled={loading || !shortCode} variant="outline">
              <AlertCircle className="h-4 w-4 mr-2" />
              Test Redirect API
            </Button>
          </div>

          <div className="text-xs text-gray-500 space-y-1">
            <p>
              <strong>Debug Steps:</strong>
            </p>
            <p>1. Check if analytics document exists</p>
            <p>2. Try manual increment to test Firestore connection</p>
            <p>3. Test the redirect API to see if it updates analytics</p>
            <p>4. Check Firestore Console to verify changes</p>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Debug Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {result.exists === true && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-medium text-green-800 mb-2">✅ Analytics Document Found</h3>
                  <div className="text-sm text-green-700 space-y-1">
                    <p>
                      <strong>Total Clicks:</strong> {result.data.totalClicks}
                    </p>
                    <p>
                      <strong>Click Events:</strong> {result.data.clickEvents?.length || 0}
                    </p>
                    <p>
                      <strong>Last Click:</strong> {result.data.lastClickAt?.toDate?.()?.toLocaleString() || "Never"}
                    </p>
                  </div>
                </div>
              )}

              {result.exists === false && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-medium text-yellow-800 mb-2">⚠️ Analytics Document Not Found</h3>
                  <p className="text-sm text-yellow-700">
                    The analytics document doesn't exist yet. Try creating a short URL first or use manual increment.
                  </p>
                </div>
              )}

              {result.success && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-blue-800 mb-2">🎯 Manual Test Successful</h3>
                  <p className="text-sm text-blue-700">{result.message}</p>
                </div>
              )}

              {result.apiTest && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="font-medium text-purple-800 mb-2">🔗 API Test Result</h3>
                  <div className="text-sm text-purple-700 space-y-1">
                    <p>
                      <strong>Status:</strong> {result.status}
                    </p>
                    <p>
                      <strong>Success:</strong> {result.response.success ? "Yes" : "No"}
                    </p>
                    {result.response.redirectUrl && (
                      <p>
                        <strong>Redirect URL:</strong> {result.response.redirectUrl}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {result.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="font-medium text-red-800 mb-2">❌ Error</h3>
                  <p className="text-sm text-red-700">{result.error}</p>
                </div>
              )}

              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-gray-700">View Raw Data</summary>
                <pre className="text-xs bg-gray-100 p-3 rounded mt-2 overflow-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>🔍 Troubleshooting Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-2">
            <div className="space-y-1">
              <p className="font-medium">Common Issues:</p>
              <ul className="ml-4 space-y-1 text-gray-600">
                <li>• Analytics document doesn't exist (create it first)</li>
                <li>• Firestore rules blocking writes</li>
                <li>• Transaction conflicts</li>
                <li>• Network connectivity issues</li>
                <li>• Browser console errors</li>
              </ul>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded">
              <p className="font-medium text-blue-800">Next Steps:</p>
              <ol className="text-blue-700 text-sm mt-1 space-y-1">
                <li>1. Use "Manual Increment" to test if Firestore writes work</li>
                <li>2. Check browser console for any errors</li>
                <li>3. Verify Firestore Console shows the changes</li>
                <li>4. Test the redirect API to see if it triggers updates</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
