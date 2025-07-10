"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ExternalLink, AlertCircle, CheckCircle } from "lucide-react"

export default function TestRedirect() {
  const [shortCode, setShortCode] = useState("")
  const [testUrl, setTestUrl] = useState("https://example.com")
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const createAndTestUrl = async () => {
    setLoading(true)
    setResult(null)

    try {
      console.log("🚀 Creating test URL...")

      // Step 1: Create a short URL
      const createResponse = await fetch("/api/shorten", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: testUrl }),
      })

      if (!createResponse.ok) {
        throw new Error(`Create failed: ${createResponse.status}`)
      }

      const createData = await createResponse.json()
      console.log("✅ Short URL created:", createData)

      // Step 2: Test the redirect API
      console.log("🔗 Testing redirect API...")
      const redirectResponse = await fetch(`/api/redirect/${createData.shortCode}`)

      if (!redirectResponse.ok) {
        throw new Error(`Redirect failed: ${redirectResponse.status}`)
      }

      const redirectData = await redirectResponse.json()
      console.log("✅ Redirect API response:", redirectData)

      setResult({
        success: true,
        created: createData,
        redirect: redirectData,
        timestamp: new Date().toISOString(),
      })

      // Update the short code for manual testing
      setShortCode(createData.shortCode)
    } catch (error) {
      console.error("❌ Test failed:", error)
      setResult({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      })
    } finally {
      setLoading(false)
    }
  }

  const testSpecificCode = async () => {
    if (!shortCode) return

    setLoading(true)
    setResult(null)

    try {
      console.log(`🔗 Testing specific code: ${shortCode}`)

      const response = await fetch(`/api/redirect/${shortCode}`)
      const data = await response.json()

      setResult({
        success: response.ok,
        redirect: data,
        status: response.status,
        timestamp: new Date().toISOString(),
      })

      console.log("📊 Test result:", { status: response.status, data })
    } catch (error) {
      console.error("❌ Test failed:", error)
      setResult({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      })
    } finally {
      setLoading(false)
    }
  }

  const testActualRedirect = () => {
    if (!shortCode) return
    const shortUrl = `${window.location.origin}/${shortCode}`
    window.open(shortUrl, "_blank")
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">🔗 Test Short Link Redirects</h1>
        <p className="text-gray-600">Debug and test your short link functionality</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Create and Test */}
        <Card>
          <CardHeader>
            <CardTitle>Create & Test New URL</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">URL to Shorten:</label>
              <Input value={testUrl} onChange={(e) => setTestUrl(e.target.value)} placeholder="https://example.com" />
            </div>
            <Button onClick={createAndTestUrl} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating & Testing...
                </>
              ) : (
                "Create & Test URL"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Test Specific Code */}
        <Card>
          <CardHeader>
            <CardTitle>Test Specific Short Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Short Code:</label>
              <Input value={shortCode} onChange={(e) => setShortCode(e.target.value)} placeholder="abc123" />
            </div>
            <div className="flex gap-2">
              <Button onClick={testSpecificCode} disabled={loading || !shortCode} className="flex-1">
                Test API
              </Button>
              <Button
                onClick={testActualRedirect}
                disabled={!shortCode}
                variant="outline"
                className="flex-1 bg-transparent"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Link
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              Test Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {result.success ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-medium text-green-800 mb-2">✅ Test Successful!</h3>
                  {result.created && (
                    <div className="text-sm text-green-700 space-y-1">
                      <p>
                        <strong>Short URL:</strong> {result.created.shortUrl}
                      </p>
                      <p>
                        <strong>Original:</strong> {result.created.originalUrl}
                      </p>
                      <p>
                        <strong>Code:</strong> {result.created.shortCode}
                      </p>
                    </div>
                  )}
                  {result.redirect && (
                    <div className="text-sm text-green-700 mt-3">
                      <p>
                        <strong>Redirect URL:</strong> {result.redirect.redirectUrl}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="font-medium text-red-800 mb-2">❌ Test Failed</h3>
                  <p className="text-sm text-red-700">{result.error}</p>
                  {result.status && <p className="text-sm text-red-700 mt-1">Status: {result.status}</p>}
                </div>
              )}

              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-gray-700">View Raw Response</summary>
                <pre className="text-xs bg-gray-100 p-3 rounded mt-2 overflow-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Debug Info */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>🔧 Debug Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-2">
            <p>
              <strong>Current URL:</strong> {typeof window !== "undefined" ? window.location.origin : "Loading..."}
            </p>
            <p>
              <strong>Expected Format:</strong>{" "}
              {typeof window !== "undefined" ? `${window.location.origin}/abc123` : "Loading..."}
            </p>
            <div className="mt-4 p-3 bg-blue-50 rounded">
              <p className="font-medium text-blue-800">Troubleshooting Steps:</p>
              <ul className="text-blue-700 text-sm mt-1 space-y-1">
                <li>1. Create a test URL using the form above</li>
                <li>2. Check that the API returns a redirect URL</li>
                <li>3. Test the actual redirect by clicking "Open Link"</li>
                <li>4. Check browser console for any errors</li>
                <li>5. Verify Firestore has the URL document</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
