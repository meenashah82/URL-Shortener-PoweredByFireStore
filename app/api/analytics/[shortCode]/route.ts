import { type NextRequest, NextResponse } from "next/server"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

interface UrlData {
  originalUrl: string
  shortCode: string
  createdAt: string
  clicks: number
}

interface AnalyticsData {
  clicks: number
  clickHistory: Array<{
    timestamp: string
    userAgent?: string
    referer?: string
    ip?: string
  }>
  createdAt: string
}

export async function GET(request: NextRequest, { params }: { params: { shortCode: string } }) {
  const { shortCode } = params

  try {
    // Get URL data
    const urlDataRaw = await redis.get(shortCode)
    if (!urlDataRaw) {
      return NextResponse.json({ error: "Short code not found" }, { status: 404 })
    }

    let urlData: UrlData
    if (typeof urlDataRaw === "string") {
      urlData = JSON.parse(urlDataRaw)
    } else {
      urlData = urlDataRaw as UrlData
    }

    // Get analytics data
    const analyticsKey = `analytics:${shortCode}`
    const analyticsDataRaw = await redis.get(analyticsKey)

    let analyticsData: AnalyticsData = {
      clicks: 0,
      clickHistory: [],
      createdAt: urlData.createdAt,
    }

    if (analyticsDataRaw) {
      if (typeof analyticsDataRaw === "string") {
        analyticsData = JSON.parse(analyticsDataRaw)
      } else {
        analyticsData = analyticsDataRaw as AnalyticsData
      }
    }

    return NextResponse.json({
      urlData,
      analyticsData,
    })
  } catch (error) {
    console.error("Error loading analytics:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
