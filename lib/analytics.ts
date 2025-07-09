import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from "firebase/firestore"
import { db } from "./firebase"

export interface ClickEvent {
  timestamp: any // Firestore timestamp
  userAgent?: string
  referer?: string
  ip?: string
  country?: string
  city?: string
  id?: string // Add unique ID for better tracking
}

export interface UrlData {
  originalUrl: string
  shortCode: string
  createdAt: any // Firestore timestamp
  clicks: number
  isActive: boolean
  expiresAt: any // Firestore timestamp
  lastClickAt?: any // Add last click timestamp
}

export interface AnalyticsData {
  shortCode: string
  totalClicks: number
  createdAt: any // Firestore timestamp
  lastClickAt?: any // Firestore timestamp
  clickEvents: ClickEvent[]
}

// Create a new short URL
export async function createShortUrl(shortCode: string, originalUrl: string): Promise<void> {
  try {
    console.log(`Creating short URL: ${shortCode} -> ${originalUrl}`)

    const urlRef = doc(db, "urls", shortCode)
    const analyticsRef = doc(db, "analytics", shortCode)

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30) // 30 days from now

    const urlData: UrlData = {
      originalUrl,
      shortCode,
      createdAt: serverTimestamp(),
      clicks: 0,
      isActive: true,
      expiresAt: Timestamp.fromDate(expiresAt),
    }

    const analyticsData: AnalyticsData = {
      shortCode,
      totalClicks: 0,
      createdAt: serverTimestamp(),
      clickEvents: [],
    }

    await Promise.all([setDoc(urlRef, urlData), setDoc(analyticsRef, analyticsData)])
    console.log(`Short URL created successfully: ${shortCode}`)
  } catch (error) {
    console.error("Error creating short URL:", error)
    throw error
  }
}

// Get URL data
export async function getUrlData(shortCode: string): Promise<UrlData | null> {
  try {
    const urlRef = doc(db, "urls", shortCode)
    const urlSnap = await getDoc(urlRef)

    if (!urlSnap.exists()) {
      return null
    }

    const data = urlSnap.data() as UrlData

    // Check if URL has expired
    if ((data.expiresAt && data.expiresAt.toDate() < new Date()) || !data.isActive) {
      return null
    }

    return data
  } catch (error) {
    console.error("Error getting URL data:", error)
    return null
  }
}

// Get analytics data
export async function getAnalyticsData(shortCode: string): Promise<AnalyticsData | null> {
  try {
    const analyticsRef = doc(db, "analytics", shortCode)
    const analyticsSnap = await getDoc(analyticsRef)

    if (!analyticsSnap.exists()) {
      return null
    }

    return analyticsSnap.data() as AnalyticsData
  } catch (error) {
    console.error("Error getting analytics data:", error)
    return null
  }
}

// Enhanced real-time listener for analytics data with automatic browser updates
export function subscribeToAnalytics(shortCode: string, callback: (data: AnalyticsData | null) => void): () => void {
  const analyticsRef = doc(db, "analytics", shortCode)

  console.log(`🔄 Starting real-time analytics subscription for: ${shortCode}`)

  return onSnapshot(
    analyticsRef,
    {
      includeMetadataChanges: true, // Include pending writes for instant updates
    },
    (doc) => {
      const timestamp = new Date().toISOString()

      if (doc.exists()) {
        const data = doc.data() as AnalyticsData

        console.log("📡 Analytics update received:", {
          shortCode,
          totalClicks: data.totalClicks,
          clickEventsCount: data.clickEvents?.length || 0,
          fromCache: doc.metadata.fromCache,
          hasPendingWrites: doc.metadata.hasPendingWrites,
          source: doc.metadata.fromCache ? "local-cache" : "server",
          timestamp,
        })

        // Always trigger callback for any change, including local changes
        callback(data)

        // If this is a pending write, set up a follow-up listener for server confirmation
        if (doc.metadata.hasPendingWrites) {
          console.log("⏳ Pending write detected, waiting for server confirmation...")

          // Set up a one-time listener for server confirmation
          const serverConfirmListener = onSnapshot(
            analyticsRef,
            { includeMetadataChanges: false }, // Only server updates
            (serverDoc) => {
              if (serverDoc.exists() && !serverDoc.metadata.hasPendingWrites) {
                console.log("✅ Server confirmation received")
                callback(serverDoc.data() as AnalyticsData)
                serverConfirmListener() // Unsubscribe after confirmation
              }
            },
          )
        }
      } else {
        console.log(`❌ No analytics document found for: ${shortCode}`)
        callback(null)
      }
    },
    (error) => {
      console.error("❌ Real-time analytics subscription error:", error)

      // Implement retry logic
      setTimeout(() => {
        console.log("🔄 Retrying analytics subscription...")
        subscribeToAnalytics(shortCode, callback)
      }, 2000)

      callback(null)
    },
  )
}

// Get recent clicks across all URLs (for dashboard)
export function subscribeToRecentClicks(
  callback: (clicks: Array<ClickEvent & { shortCode: string }>) => void,
  limitCount = 50,
): () => void {
  const analyticsQuery = query(
    collection(db, "analytics"),
    where("totalClicks", ">", 0),
    orderBy("totalClicks", "desc"),
    orderBy("lastClickAt", "desc"),
    limit(limitCount),
  )

  return onSnapshot(
    analyticsQuery,
    {
      includeMetadataChanges: true, // Include pending writes for immediate updates
    },
    (snapshot) => {
      const recentClicks: Array<ClickEvent & { shortCode: string }> = []

      snapshot.forEach((doc) => {
        const data = doc.data() as AnalyticsData
        if (data.clickEvents && data.clickEvents.length > 0) {
          // Get the most recent clicks from each URL
          const recentUrlClicks = data.clickEvents
            .slice(-5) // Get last 5 clicks from this URL
            .map((click) => ({
              ...click,
              shortCode: data.shortCode,
            }))
          recentClicks.push(...recentUrlClicks)
        }
      })

      // Sort by timestamp descending and limit
      recentClicks
        .sort((a, b) => {
          const aTime = a.timestamp?.seconds || 0
          const bTime = b.timestamp?.seconds || 0
          return bTime - aTime
        })
        .slice(0, limitCount)

      callback(recentClicks)
    },
    (error) => {
      console.error("Error in recent clicks subscription:", error)
      callback([])
    },
  )
}

// Get top performing URLs
export function subscribeToTopUrls(
  callback: (urls: Array<{ shortCode: string; clicks: number; originalUrl: string }>) => void,
  limitCount = 10,
): () => void {
  const urlsQuery = query(
    collection(db, "urls"),
    where("isActive", "==", true),
    where("clicks", ">", 0),
    orderBy("clicks", "desc"),
    limit(limitCount),
  )

  return onSnapshot(
    urlsQuery,
    {
      includeMetadataChanges: true, // Include pending writes for immediate updates
    },
    (snapshot) => {
      const topUrls = snapshot.docs.map((doc) => {
        const data = doc.data() as UrlData
        return {
          shortCode: data.shortCode,
          clicks: data.clicks,
          originalUrl: data.originalUrl,
        }
      })

      callback(topUrls)
    },
    (error) => {
      console.error("Error in top URLs subscription:", error)
      callback([])
    },
  )
}
