"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, CheckCircle, Database } from "lucide-react"

export default function MigrateClean() {
  const [migrating, setMigrating] = useState(false)
  const [completed, setCompleted] = useState(false)

  const runMigration = async () => {
    setMigrating(true)

    try {
      // Import the migration function dynamically
      const { migrateToCleanArchitecture } = await import("@/lib/analytics-clean")
      await migrateToCleanArchitecture()
      setCompleted(true)
    } catch (error) {
      console.error("Migration failed:", error)
      alert("Migration failed: " + error.message)
    } finally {
      setMigrating(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-6 w-6" />
            Clean Architecture Migration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-yellow-800">Database Cleanup Required</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Your database currently stores click counts in both URL and Analytics collections. This migration
                  will:
                </p>
                <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                  <li>• Remove redundant `clicks` field from URL documents</li>
                  <li>• Keep Analytics as the single source of truth for clicks</li>
                  <li>• Improve performance and data consistency</li>
                  <li>• Simplify real-time updates</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium">Current Architecture (Redundant):</h3>
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <pre className="text-xs text-red-800">
                {`urls/abc123 = {
  originalUrl: "https://example.com",
  clicks: 5,  // ❌ Redundant!
}

analytics/abc123 = {
  totalClicks: 5,  // ❌ Duplicate data!
  clickEvents: [...]
}`}
              </pre>
            </div>

            <h3 className="font-medium">After Migration (Clean):</h3>
            <div className="bg-green-50 border border-green-200 rounded p-3">
              <pre className="text-xs text-green-800">
                {`urls/abc123 = {
  originalUrl: "https://example.com",
  // ✅ No clicks field - cleaner!
}

analytics/abc123 = {
  totalClicks: 5,  // ✅ Single source of truth!
  clickEvents: [...]
}`}
              </pre>
            </div>
          </div>

          {!completed ? (
            <Button onClick={runMigration} disabled={migrating} className="w-full" size="lg">
              {migrating ? "Migrating..." : "Run Clean Architecture Migration"}
            </Button>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <h3 className="font-medium text-green-800">Migration Complete!</h3>
                  <p className="text-sm text-green-700 mt-1">
                    Your database now uses a clean architecture with Analytics as the single source of truth for clicks.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="text-xs text-gray-500 space-y-1">
            <p>
              <strong>Benefits of Clean Architecture:</strong>
            </p>
            <ul className="ml-4 space-y-1">
              <li>• No data duplication or sync issues</li>
              <li>• Faster queries (no need to update multiple documents)</li>
              <li>• Simpler real-time updates</li>
              <li>• Better data consistency</li>
              <li>• Follows database normalization principles</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
