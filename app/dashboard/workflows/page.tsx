'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Zap, 
  Clock, 
  Play, 
  Pause, 
  Settings,
  TrendingUp,
  AlertCircle
} from 'lucide-react'

// Demo mode: paywall removed

export default function WorkflowsPage() {
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-6">
        <div>
          <h1 className="text-2xl font-semibold">AI Workflows</h1>
          <p className="text-muted-foreground">
            Automated AI workflows for document processing and analysis
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">
          {/* Coming Soon Banner */}
          <Card className="mb-8 border-dashed border-2">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-3">AI Workflows (Coming soon)</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
                This feature is under development. Soon you'll be able to create automated workflows 
                that process documents, generate summaries, extract data, and perform complex analysis tasks.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                {/* Pricing Tiers */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-center">Free</CardTitle>
                    <Badge className="mx-auto">Active</Badge>
                  </CardHeader>
                  <CardContent className="text-center">
                    <div className="text-3xl font-bold mb-2">$0</div>
                    <p className="text-muted-foreground text-sm mb-4">Always free</p>
                    <ul className="text-sm space-y-1 text-left">
                      <li>• Basic workflows</li>
                      <li>• 100 executions/month</li>
                      <li>• Community support</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-center">Pro</CardTitle>
                    <p className="text-center text-sm text-muted-foreground">The Pro Plan</p>
                  </CardHeader>
                  <CardContent className="text-center">
                    <div className="text-3xl font-bold mb-2">
                      $5.99 
                      <span className="text-sm font-normal">/month</span>
                    </div>
                    <Badge variant="secondary" className="mb-4">Demo</Badge>
                    <Button className="w-full mb-4" disabled>Subscribe</Button>
                    <ul className="text-sm space-y-1 text-left">
                      <li>• Advanced workflows</li>
                      <li>• 1,000 executions/month</li>
                      <li>• Priority support</li>
                      <li>• Custom integrations</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-center">Pro Max</CardTitle>
                    <p className="text-center text-sm text-muted-foreground">
                      This will be the Pro Max Plan because we don't have enough plans.
                    </p>
                  </CardHeader>
                  <CardContent className="text-center">
                    <div className="text-3xl font-bold mb-2">
                      $8.99
                      <span className="text-sm font-normal">/month</span>
                    </div>
                    <Badge variant="secondary" className="mb-4">Demo</Badge>
                    <Button className="w-full mb-4" disabled>Subscribe</Button>
                    <ul className="text-sm space-y-1 text-left">
                      <li>• Enterprise workflows</li>
                      <li>• Unlimited executions</li>
                      <li>• Dedicated support</li>
                      <li>• Custom development</li>
                      <li>• API access</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Preview Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                  Document Processing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Automatically process new documents as they're uploaded
                </p>
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Coming Soon</Badge>
                  <Button variant="ghost" size="sm" disabled>
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  Smart Summaries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Generate intelligent summaries for document collections
                </p>
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Coming Soon</Badge>
                  <Button variant="ghost" size="sm" disabled>
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                  Alert Systems
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Get notified when specific patterns are detected
                </p>
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Coming Soon</Badge>
                  <Button variant="ghost" size="sm" disabled>
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}