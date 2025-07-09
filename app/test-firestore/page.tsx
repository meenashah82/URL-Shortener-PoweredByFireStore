"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { db } from "@/lib/firebase"
import { doc, setDoc, getDoc, collection, getDocs } from "firebase/firestore"

export default function TestFirestore() {
  const [result, setResult] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [testData, setTestData] = useState("Hello Firestore!")

  const testWrite = async () => {
    setLoading(true)
    try {
      const testDoc = doc(db, "test", "test-doc")
      await setDoc(testDoc, {
        message: testData,
        timestamp: new Date(),
        test: true,
      })
      setResult("✅ Write successful! Data written to Firestore.")
    } catch (error) {
      setResult(`❌ Write failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const testRead = async () => {
    setLoading(true)
    try {
      const testDoc = doc(db, "test", "test-doc")
      const docSnap = await getDoc(testDoc)

      if (docSnap.exists()) {
        const data = docSnap.data()
        setResult(`✅ Read successful! Data: ${JSON.stringify(data, null, 2)}`)
      } else {
        setResult("❌ No document found. Try writing data first.")
      }
    } catch (error) {
      setResult(`❌ Read failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const testConnection = async () => {
    setLoading(true)
    try {
      // Try to read from a collection (this tests the connection)
      const testCollection = collection(db, "test")
      await getDocs(testCollection)
      setResult("✅ Connection successful! Firestore is working.")
    } catch (error) {
      setResult(`❌ Connection failed: ${error.message}`)
      console.error("Firestore connection error:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Firestore Connection Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Test Data:</label>
            <Input value={testData} onChange={(e) => setTestData(e.target.value)} placeholder="Enter test data" />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={testConnection} disabled={loading}>
              Test Connection
            </Button>
            <Button onClick={testWrite} disabled={loading}>
              Test Write
            </Button>
            <Button onClick={testRead} disabled={loading}>
              Test Read
            </Button>
          </div>

          {result && (
            <div className="p-4 bg-gray-100 rounded-lg">
              <pre className="text-sm whitespace-pre-wrap">{result}</pre>
            </div>
          )}

          {loading && (
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-sm text-gray-600">Testing Firestore...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
