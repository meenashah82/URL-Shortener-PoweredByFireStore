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
  getDocs,
  increment,
  arrayUnion,
} from "firebase/firestore"
import { db } from "./firebase"

export interface ClickEvent {
  timestamp: any
  userAgent?: string
  referer?: string
  ip?: string
  id?: string
  clickSource?: "direct" | "analytics_page" | "test"
  sessionId?: string
}

// Clean URL data structure - NO CLICKS stored here
export interface UrlData {
  originalUrl: string
  shortCode: string
  createdAt: any
  isActive: boolean
  expiresAt: any
  // ❌ REMOVED: clicks: number (this belongs in analytics only)
}

// Analytics is the SINGLE SOURCE OF TRUTH for clicks
export interface AnalyticsData {
  shortCode: string
  totalClicks: number // ✅ ONLY field for click tracking
  createdAt: any
  lastClickAt?: any
  clickEvents: ClickEvent[]
  // ❌ REMOVE any other click-related fields
}

// Create short URL - NO click tracking in URL document
export async function createShortUrl(shortCode: string, originalUrl: string): Promise<void> {
  try {
    console.log(`Creating short URL: ${shortCode} -> ${originalUrl}`)

    const urlRef = doc(db, "urls", shortCode)
    const analyticsRef = doc(db, "analytics", shortCode)

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    // Clean URL document - NO clicks field
    const urlData: UrlData = {
      originalUrl,
      shortCode,
      createdAt: serverTimestamp(),
      isActive: true,
      expiresAt: Timestamp.fromDate(expiresAt),
      // ✅ NO clicks field - analytics handles this
    }

    // Analytics is the single source of truth for clicks
    const analyticsData: AnalyticsData = {
      shortCode,
      totalClicks: 0, // ✅ ONLY place clicks are tracked
      createdAt: serverTimestamp(),
      clickEvents: [],
    }

    await Promise.all([setDoc(urlRef, urlData), setDoc(analyticsRef, analyticsData)])

    console.log(`✅ Clean URL structure created: ${shortCode}`)
  } catch (error) {
    console.error("❌ Error creating short URL:", error)
    throw error
  }
}

// Get URL data - clean structure
export async function getUrlData(shortCode: string): Promise<UrlData | null> {
  try {
    const urlRef = doc(db, "urls", shortCode)
    const urlSnap = await getDoc(urlRef)

    if (!urlSnap.exists()) {
      return null
    }

    const data = urlSnap.data() as UrlData

    if ((data.expiresAt && data.expiresAt.toDate() < new Date()) || !data.isActive) {
      return null
    }

    return data
  } catch (error) {
    console.error("Error getting URL data:", error)
    return null
  }
}

// Get click count from analytics (single source of truth)
export async function getClickCount(shortCode: string): Promise<number> {
  try {
    const analyticsRef = doc(db, "analytics", shortCode)
    const analyticsSnap = await getDoc(analyticsRef)

    if (!analyticsSnap.exists()) {
      return 0
    }

    const data = analyticsSnap.data() as AnalyticsData
    return data.totalClicks || 0
  } catch (error) {
    console.error("Error getting click count:", error)
    return 0
  }
}

// Get complete URL info with click count from analytics
export async function getUrlWithAnalytics(shortCode: string): Promise<{
  url: UrlData | null
  clicks: number
  analytics: AnalyticsData | null
}> {
  try {
    const [urlData, analyticsData] = await Promise.all([getUrlData(shortCode), getAnalyticsData(shortCode)])

    return {
      url: urlData,
      clicks: analyticsData?.totalClicks || 0,
      analytics: analyticsData,
    }
  } catch (error) {
    console.error("Error getting URL with analytics:", error)
    return { url: null, clicks: 0, analytics: null }
  }
}

// Analytics data - single source of truth
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

// Record click - ONLY update analytics (single source of truth)
export async function recordClick(shortCode: string, userAgent: string, referer: string, ip: string): Promise<void> {
  try {
    const analyticsRef = doc(db, "analytics", shortCode)

    const clickEvent: ClickEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: serverTimestamp(),
      userAgent: userAgent.substring(0, 200),
      referer: referer.substring(0, 200),
      ip: ip.substring(0, 15),
      sessionId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      clickSource: "direct",
    }

    // ✅ ONLY update analytics - no URL document changes needed
    await runTransaction(db, async (transaction) => {
      const analyticsDoc = await transaction.get(analyticsRef)

      if (analyticsDoc.exists()) {
        transaction.update(analyticsRef, {
          totalClicks: increment(1), // ✅ Single source of truth
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

    console.log(`✅ Click recorded in analytics only: ${shortCode}`)
  } catch (error) {
    console.error("❌ Error recording click:", error)
    throw error
  }
}

// Real-time subscription to analytics (single source of truth)
export function subscribeToAnalytics(shortCode: string, callback: (data: AnalyticsData | null) => void): () => void {
  const analyticsRef = doc(db, "analytics", shortCode)

  console.log(`🔄 Subscribing to analytics (single source): ${shortCode}`)

  return onSnapshot(
    analyticsRef,
    { includeMetadataChanges: true },
    (doc) => {
      if (doc.exists()) {
        const data = doc.data() as AnalyticsData
        console.log(`📊 Analytics update: ${shortCode} - ${data.totalClicks} clicks`)
        callback(data)
      } else {
        callback(null)
      }
    },
    (error) => {
      console.error("❌ Analytics subscription error:", error)
      callback(null)
    },
  )
}

// Get top URLs by click count (from analytics only)
export function subscribeToTopUrls(
  callback: (urls: Array<{ shortCode: string; clicks: number; originalUrl: string }>) => void,
  limitCount = 10,
): () => void {
  // Query analytics for top click counts
  const analyticsQuery = query(
    collection(db, "analytics"),
    where("totalClicks", ">", 0),
    orderBy("totalClicks", "desc"),
    limit(limitCount),
  )

  return onSnapshot(
    analyticsQuery,
    { includeMetadataChanges: true },
    async (snapshot) => {
      const topUrls: Array<{ shortCode: string; clicks: number; originalUrl: string }> = []

      // Get URL data for each top analytics entry
      for (const doc of snapshot.docs) {
        const analyticsData = doc.data() as AnalyticsData
        const urlData = await getUrlData(analyticsData.shortCode)

        if (urlData) {
          topUrls.push({
            shortCode: analyticsData.shortCode,
            clicks: analyticsData.totalClicks, // ✅ From analytics (single source)
            originalUrl: urlData.originalUrl,
          })
        }
      }

      callback(topUrls)
    },
    (error) => {
      console.error("Error in top URLs subscription:", error)
      callback([])
    },
  )
}

// Migration function to clean up redundant clicks from URL documents
export async function migrateToCleanArchitecture(): Promise<void> {
  try {
    console.log("🧹 Starting migration to clean architecture...")

    const urlsQuery = query(collection(db, "urls"))
    const urlsSnapshot = await getDocs(urlsQuery)

    const migrations: Promise<void>[] = []

    urlsSnapshot.forEach((doc) => {
      const urlData = doc.data()

      // If URL document has clicks field, remove it
      if ("clicks" in urlData) {
        console.log(`🧹 Removing redundant clicks field from URL: ${doc.id}`)

        const migration = runTransaction(db, async (transaction) => {
          const urlRef = doc.ref

          // Remove clicks field from URL document
          const cleanUrlData = { ...urlData }
          delete cleanUrlData.clicks

          transaction.set(urlRef, cleanUrlData)
        })

        migrations.push(migration)
      }
    })

    await Promise.all(migrations)
    console.log(`✅ Migration complete: cleaned ${migrations.length} URL documents`)
  } catch (error) {
    console.error("❌ Migration error:", error)
    throw error
  }
}
