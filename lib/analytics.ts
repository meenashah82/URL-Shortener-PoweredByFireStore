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
  runTransaction,
  getDocs, // Import getDocs
} from "firebase/firestore"
import { db } from "./firebase"

export interface ClickEvent {
  timestamp: any // Firestore timestamp
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
  urlClicks?: number // Track URL clicks for consistency
}

// Create a new short URL with proper analytics initialization
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
      clicks: 0, // Start with 0 clicks
      isActive: true,
      expiresAt: Timestamp.fromDate(expiresAt),
    }

    const analyticsData: AnalyticsData = {
      shortCode,
      totalClicks: 0, // Start with 0 clicks
      createdAt: serverTimestamp(),
      clickEvents: [],
      urlClicks: 0, // Track URL clicks separately
    }

    // Create both documents atomically
    await Promise.all([setDoc(urlRef, urlData), setDoc(analyticsRef, analyticsData)])

    console.log(`✅ Short URL and analytics created successfully: ${shortCode}`)
  } catch (error) {
    console.error("❌ Error creating short URL:", error)
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

// Get analytics data with proper click count
export async function getAnalyticsData(shortCode: string): Promise<AnalyticsData | null> {
  try {
    const analyticsRef = doc(db, "analytics", shortCode)
    const analyticsSnap = await getDoc(analyticsRef)

    if (!analyticsSnap.exists()) {
      // If analytics doesn't exist, create it
      console.log(`📝 Creating missing analytics document for: ${shortCode}`)

      const urlRef = doc(db, "urls", shortCode)
      const urlSnap = await getDoc(urlRef)

      if (urlSnap.exists()) {
        const urlData = urlSnap.data() as UrlData
        const newAnalytics: AnalyticsData = {
          shortCode,
          totalClicks: urlData.clicks || 0,
          createdAt: urlData.createdAt || serverTimestamp(),
          clickEvents: [],
          urlClicks: urlData.clicks || 0,
        }

        await setDoc(analyticsRef, newAnalytics)
        return newAnalytics
      }

      return null
    }

    const data = analyticsSnap.data() as AnalyticsData

    // Ensure totalClicks is properly set
    if (typeof data.totalClicks !== "number") {
      console.log(`🔧 Fixing totalClicks for: ${shortCode}`)

      // Count clicks from events or use URL clicks
      const clickCount = data.clickEvents?.length || 0

      await runTransaction(db, async (transaction) => {
        transaction.update(analyticsRef, {
          totalClicks: clickCount,
        })
      })

      data.totalClicks = clickCount
    }

    return data
  } catch (error) {
    console.error("Error getting analytics data:", error)
    return null
  }
}

// Enhanced real-time listener for analytics data
export function subscribeToAnalytics(shortCode: string, callback: (data: AnalyticsData | null) => void): () => void {
  const analyticsRef = doc(db, "analytics", shortCode)

  console.log(`🔄 Starting real-time analytics subscription for: ${shortCode}`)

  let isFirstLoad = true

  return onSnapshot(
    analyticsRef,
    {
      includeMetadataChanges: true, // Include pending writes for instant updates
    },
    async (doc) => {
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
          isFirstLoad,
        })

        // Fix totalClicks if it's missing or incorrect
        if (typeof data.totalClicks !== "number" || data.totalClicks === 0) {
          const clickCount = data.clickEvents?.length || 0
          if (clickCount > 0) {
            console.log(`🔧 Auto-fixing totalClicks: ${data.totalClicks} → ${clickCount}`)

            try {
              await runTransaction(db, async (transaction) => {
                transaction.update(analyticsRef, {
                  totalClicks: clickCount,
                })
              })

              data.totalClicks = clickCount
            } catch (error) {
              console.error("Error fixing totalClicks:", error)
            }
          }
        }

        callback(data)

        if (isFirstLoad) {
          isFirstLoad = false
          console.log("✅ Initial analytics data loaded successfully")
        }
      } else {
        console.log(`❌ No analytics document found for: ${shortCode}`)

        // Create analytics document if it doesn't exist
        try {
          const urlRef = doc(db, "urls", shortCode)
          const urlSnap = await getDoc(urlRef)

          if (urlSnap.exists()) {
            const urlData = urlSnap.data() as UrlData
            const emptyAnalytics: AnalyticsData = {
              shortCode,
              totalClicks: urlData.clicks || 0,
              createdAt: urlData.createdAt || serverTimestamp(),
              clickEvents: [],
              urlClicks: urlData.clicks || 0,
            }

            await setDoc(analyticsRef, emptyAnalytics)
            console.log("📝 Created missing analytics document")
            callback(emptyAnalytics)
          } else {
            callback(null)
          }
        } catch (error) {
          console.error("❌ Error creating analytics document:", error)
          callback(null)
        }
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
    orderBy("lastClickAt", "desc"),
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
      includeMetadataChanges: true,
    },
    (snapshot) => {
      const topUrls = snapshot.docs.map((doc) => {
        const data = doc.data() as UrlData
        return {
          shortCode: data.shortCode,
          clicks: data.clicks || 0, // Ensure clicks is a number
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

// Utility function to fix existing analytics documents
export async function fixExistingAnalytics(): Promise<void> {
  try {
    console.log("🔧 Starting analytics repair process...")

    const analyticsQuery = query(collection(db, "analytics"))
    const analyticsSnapshot = await getDocs(analyticsQuery)

    const fixes: Promise<void>[] = []

    analyticsSnapshot.forEach((doc) => {
      const data = doc.data() as AnalyticsData
      const shortCode = doc.id

      // Check if totalClicks needs fixing
      if (typeof data.totalClicks !== "number" || data.totalClicks === 0) {
        const clickCount = data.clickEvents?.length || 0

        if (clickCount > 0) {
          console.log(`🔧 Fixing analytics for ${shortCode}: totalClicks ${data.totalClicks} → ${clickCount}`)

          const fix = runTransaction(db, async (transaction) => {
            const analyticsRef = doc(db, "analytics", shortCode)
            transaction.update(analyticsRef, {
              totalClicks: clickCount,
            })
          })

          fixes.push(fix)
        }
      }
    })

    await Promise.all(fixes)
    console.log(`✅ Fixed ${fixes.length} analytics documents`)
  } catch (error) {
    console.error("❌ Error fixing analytics:", error)
  }
}
