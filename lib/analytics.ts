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
  timestamp: any
  userAgent?: string
  referer?: string
  ip?: string
  country?: string
  city?: string
  id?: string
  clickSource?: "direct" | "analytics_page" | "test"
  sessionId?: string
}

export interface UrlData {
  originalUrl: string
  shortCode: string
  createdAt: any
  clicks?: number // Optional for backward compatibility
  isActive: boolean
  expiresAt: any
  lastClickAt?: any
}

export interface AnalyticsData {
  shortCode: string
  totalClicks: number
  createdAt: any
  lastClickAt?: any
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
      console.log(`URL document not found: ${shortCode}`)
      return null
    }

    const data = urlSnap.data() as UrlData

    // Check if URL has expired
    if ((data.expiresAt && data.expiresAt.toDate() < new Date()) || !data.isActive) {
      console.log(`URL expired or inactive: ${shortCode}`)
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
      console.log(`Analytics document not found: ${shortCode}`)
      return null
    }

    return analyticsSnap.data() as AnalyticsData
  } catch (error) {
    console.error("Error getting analytics data:", error)
    return null
  }
}

// Enhanced real-time listener for analytics data
export function subscribeToAnalytics(shortCode: string, callback: (data: AnalyticsData | null) => void): () => void {
  const analyticsRef = doc(db, "analytics", shortCode)

  console.log(`🔄 Starting real-time analytics subscription for: ${shortCode}`)

  return onSnapshot(
    analyticsRef,
    {
      includeMetadataChanges: true,
    },
    async (doc) => {
      if (doc.exists()) {
        const data = doc.data() as AnalyticsData
        console.log("📡 Analytics update received:", {
          shortCode,
          totalClicks: data.totalClicks,
          clickEventsCount: data.clickEvents?.length || 0,
        })
        callback(data)
      } else {
        console.log(`❌ No analytics document found for: ${shortCode}`)
        callback(null)
      }
    },
    (error) => {
      console.error("❌ Real-time analytics subscription error:", error)
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
    limit(limitCount),
  )

  return onSnapshot(
    analyticsQuery,
    {
      includeMetadataChanges: true,
    },
    (snapshot) => {
      const recentClicks: Array<ClickEvent & { shortCode: string }> = []

      snapshot.forEach((doc) => {
        const data = doc.data() as AnalyticsData
        if (data.clickEvents && data.clickEvents.length > 0) {
          const recentUrlClicks = data.clickEvents.slice(-5).map((click) => ({
            ...click,
            shortCode: data.shortCode,
          }))
          recentClicks.push(...recentUrlClicks)
        }
      })

      recentClicks.sort((a, b) => {
        const aTime = a.timestamp?.seconds || 0
        const bTime = b.timestamp?.seconds || 0
        return bTime - aTime
      })

      callback(recentClicks.slice(0, limitCount))
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
    orderBy("createdAt", "desc"),
    limit(limitCount),
  )

  return onSnapshot(
    urlsQuery,
    {
      includeMetadataChanges: true,
    },
    async (snapshot) => {
      const urls: Array<{ shortCode: string; clicks: number; originalUrl: string }> = []

      for (const doc of snapshot.docs) {
        const urlData = doc.data() as UrlData

        // Get click count from analytics
        const analyticsRef = doc(db, "analytics", urlData.shortCode)
        const analyticsSnap = await getDoc(analyticsRef)
        const clicks = analyticsSnap.exists() ? (analyticsSnap.data() as AnalyticsData).totalClicks || 0 : 0

        urls.push({
          shortCode: urlData.shortCode,
          clicks,
          originalUrl: urlData.originalUrl,
        })
      }

      // Sort by clicks descending
      urls.sort((a, b) => b.clicks - a.clicks)

      callback(urls.slice(0, limitCount))
    },
    (error) => {
      console.error("Error in top URLs subscription:", error)
      callback([])
    },
  )
}
