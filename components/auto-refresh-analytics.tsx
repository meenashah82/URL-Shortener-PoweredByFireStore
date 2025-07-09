"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Activity, Wifi, WifiOff, RefreshCw } from "lucide-react"

interface AutoRefreshAnalyticsProps {
  shortCode: string
  onDataUpdate: (data: any) => void
  children: React.ReactNode
}

export function AutoRefreshAnalytics({ shortCode, onDataUpdate, children }: AutoRefreshAnalyticsProps) {
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting")
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [updateCount, setUpdateCount] = useState(0)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    console.log(`🚀 Initializing auto-refresh analytics for: ${shortCode}`)

    // Set up heartbeat to monitor connection
    const startHeartbeat = () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
      }

      heartbeatRef.current = setInterval(() => {
        if (connectionStatus === "connected") {
          console.log("💓 Analytics heartbeat - connection healthy")
        } else {
          console.log("⚠️ Analytics heartbeat - connection issues detected")
          setConnectionStatus("connecting")
        }
      }, 10000) // Check every 10 seconds
    }

    // Set up retry mechanism
    const setupRetry = () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }

      retryTimeoutRef.current = setTimeout(() => {
        console.log("🔄 Auto-retry: Attempting to reconnect analytics...")
        setConnectionStatus("connecting")
        setUpdateCount(0)
      }, 5000)
    }

    // Monitor for updates
    const handleUpdate = (data: any) => {
      console.log("📊 Auto-refresh: Data update received", {
        updateCount: updateCount + 1,
        timestamp: new Date().toISOString(),
      })

      setConnectionStatus("connected")
      setLastUpdate(new Date())
      setUpdateCount((prev) => prev + 1)
      onDataUpdate(data)

      // Clear retry timeout on successful update
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }

    // Handle connection errors
    const handleError = () => {
      console.log("❌ Auto-refresh: Connection error detected")
      setConnectionStatus("disconnected")
      setupRetry()
    }

    startHeartbeat()

    return () => {
      console.log("🧹 Cleaning up auto-refresh analytics")
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
      }
    }
  }, [shortCode, connectionStatus, updateCount, onDataUpdate])

  return (
    <div className="space-y-4">
      {/* Connection Status Bar */}
      <Card
        className={`border-l-4 ${
          connectionStatus === "connected"
            ? "border-l-green-500 bg-green-50"
            : connectionStatus === "connecting"
              ? "border-l-yellow-500 bg-yellow-50"
              : "border-l-red-500 bg-red-50"
        }`}
      >
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {connectionStatus === "connected" ? (
                <Wifi className="h-4 w-4 text-green-600" />
              ) : connectionStatus === "connecting" ? (
                <RefreshCw className="h-4 w-4 text-yellow-600 animate-spin" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-600" />
              )}

              <span
                className={`text-sm font-medium ${
                  connectionStatus === "connected"
                    ? "text-green-700"
                    : connectionStatus === "connecting"
                      ? "text-yellow-700"
                      : "text-red-700"
                }`}
              >
                {connectionStatus === "connected"
                  ? "Real-time updates active - No refresh needed!"
                  : connectionStatus === "connecting"
                    ? "Connecting to real-time updates..."
                    : "Connection lost - Attempting to reconnect..."}
              </span>

              {connectionStatus === "connected" && <Activity className="h-4 w-4 text-green-600 animate-pulse" />}
            </div>

            <div className="text-xs text-gray-600">
              {lastUpdate && <span>Last update: {lastUpdate.toLocaleTimeString()}</span>}
              {updateCount > 0 && (
                <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded-full">{updateCount} updates</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Content */}
      {children}
    </div>
  )
}
