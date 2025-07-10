"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, AlertCircle, RefreshCw } from "lucide-react"
import { db } from "@/lib/firebase"
import { collection, getDocs, doc, runTransaction, query } from "firebase/firestore"

export default function FixAnalytics() {
  const [fixing, setFixing] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [summary, setSummary] = useState<{
    total: number
    fixed: number
    errors: number
  } | null>(null)

  const fixAnalytics = async () => {
    setFixing(true)
    setResults([])
    setSummary(null)

    try {
      console.log("🔧 Starting comprehensive analytics fix...")

      // Get all analytics documents
      const analyticsQuery = query(collection(db, "analytics"))
      const analyticsSnapshot = await getDocs(analyticsQuery)

      // Get all URL documents for reference
      const urlsQuery = query(collection(db, "urls"))
      const urlsSnapshot = await getDocs(urlsQuery)

      const urlsData = new Map()
      urlsSnapshot.forEach((doc) => {
        urlsData.set(doc.id, doc.data())
      })

      const fixResults: any[] = []
      let totalFixed = 0
      let totalErrors = 0

      // Process each analytics document
      for (const analyticsDoc of analyticsSnapshot.docs) {
        const shortCode = analyticsDoc.id
        const analyticsData = analyticsDoc.data()
        const urlData = urlsData.get(shortCode)

        const result = {
          shortCode,
          before: {
            totalClicks: analyticsData.totalClicks,
            clickEventsCount: analyticsData.clickEvents?.length || 0,
            urlClicks: urlData?.clicks || 0,
          },
          after: {},
          action: "none",
          error: null,
        }

        try {
          // Determine the correct click count
          const clickEventsCount = analyticsData.clickEvents?.length || 0
          const urlClicks = urlData?.clicks || 0
          const currentTotalClicks = analyticsData.totalClicks || 0

          // Use the higher of the two counts (URL clicks or event count)
          const correctClickCount = Math.max(clickEventsCount, urlClicks)

          if (currentTotalClicks !== correctClickCount && correctClickCount > 0) {
            console.log(`🔧 Fixing ${shortCode}: ${currentTotalClicks} → ${correctClickCount}`)

            await runTransaction(db, async (transaction) => {
              const analyticsRef = doc(db, "analytics", shortCode)
              const urlRef = doc(db, "urls", shortCode)

              // Update analytics with correct count
              transaction.update(analyticsRef, {
                totalClicks: correctClickCount,
                urlClicks: urlClicks,
              })

              // Sync URL clicks if needed
              if (urlClicks !== correctClickCount) {
                transaction.update(urlRef, {
                  clicks: correctClickCount,
                })
              }
            })

            result.after = {
              totalClicks: correctClickCount,
              clickEventsCount,
              urlClicks: correctClickCount,
            }
            result.action = "fixed"
            totalFixed++
          } else if (correctClickCount === 0) {
            result.action = "no_clicks"
          } else {
            result.action = "already_correct"
          }

          result.after = {
            totalClicks: correctClickCount,
            clickEventsCount,
            urlClicks: correctClickCount,
          }
        } catch (error) {
          console.error(`❌ Error fixing ${shortCode}:`, error)
          result.error = error.message
          result.action = "error"
          totalErrors++
        }

        fixResults.push(result)
      }

      setResults(fixResults)
      setSummary({
        total: analyticsSnapshot.docs.length,
        fixed: totalFixed,
        errors: totalErrors,
      })

      console.log(`✅ Analytics fix complete: ${totalFixed} fixed, ${totalErrors} errors`)
    } catch (error) {
      console.error("❌ Error during analytics fix:", error)
    } finally {
      setFixing(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-6 w-6" />
            Fix Analytics Click Counts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-gray-600">
              This tool will scan all analytics documents and fix any missing or incorrect click counts by:
            </p>
            <ul className="text-sm text-gray-600 space-y-1 ml-4">
              <li>• Counting actual click events in each analytics document</li>
              <li>• Comparing with URL document click counts</li>
              <li>• Using the higher count as the correct value</li>
              <li>• Synchronizing both documents</li>
            </ul>

            <Button onClick={fixAnalytics} disabled={fixing} className="w-full">
              {fixing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Fixing Analytics...
                </>
              ) : (
                "Fix All Analytics"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {summary && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Fix Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{summary.total}</div>
                <div className="text-sm text-gray-600">Total Documents</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{summary.fixed}</div>
                <div className="text-sm text-gray-600">Fixed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{summary.errors}</div>
                <div className="text-sm text-gray-600">Errors</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Fix Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {results.map((result, index) => (
                <div
                  key={result.shortCode}
                  className={`p-3 rounded-lg border ${
                    result.action === "fixed"
                      ? "bg-green-50 border-green-200"
                      : result.action === "error"
                        ? "bg-red-50 border-red-200"
                        : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <code className="font-mono text-sm">/{result.shortCode}</code>
                    <div className="flex items-center gap-1">
                      {result.action === "fixed" && <CheckCircle className="h-4 w-4 text-green-600" />}
                      {result.action === "error" && <AlertCircle className="h-4 w-4 text-red-600" />}
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          result.action === "fixed"
                            ? "bg-green-100 text-green-800"
                            : result.action === "error"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {result.action.replace("_", " ")}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Before:</span>
                      <span>
                        Analytics: {result.before.totalClicks}, Events: {result.before.clickEventsCount}, URL:{" "}
                        {result.before.urlClicks}
                      </span>
                    </div>
                    {result.after.totalClicks !== undefined && (
                      <div className="flex justify-between">
                        <span>After:</span>
                        <span>
                          Analytics: {result.after.totalClicks}, Events: {result.after.clickEventsCount}, URL:{" "}
                          {result.after.urlClicks}
                        </span>
                      </div>
                    )}
                    {result.error && <div className="text-red-600">Error: {result.error}</div>}
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
