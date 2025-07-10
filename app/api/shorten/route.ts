import { type NextRequest, NextResponse } from "next/server"
import { doc, setDoc, getDoc, serverTimestamp, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"

function generateShortCode(length = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let result = ""
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function isValidUrl(string: string): boolean {
  try {
    const url = new URL(string)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("=== SHORTEN URL REQUEST ===")

    const { url } = await request.json()
    console.log("1. URL to shorten:", url)

    if (!url || typeof url !== "string") {
      console.log("ERROR: URL is required")
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    if (!isValidUrl(url)) {
      console.log("ERROR: Invalid URL format")
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 })
    }

    // Generate a unique short code
    console.log("2. Generating short code...")
    let shortCode = generateShortCode()
    let attempts = 0
    const maxAttempts = 10

    // Check for uniqueness
    while (attempts < maxAttempts) {
      const urlRef = doc(db, "urls", shortCode)
      const existingDoc = await getDoc(urlRef)

      if (!existingDoc.exists()) {
        break // Found unique code
      }

      shortCode = generateShortCode()
      attempts++
      console.log(`3. Code ${shortCode} exists, trying again (attempt ${attempts})`)
    }

    if (attempts >= maxAttempts) {
      console.log("ERROR: Could not generate unique short code")
      return NextResponse.json({ error: "Could not generate unique short code" }, { status: 500 })
    }

    console.log("4. Final short code:", shortCode)

    // Create expiration date (30 days from now)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    // Create URL document
    const urlRef = doc(db, "urls", shortCode)
    const analyticsRef = doc(db, "analytics", shortCode)

    const urlData = {
      originalUrl: url,
      shortCode,
      createdAt: serverTimestamp(),
      isActive: true,
      expiresAt: Timestamp.fromDate(expiresAt),
    }

    const analyticsData = {
      shortCode,
      totalClicks: 0,
      createdAt: serverTimestamp(),
      clickEvents: [],
    }

    console.log("5. Creating documents in Firestore...")

    // Create both documents
    await Promise.all([setDoc(urlRef, urlData), setDoc(analyticsRef, analyticsData)])

    console.log("6. Documents created successfully")

    const baseUrl = request.nextUrl.origin
    const shortUrl = `${baseUrl}/${shortCode}`

    console.log("7. Short URL created:", shortUrl)
    console.log("=== SHORTEN URL COMPLETE ===")

    return NextResponse.json({
      shortUrl,
      originalUrl: url,
      shortCode,
      createdAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("=== SHORTEN URL ERROR ===", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 },
    )
  }
}
