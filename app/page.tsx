import { UrlShortenerForm } from "@/components/url-shortener-form"
import { RecentUrls } from "@/components/recent-urls"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Link, Zap, BarChart3, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Link className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">ShortLink</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-4">
            Transform your long URLs into short, shareable links with powerful analytics and custom domains.
          </p>
          <Link href="/dashboard">
            <Button variant="outline" className="mb-4 bg-transparent">
              <BarChart3 className="h-4 w-4 mr-2" />
              View Dashboard
            </Button>
          </Link>
        </div>

        {/* Main URL Shortener */}
        <div className="max-w-4xl mx-auto mb-16">
          <UrlShortenerForm />
        </div>

        {/* Features */}
        <div className="max-w-6xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-center mb-8 text-gray-900">Why Choose ShortLink?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <Zap className="h-8 w-8 text-blue-600 mb-2" />
                <CardTitle>Lightning Fast</CardTitle>
                <CardDescription>Generate short links instantly with our optimized infrastructure</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <BarChart3 className="h-8 w-8 text-green-600 mb-2" />
                <CardTitle>Detailed Analytics</CardTitle>
                <CardDescription>Track clicks, locations, and referrers with comprehensive analytics</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Shield className="h-8 w-8 text-purple-600 mb-2" />
                <CardTitle>Secure & Reliable</CardTitle>
                <CardDescription>Enterprise-grade security with 99.9% uptime guarantee</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>

        {/* Recent URLs */}
        <div className="max-w-4xl mx-auto">
          <RecentUrls />
        </div>
      </div>
    </div>
  )
}
