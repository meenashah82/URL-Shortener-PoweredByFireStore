"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

export default function TestPage() {
  const [shortCode, setShortCode] = useState("")
  const [testUrl, setTestUrl] = useState("https://example.com")
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testLookup = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/debug/${shortCode}`)
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const testRedirect = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/redirect/${shortCode}`)
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const createTestUrl = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/shorten", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: testUrl }),
      })
      const data = await response.json()
      setResult(data)
      if (data.shortCode) {
        setShortCode(data.shortCode)
      }
    } catch (error) {
      setResult({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Create Test URL</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder="URL to shorten" value={testUrl} onChange={(e) => setTestUrl(e.target.value)} />
              <Button onClick={createTestUrl} disabled={loading}>
                Create
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Debug Short Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter short code (e.g., abc123)"
                value={shortCode}
                onChange={(e) => setShortCode(e.target.value)}
              />
              <Button onClick={testLookup} disabled={loading}>
                Debug
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Redirect API</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter short code (e.g., abc123)"
                value={shortCode}
                onChange={(e) => setShortCode(e.target.value)}
              />
              <Button onClick={testRedirect} disabled={loading}>
                Test API
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading && (
        <div className="flex items-center justify-center my-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}

      {result && !loading && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm overflow-auto bg-gray-100 p-4 rounded max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
