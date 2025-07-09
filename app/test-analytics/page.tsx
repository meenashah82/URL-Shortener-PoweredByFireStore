"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function TestAnalytics() {
  const [shortCode, setShortCode] = useState("")
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testRedirect = async () => {
    if (!shortCode) return

    setLoading(true)
    try {
      console.log(`Testing redirect for: ${shortCode}`)

      // First, test the redirect API
      const response = await fetch(`/api/redirect/${shortCode}`)
      const data = await response.json()

      setResult({
        status: response.status,
        data,
        timestamp: new Date().toISOString(),
      })

      console.log("Redirect test result:", data)
    } catch (error) {
      setResult({
        error: error.message,
        timestamp: new Date().toISOString(),
      })
    } finally {
      setLoading(false)
    }
  }

  const simulateClick = async () => {
    if (!shortCode) return

    setLoading(true)
    try {
      // Simulate multiple clicks
      const promises = []
      for (let i = 0; i < 3; i++) {
        promises.push(
          fetch(`/api/redirect/${shortCode}`, {
            headers: {
              "User-Agent": `Test-Agent-${i}`,
              Referer: `https://test-site-${i}.com`,
            },
          }),
        )
      }

      const responses = await Promise.all(promises)
      const results = await Promise.all(responses.map((r) => r.json()))

      setResult({
        message: "Simulated 3 clicks",
        results,
        timestamp: new Date().toISOString(),
      })
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
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Analytics Testing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Short Code:</label>
            <Input
              value={shortCode}
              onChange={(e) => setShortCode(e.target.value)}
              placeholder="Enter short code (e.g., abc123)"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={testRedirect} disabled={loading || !shortCode}>
              Test Redirect
            </Button>
            <Button onClick={simulateClick} disabled={loading || !shortCode} variant="outline">
              Simulate Clicks
            </Button>
          </div>

          {loading && (
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-sm text-gray-600">Testing...</p>
            </div>
          )}

          {result && (
            <div className="p-4 bg-gray-100 rounded-lg">
              <pre className="text-sm whitespace-pre-wrap overflow-auto">{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}

          <div className="text-sm text-gray-600 space-y-1">
            <p>
              <strong>Instructions:</strong>
            </p>
            <p>1. Enter a short code from a URL you created</p>
            <p>2. Click "Test Redirect" to test the redirect API</p>
            <p>3. Click "Simulate Clicks" to generate test analytics</p>
            <p>4. Check the analytics page to see if data appears</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
