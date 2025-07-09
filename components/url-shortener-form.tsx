"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Copy, ExternalLink, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ShortenedUrl {
  shortUrl: string
  originalUrl: string
  shortCode: string
  createdAt: string
}

export function UrlShortenerForm() {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [shortenedUrl, setShortenedUrl] = useState<ShortenedUrl | null>(null)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    setIsLoading(true)
    try {
      const response = await fetch("/api/shorten", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: url.trim() }),
      })

      if (!response.ok) {
        throw new Error("Failed to shorten URL")
      }

      const data = await response.json()
      setShortenedUrl(data)

      // Store in localStorage for recent URLs
      const recentUrls = JSON.parse(localStorage.getItem("recentUrls") || "[]")
      recentUrls.unshift(data)
      localStorage.setItem("recentUrls", JSON.stringify(recentUrls.slice(0, 10)))

      toast({
        title: "URL shortened successfully!",
        description: "Your short link is ready to use.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to shorten URL. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: "Copied!",
        description: "Short URL copied to clipboard.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard.",
        variant: "destructive",
      })
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-center">Shorten Your URL</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            type="url"
            placeholder="Enter your long URL here..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1"
            required
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Shortening...
              </>
            ) : (
              "Shorten"
            )}
          </Button>
        </form>

        {shortenedUrl && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Short URL:</label>
                <div className="flex items-center gap-2 mt-1">
                  <Input value={shortenedUrl.shortUrl} readOnly className="flex-1 bg-white" />
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(shortenedUrl.shortUrl)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => window.open(shortenedUrl.shortUrl, "_blank")}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Original URL:</label>
                <p className="text-sm text-gray-600 mt-1 break-all">{shortenedUrl.originalUrl}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
