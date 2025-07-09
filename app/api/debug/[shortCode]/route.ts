import { type NextRequest, NextResponse } from "next/server"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

export async function GET(request: NextRequest, { params }: { params: { shortCode: string } }) {
  const { shortCode } = params

  try {
    console.log(`Debug: Looking up short code: ${shortCode}`)

    // Test Redis connection
    const pingResult = await redis.ping()
    console.log("Redis ping result:", pingResult)

    // Get URL data
    const urlData = await redis.get(shortCode)
    console.log(`Debug: Raw Redis data for ${shortCode}:`, urlData)

    // Get analytics data
    const analyticsData = await redis.get(`analytics:${shortCode}`)
    console.log(`Debug: Analytics data for ${shortCode}:`, analyticsData)

    // List all keys (for debugging - remove in production)
    const allKeys = await redis.keys("*")
    console.log("All Redis keys:", allKeys)

    return NextResponse.json({
      shortCode,
      urlData,
      analyticsData,
      allKeys: allKeys.slice(0, 20), // Limit to first 20 keys
      redisConnected: pingResult === "PONG",
      environment: {
        hasUrl: !!process.env.KV_REST_API_URL,
        hasToken: !!process.env.KV_REST_API_TOKEN,
      },
    })
  } catch (error) {
    console.error("Debug error:", error)
    return NextResponse.json(
      {
        error: error.message,
        shortCode,
        environment: {
          hasUrl: !!process.env.KV_REST_API_URL,
          hasToken: !!process.env.KV_REST_API_TOKEN,
        },
      },
      { status: 500 },
    )
  }
}
