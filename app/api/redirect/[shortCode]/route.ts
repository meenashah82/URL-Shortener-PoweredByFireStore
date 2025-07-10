import { type NextRequest, NextResponse } from "next/server"
import { doc, getDoc, runTransaction, serverTimestamp, increment, arrayUnion } from "firebase/firestore"
import { db } from "@/lib/firebase"

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

    // Get URL data from Firestore
    const urlRef = doc(db, "urls", shortCode)
    const urlSnap = await getDoc(urlRef)

    if (!urlSnap.exists()) {
      console.log(`❌ Short code not found: ${shortCode}`)
      return NextResponse.json({ error: "Short code not found" }, { status: 404 })
    }

    const urlData = urlSnap.data() as UrlData

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

    // Record the click with proper analytics tracking
    console.log(`📊 Recording click analytics for: ${shortCode}`)
    await recordClickWithProperAnalytics(shortCode, userAgent, referer, ip)

    console.log(`🚀 Redirect complete for: ${shortCode}`)

    // Return the redirect URL for client-side redirection
    return NextResponse.json({ redirectUrl })
  } catch (error) {
    console.error("❌ Redirect error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function recordClickWithProperAnalytics(shortCode: string, userAgent: string, referer: string, ip: string) {
  try {
    const urlRef = doc(db, "urls", shortCode)
    const analyticsRef = doc(db, "analytics", shortCode)

    console.log(`🔄 Starting analytics transaction for: ${shortCode}`)

    // Use transaction for atomic updates
    await runTransaction(db, async (transaction) => {
      const urlDoc = await transaction.get(urlRef)
      const analyticsDoc = await transaction.get(analyticsRef)

      if (!urlDoc.exists()) {
        throw new Error("URL document does not exist")
      }

      const currentUrlData = urlDoc.data()
      const currentClicks = currentUrlData.clicks || 0
      const newClickCount = currentClicks + 1

      console.log(`📈 Incrementing clicks: ${currentClicks} → ${newClickCount}`)

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

      // Update URL document with incremented clicks
      transaction.update(urlRef, {
        clicks: increment(1),
        lastClickAt: serverTimestamp(),
      })

      // Update or create analytics document with proper click tracking
      if (analyticsDoc.exists()) {
        const currentAnalytics = analyticsDoc.data()
        const currentTotalClicks = currentAnalytics.totalClicks || 0
        const newTotalClicks = currentTotalClicks + 1

        console.log(`📊 Updating analytics: totalClicks ${currentTotalClicks} → ${newTotalClicks}`)

        transaction.update(analyticsRef, {
          totalClicks: increment(1), // This ensures proper increment
          lastClickAt: serverTimestamp(),
          clickEvents: arrayUnion(clickEvent),
          // Keep track of the URL clicks for consistency
          urlClicks: newClickCount,
        })
      } else {
        console.log(`📝 Creating new analytics document for: ${shortCode}`)

        // Create new analytics document
        transaction.set(analyticsRef, {
          shortCode,
          totalClicks: 1, // Start with 1 for the first click
          createdAt: serverTimestamp(),
          lastClickAt: serverTimestamp(),
          clickEvents: [clickEvent],
          urlClicks: newClickCount,
        })
      }

      console.log(`✅ Analytics transaction completed for: ${shortCode}`)
    })

    console.log(`🎉 Click recorded successfully for: ${shortCode}`)
  } catch (error) {
    console.error("❌ Error recording click analytics:", error)
    // Don't throw - we don't want to break the redirect
  }
}
