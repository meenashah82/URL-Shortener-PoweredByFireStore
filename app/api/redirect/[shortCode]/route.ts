import { type NextRequest, NextResponse } from "next/server"
import { doc, getDoc, runTransaction, serverTimestamp, arrayUnion, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface UrlData {
  originalUrl: string
  shortCode: string
  createdAt: any
  clicks?: number // Optional for backward compatibility
  isActive: boolean
  expiresAt: any
}

interface AnalyticsData {
  shortCode: string
  totalClicks: number
  createdAt: any
  lastClickAt?: any
  clickEvents: any[]
}

export async function GET(request: NextRequest, { params }: { params: { shortCode: string } }) {
  const { shortCode } = params

  try {
    console.log(`🔗 Processing redirect for: ${shortCode}`)

    // Get URL data from Firestore
    const urlRef = doc(db, "urls", shortCode)
    const urlSnap = await getDoc(urlRef)

    if (!urlSnap.exists()) {
      console.log(`❌ Short code not found in urls collection: ${shortCode}`)
      return NextResponse.json({ error: "Short code not found" }, { status: 404 })
    }

    const urlData = urlSnap.data() as UrlData
    console.log(`📄 URL data found:`, {
      shortCode,
      originalUrl: urlData.originalUrl,
      isActive: urlData.isActive,
      hasExpiry: !!urlData.expiresAt,
    })

    // Check if URL has expired or is inactive
    if (!urlData.isActive) {
      console.log(`❌ URL is inactive: ${shortCode}`)
      return NextResponse.json({ error: "Short code inactive" }, { status: 404 })
    }

    if (urlData.expiresAt && urlData.expiresAt.toDate() < new Date()) {
      console.log(`❌ URL expired: ${shortCode}`)
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

    console.log(`✅ Redirect URL prepared: ${redirectUrl}`)

    // Get headers for analytics
    const userAgent = request.headers.get("user-agent") || ""
    const referer = request.headers.get("referer") || ""
    const forwardedFor = request.headers.get("x-forwarded-for") || ""
    const ip = forwardedFor.split(",")[0]?.trim() || ""

    // Record the click analytics (don't let this fail the redirect)
    try {
      console.log(`📊 Recording click analytics for: ${shortCode}`)
      await recordClickAnalytics(shortCode, userAgent, referer, ip)
      console.log(`✅ Click analytics recorded successfully`)
    } catch (analyticsError) {
      console.error("⚠️ Analytics recording failed (but continuing redirect):", analyticsError)
    }

    console.log(`🚀 Redirect successful for: ${shortCode}`)

    // Return the redirect URL for client-side redirection
    return NextResponse.json({
      redirectUrl,
      success: true,
      shortCode,
    })
  } catch (error) {
    console.error("❌ Redirect error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 },
    )
  }
}

async function recordClickAnalytics(shortCode: string, userAgent: string, referer: string, ip: string) {
  try {
    const analyticsRef = doc(db, "analytics", shortCode)

    const clickEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: serverTimestamp(),
      userAgent: userAgent.substring(0, 200),
      referer: referer.substring(0, 200),
      ip: ip.substring(0, 15),
      sessionId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      clickSource: "direct" as const,
      realTime: true,
    }

    console.log(`🔄 Recording click for ${shortCode} - Starting improved transaction`)

    // Use a more robust transaction approach
    await runTransaction(db, async (transaction) => {
      const analyticsDoc = await transaction.get(analyticsRef)

      if (analyticsDoc.exists()) {
        const currentData = analyticsDoc.data()
        const currentClicks = currentData.totalClicks || 0
        const newClickCount = currentClicks + 1

        console.log(`📈 Incrementing totalClicks: ${currentClicks} → ${newClickCount}`)

        // Update with explicit new value instead of increment()
        transaction.update(analyticsRef, {
          totalClicks: newClickCount,
          lastClickAt: serverTimestamp(),
          clickEvents: arrayUnion(clickEvent),
        })
      } else {
        console.log(`📝 Creating new analytics document for: ${shortCode}`)

        // Create new analytics document
        transaction.set(analyticsRef, {
          shortCode,
          totalClicks: 1,
          createdAt: serverTimestamp(),
          lastClickAt: serverTimestamp(),
          clickEvents: [clickEvent],
        })
      }
    })

    console.log(`✅ Click analytics recorded successfully for: ${shortCode}`)
  } catch (error) {
    console.error(`❌ Error recording analytics for ${shortCode}:`, error)

    // Fallback: try a simple update without transaction
    try {
      console.log(`🔄 Attempting fallback update for ${shortCode}`)
      const analyticsRef = doc(db, "analytics", shortCode)
      const analyticsSnap = await getDoc(analyticsRef)

      if (analyticsSnap.exists()) {
        const currentData = analyticsSnap.data()
        const newCount = (currentData.totalClicks || 0) + 1

        await updateDoc(analyticsRef, {
          totalClicks: newCount,
          lastClickAt: serverTimestamp(),
        })

        console.log(`✅ Fallback update successful: ${newCount}`)
      }
    } catch (fallbackError) {
      console.error(`❌ Fallback also failed:`, fallbackError)
    }

    throw error
  }
}
