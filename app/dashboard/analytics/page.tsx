'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { 
  MessageCircle, 
  FileText, 
  Search, 
  TrendingUp, 
  Clock, 
  Users,
  Database,
  Zap
} from 'lucide-react'

// Mock data - in production this would come from your analytics API
const mockData = {
  totalQueries: 1247,
  totalDocuments: 42,
  avgResponseTime: 1.8,
  activeUsers: 8,
  dailyQueries: [
    { date: 'Mon', queries: 45 },
    { date: 'Tue', queries: 52 },
    { date: 'Wed', queries: 38 },
    { date: 'Thu', queries: 61 },
    { date: 'Fri', queries: 49 },
    { date: 'Sat', queries: 23 },
    { date: 'Sun', queries: 31 },
  ],
  queryTypes: [
    { name: 'Document Search', value: 45, color: '#8884d8' },
    { name: 'Knowledge Graph', value: 30, color: '#82ca9d' },
    { name: 'Hybrid Search', value: 25, color: '#ffc658' },
  ],
  topDocuments: [
    { name: 'Company Guidelines.pdf', queries: 124 },
    { name: 'Technical Specs.docx', queries: 89 },
    { name: 'Research Paper.pdf', queries: 67 },
    { name: 'User Manual.md', queries: 45 },
  ]
}

export default function AnalyticsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState(mockData)

  useEffect(() => {
    // Simulate data loading
    setTimeout(() => setIsLoading(false), 1000)
  }, [])

  const StatCard = ({ title, value, description, icon: Icon, trend }: {
    title: string
    value: string | number
    description: string
    icon: any
    trend?: number
  }) => (
    <Card>
      <CardContent className="p-3 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
          <div className="flex-1">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-center gap-1 sm:gap-2 mt-1">
              <p className="text-lg sm:text-2xl font-bold">{value}</p>
              {trend && (
                <Badge variant={trend > 0 ? 'default' : 'secondary'} className="text-xs">
                  {trend > 0 ? '+' : ''}{trend}%
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
          <div className="w-8 h-8 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 self-start sm:self-center">
            <Icon className="w-4 h-4 sm:w-6 sm:h-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3 sm:p-6">
                <Skeleton className="h-3 w-16 sm:h-4 sm:w-24 mb-2" />
                <Skeleton className="h-6 w-12 sm:h-8 sm:w-16 mb-2" />
                <Skeleton className="h-3 w-20 sm:w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-24 sm:h-5 sm:w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-48 sm:h-64 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-24 sm:h-5 sm:w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-48 sm:h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Mobile-Optimized Header */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 sm:p-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Analytics Dashboard</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Monitor your RAG system usage and performance
          </p>
        </div>
      </div>

      {/* Mobile-Optimized Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
          {/* Mobile-Optimized Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            <StatCard
              title="Total Queries"
              value={data.totalQueries.toLocaleString()}
              description="Last 30 days"
              icon={MessageCircle}
              trend={12}
            />
            <StatCard
              title="Documents"
              value={data.totalDocuments}
              description="In knowledge base"
              icon={FileText}
              trend={8}
            />
            <StatCard
              title="Avg Response Time"
              value={`${data.avgResponseTime}s`}
              description="Last 7 days"
              icon={Clock}
              trend={-5}
            />
            <StatCard
              title="Active Users"
              value={data.activeUsers}
              description="This week"
              icon={Users}
              trend={15}
            />
          </div>

          {/* Mobile-Optimized Charts Section */}
          <div className="grid grid-cols-1 gap-4 sm:gap-6">
            {/* Daily Queries Chart - Mobile Optimized */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                  Daily Query Volume
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.dailyQueries}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        className="text-muted-foreground" 
                        fontSize={10}
                        tick={{ fontSize: 10 }}
                        interval={0}
                      />
                      <YAxis 
                        className="text-muted-foreground" 
                        fontSize={10}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                      />
                      <Bar dataKey="queries" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Query Types Distribution - Mobile Optimized */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Search className="w-4 h-4 sm:w-5 sm:h-5" />
                  Query Types Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.queryTypes}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={60}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {data.queryTypes.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-3 sm:gap-6 mt-4">
                  {data.queryTypes.map((type, index) => (
                    <div key={index} className="flex items-center gap-1 sm:gap-2">
                      <div 
                        className="w-2 h-2 sm:w-3 sm:h-3 rounded-full" 
                        style={{ backgroundColor: type.color }}
                      />
                      <span className="text-xs sm:text-sm text-muted-foreground">{type.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mobile-Optimized Top Documents */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Database className="w-4 h-4 sm:w-5 sm:h-5" />
                Most Queried Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 sm:space-y-4">
                {data.topDocuments.map((doc, index) => (
                  <div key={index} className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                      </div>
                      <span className="font-medium text-sm sm:text-base truncate">{doc.name}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs sm:text-sm ml-2 flex-shrink-0">
                      {doc.queries} queries
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Mobile-Optimized System Performance */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
            <Card>
              <CardContent className="p-4 sm:p-6 text-center">
                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-4">
                  <Zap className="w-4 h-4 sm:w-6 sm:h-6 text-green-600" />
                </div>
                <h3 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">System Status</h3>
                <Badge variant="default" className="bg-green-600 text-xs sm:text-sm">Operational</Badge>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 sm:p-6 text-center">
                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-4">
                  <Database className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">Vector Index</h3>
                <Badge variant="secondary" className="text-xs sm:text-sm">98.2% Accuracy</Badge>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 sm:p-6 text-center">
                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-4">
                  <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">Performance</h3>
                <Badge variant="secondary" className="text-xs sm:text-sm">Excellent</Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}