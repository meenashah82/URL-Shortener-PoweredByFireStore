import { type NextRequest, NextResponse } from "next/server"
import { getUrlData, recordClick } from "@/lib/analytics-clean"

interface UrlData {
  originalUrl: string
  shortCode: string
  createdAt: any
  clicks: number
  isActive: boolean
  expiresAt: any
}

export async function GET(request: NextRequest, { params }: { params: { shortCode: string } }) {
  const { shortCode } = params

  try {
    console.log(`🔗 Processing redirect for: ${shortCode}`)

    // Get URL data (no clicks stored here)
    const urlData = await getUrlData(shortCode)

    if (!urlData) {
      console.log(`❌ Short code not found: ${shortCode}`)
      return NextResponse.json({ error: "Short code not found" }, { status: 404 })
    }

    // Check if URL has expired or is inactive
    if (!urlData.isActive || (urlData.expiresAt && urlData.expiresAt.toDate() < new Date())) {
      console.log(`❌ URL expired or inactive: ${shortCode}`)
      return NextResponse.json({ error: "Short code expired" }, { status: 404 })
    }

    // Validate that we have the required data
    if (!urlData.originalUrl) {
      console.error("❌ No originalUrl found in data:", urlData)
      return NextResponse.json({ error: "Invalid URL data" }, { status: 500 })
    }

    // Ensure the URL has a protocol
    let redirectUrl = urlData.originalUrl
    if (!redirectUrl.startsWith("http://") && !redirectUrl.startsWith("https://")) {
      redirectUrl = "https://" + redirectUrl
    }

    console.log(`✅ Redirect URL: ${redirectUrl}`)

    // Get headers for analytics
    const userAgent = request.headers.get("user-agent") || ""
    const referer = request.headers.get("referer") || ""
    const forwardedFor = request.headers.get("x-forwarded-for") || ""
    const ip = forwardedFor.split(",")[0]?.trim() || ""

    // Record click in analytics ONLY (single source of truth)
    console.log(`📊 Recording click in analytics: ${shortCode}`)
    await recordClick(shortCode, userAgent, referer, ip)

    console.log(`🚀 Redirect complete: ${shortCode}`)

    return NextResponse.json({ redirectUrl })
  } catch (error) {
    console.error("❌ Redirect error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
