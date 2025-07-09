import { type NextRequest, NextResponse } from "next/server"
import { createShortUrl } from "@/lib/analytics"

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
    const shortCode = generateShortCode()
    const attempts = 0
    const maxAttempts = 10

    // Note: In a production app, you'd want to check for uniqueness in Firestore
    // For now, we'll assume the generated code is unique
    while (attempts < maxAttempts) {
      // You could add a check here to see if the shortCode already exists
      break
    }

    console.log("3. Final short code:", shortCode)

    // Create the short URL in Firestore
    console.log("4. Creating short URL in Firestore...")
    await createShortUrl(shortCode, url)
    console.log("5. Short URL created successfully")

    const baseUrl = request.nextUrl.origin
    const shortUrl = `${baseUrl}/${shortCode}`

    console.log("6. Short URL created:", shortUrl)
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
