import { type NextRequest, NextResponse } from "next/server"
import { doc, getDoc, updateDoc, increment, arrayUnion, serverTimestamp } from "firebase/firestore"
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
    console.log(`=== API REDIRECT REQUEST ===`)
    console.log(`1. Looking up short code: ${shortCode}`)

    // Get URL data from Firestore
    const urlRef = doc(db, "urls", shortCode)
    const urlSnap = await getDoc(urlRef)

    if (!urlSnap.exists()) {
      console.log(`2. No data found for short code: ${shortCode}`)
      return NextResponse.json({ error: "Short code not found" }, { status: 404 })
    }

    const urlData = urlSnap.data() as UrlData
    console.log(`2. Firestore response for ${shortCode}:`, urlData)

    // Check if URL has expired or is inactive
    if (!urlData.isActive || (urlData.expiresAt && urlData.expiresAt.toDate() < new Date())) {
      console.log(`3. URL expired or inactive for ${shortCode}`)
      return NextResponse.json({ error: "Short code expired" }, { status: 404 })
    }

    // Validate that we have the required data
    if (!urlData.originalUrl) {
      console.error("No originalUrl found in data:", urlData)
      return NextResponse.json({ error: "Invalid URL data" }, { status: 500 })
    }

    // Ensure the URL has a protocol
    let redirectUrl = urlData.originalUrl
    if (!redirectUrl.startsWith("http://") && !redirectUrl.startsWith("https://")) {
      redirectUrl = "https://" + redirectUrl
    }

    console.log(`3. Final redirect URL: ${redirectUrl}`)

    // Get headers for analytics
    const userAgent = request.headers.get("user-agent") || ""
    const referer = request.headers.get("referer") || ""
    const forwardedFor = request.headers.get("x-forwarded-for") || ""
    const ip = forwardedFor.split(",")[0]?.trim() || ""

    // Record the click immediately (don't use background processing)
    console.log(`4. Recording click analytics...`)
    await recordClickAnalytics(shortCode, userAgent, referer, ip)

    console.log(`5. Returning redirect URL: ${redirectUrl}`)
    console.log(`=== API REDIRECT COMPLETE ===`)

    // Return the redirect URL for client-side redirection
    return NextResponse.json({ redirectUrl })
  } catch (error) {
    console.error("=== API REDIRECT ERROR ===", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function recordClickAnalytics(shortCode: string, userAgent: string, referer: string, ip: string) {
  try {
    console.log(`Recording analytics for ${shortCode}`)

    const urlRef = doc(db, "urls", shortCode)
    const analyticsRef = doc(db, "analytics", shortCode)

    const clickEvent = {
      timestamp: serverTimestamp(),
      userAgent: userAgent.substring(0, 200), // Limit length
      referer: referer.substring(0, 200),
      ip: ip.substring(0, 15), // Truncate for privacy
    }

    console.log(`Click event data:`, clickEvent)

    // Update both documents
    const updatePromises = [
      // Update URL clicks count
      updateDoc(urlRef, {
        clicks: increment(1),
      }),
      // Update analytics
      updateDoc(analyticsRef, {
        totalClicks: increment(1),
        lastClickAt: serverTimestamp(),
        clickEvents: arrayUnion(clickEvent),
      }),
    ]

    await Promise.all(updatePromises)
    console.log(`Analytics updated successfully for ${shortCode}`)
  } catch (error) {
    console.error("Error recording analytics:", error)
    // Don't throw error - we don't want to break the redirect
  }
}
