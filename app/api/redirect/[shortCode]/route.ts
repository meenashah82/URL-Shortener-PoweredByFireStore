import { type NextRequest, NextResponse } from "next/server"
import { doc, getDoc, increment, arrayUnion, serverTimestamp, runTransaction } from "firebase/firestore"
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

    // Record the click using transaction for immediate consistency
    console.log(`4. Recording click analytics with transaction...`)
    await recordClickWithTransaction(shortCode, userAgent, referer, ip)

    console.log(`5. Returning redirect URL: ${redirectUrl}`)
    console.log(`=== API REDIRECT COMPLETE ===`)

    // Return the redirect URL for client-side redirection
    return NextResponse.json({ redirectUrl })
  } catch (error) {
    console.error("=== API REDIRECT ERROR ===", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function recordClickWithTransaction(shortCode: string, userAgent: string, referer: string, ip: string) {
  try {
    console.log(`Recording analytics with transaction for ${shortCode}`)

    const urlRef = doc(db, "urls", shortCode)
    const analyticsRef = doc(db, "analytics", shortCode)

    // Use transaction to ensure atomic updates and immediate consistency
    await runTransaction(db, async (transaction) => {
      // Read current data
      const urlDoc = await transaction.get(urlRef)
      const analyticsDoc = await transaction.get(analyticsRef)

      if (!urlDoc.exists()) {
        throw new Error("URL document does not exist")
      }

      const clickEvent = {
        timestamp: serverTimestamp(),
        userAgent: userAgent.substring(0, 200),
        referer: referer.substring(0, 200),
        ip: ip.substring(0, 15),
        id: Date.now().toString(), // Add unique ID for better tracking
      }

      console.log(`Transaction: Adding click event`, clickEvent)

      // Update URL clicks count
      transaction.update(urlRef, {
        clicks: increment(1),
        lastClickAt: serverTimestamp(),
      })

      // Update or create analytics document
      if (analyticsDoc.exists()) {
        transaction.update(analyticsRef, {
          totalClicks: increment(1),
          lastClickAt: serverTimestamp(),
          clickEvents: arrayUnion(clickEvent),
        })
      } else {
        // Create analytics document if it doesn't exist
        transaction.set(analyticsRef, {
          shortCode,
          totalClicks: 1,
          createdAt: serverTimestamp(),
          lastClickAt: serverTimestamp(),
          clickEvents: [clickEvent],
        })
      }
    })

    console.log(`Transaction completed successfully for ${shortCode}`)
  } catch (error) {
    console.error("Error in transaction:", error)
    // Don't throw error - we don't want to break the redirect
  }
}
