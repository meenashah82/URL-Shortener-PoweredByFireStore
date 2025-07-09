"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, ExternalLink, BarChart3 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ShortenedUrl {
  shortUrl: string
  originalUrl: string
  shortCode: string
  createdAt: string
}

export function RecentUrls() {
  const [recentUrls, setRecentUrls] = useState<ShortenedUrl[]>([])
  const { toast } = useToast()

  useEffect(() => {
    const stored = localStorage.getItem("recentUrls")
    if (stored) {
      setRecentUrls(JSON.parse(stored))
    }
  }, [])

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

  if (recentUrls.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent URLs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentUrls.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <a
                    href={item.shortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {item.shortUrl}
                  </a>
                </div>
                <p className="text-sm text-gray-600 truncate">{item.originalUrl}</p>
                <p className="text-xs text-gray-500">Created {new Date(item.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-1 ml-4">
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(item.shortUrl)}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => window.open(item.shortUrl, "_blank")}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => window.open(`/analytics/${item.shortCode}`, "_blank")}>
                  <BarChart3 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
