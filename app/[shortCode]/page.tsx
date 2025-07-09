"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, AlertCircle } from "lucide-react"
import Link from "next/link"

export default function RedirectPage({
  params,
}: {
  params: { shortCode: string }
}) {
  const { shortCode } = params
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAndRedirect() {
      try {
        console.log(`Fetching URL data for ${shortCode}`)
        const response = await fetch(`/api/redirect/${shortCode}`)

        if (!response.ok) {
          if (response.status === 404) {
            setError("Link not found")
            return
          }
          throw new Error(`Error ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        console.log("Redirect data:", data)

        if (data.redirectUrl) {
          console.log(`Redirecting to ${data.redirectUrl}`)
          window.location.href = data.redirectUrl
        } else {
          setError("Invalid redirect data")
        }
      } catch (err) {
        console.error("Redirect error:", err)
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchAndRedirect()
  }, [shortCode])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="flex flex-col items-center justify-center p-6">
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
            <p className="text-lg font-medium">Redirecting...</p>
            <p className="text-sm text-gray-500 mt-2">Please wait while we redirect you to your destination.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-2xl">Link Not Found</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">The short link you're looking for doesn't exist or has expired.</p>
            <div className="space-y-2">
              <p className="text-sm text-gray-500">This could happen if:</p>
              <ul className="text-sm text-gray-500 text-left space-y-1">
                <li>• The link has expired (links expire after 30 days)</li>
                <li>• The short code was mistyped</li>
                <li>• The link was deleted</li>
              </ul>
            </div>
            <Link href="/">
              <Button className="w-full">Go to Homepage</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}
