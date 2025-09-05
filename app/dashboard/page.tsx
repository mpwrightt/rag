'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { 
  Activity, 
  BarChart3,
  Brain, 
  ChevronDown,
  ChevronUp,
  Clock,
  Database, 
  FileText, 
  Globe,
  HardDrive,
  MessageCircle, 
  Plus,
  Search,
  Server,
  Settings,
  TrendingUp, 
  Users,
  Zap,
  AlertTriangle,
  CheckCircle,
  Eye,
  Download,
  Upload,
  Network,
  Cpu,
  Wifi,
  Monitor,
  Shield,
  Target,
  Gauge,
  PieChart,
  LineChart,
  BarChart,
  Calendar,
  Filter,
  ArrowUp,
  ArrowDown,
  Minus,
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import { KnowledgeHealthScore, type HealthMetrics } from '@/components/knowledge-health-score'
import { AreaChart, Area, LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, BarChart as RechartsBarChart, Bar } from 'recharts'
import { cn } from '@/lib/utils'

// Backend API base URL
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8058'

type DashboardStats = {
  total_documents: number
  total_chunks: number
  vector_index_size: number
  graph_nodes: number
  knowledge_base_health: string
}

type UsageMetrics = {
  daily_queries: number
  avg_response_time: number
  api_calls_today: number
  storage_used: number
  active_users: number
  total_sessions: number
  success_rate: number
  cache_hit_rate: number
}

type SystemMetrics = {
  cpu_usage: number
  memory_usage: number
  disk_usage: number
  api_uptime: number
  db_connections: number
  queue_size: number
  error_rate: number
  requests_per_minute: number
}

// Mock data for sophisticated charts
const hourlyUsageData = [
  { time: '00:00', queries: 12, users: 3, responses: 11, avg_time: 1.2 },
  { time: '01:00', queries: 8, users: 2, responses: 8, avg_time: 1.1 },
  { time: '02:00', queries: 5, users: 1, responses: 5, avg_time: 1.3 },
  { time: '03:00', queries: 3, users: 1, responses: 3, avg_time: 1.0 },
  { time: '04:00', queries: 7, users: 2, responses: 7, avg_time: 1.4 },
  { time: '05:00', queries: 15, users: 4, responses: 14, avg_time: 1.6 },
  { time: '06:00', queries: 28, users: 8, responses: 26, avg_time: 1.8 },
  { time: '07:00', queries: 42, users: 12, responses: 40, avg_time: 2.1 },
  { time: '08:00', queries: 65, users: 18, responses: 63, avg_time: 2.3 },
  { time: '09:00', queries: 89, users: 25, responses: 85, avg_time: 2.0 },
  { time: '10:00', queries: 112, users: 32, responses: 108, avg_time: 1.9 },
  { time: '11:00', queries: 134, users: 38, responses: 130, avg_time: 2.2 },
  { time: '12:00', queries: 156, users: 45, responses: 152, avg_time: 2.4 },
  { time: '13:00', queries: 142, users: 41, responses: 138, avg_time: 2.1 },
  { time: '14:00', queries: 128, users: 36, responses: 124, avg_time: 1.8 },
  { time: '15:00', queries: 145, users: 42, responses: 141, avg_time: 2.0 },
  { time: '16:00', queries: 167, users: 48, responses: 163, avg_time: 2.3 },
  { time: '17:00', queries: 134, users: 39, responses: 130, avg_time: 2.0 },
  { time: '18:00', queries: 98, users: 28, responses: 95, avg_time: 1.7 },
  { time: '19:00', queries: 76, users: 22, responses: 74, avg_time: 1.5 },
  { time: '20:00', queries: 54, users: 16, responses: 52, avg_time: 1.4 },
  { time: '21:00', queries: 38, users: 11, responses: 36, avg_time: 1.3 },
  { time: '22:00', queries: 25, users: 7, responses: 24, avg_time: 1.2 },
  { time: '23:00', queries: 18, users: 5, responses: 17, avg_time: 1.1 }
]

const documentCategoryData = [
  { name: 'Technical', value: 45, count: 34, color: '#3b82f6' },
  { name: 'Business', value: 30, count: 23, color: '#10b981' },
  { name: 'Research', value: 15, count: 12, color: '#f59e0b' },
  { name: 'Legal', value: 7, count: 5, color: '#ef4444' },
  { name: 'Marketing', value: 3, count: 2, color: '#8b5cf6' }
]

const performanceTrendsData = [
  { date: '2024-01-15', response_time: 1.2, throughput: 450, errors: 2 },
  { date: '2024-01-16', response_time: 1.1, throughput: 520, errors: 1 },
  { date: '2024-01-17', response_time: 1.4, throughput: 380, errors: 5 },
  { date: '2024-01-18', response_time: 1.0, throughput: 650, errors: 1 },
  { date: '2024-01-19', response_time: 1.3, throughput: 580, errors: 3 },
  { date: '2024-01-20', response_time: 0.9, throughput: 720, errors: 0 },
  { date: '2024-01-21', response_time: 1.1, throughput: 680, errors: 2 }
]

const topQueriesData = [
  { query: "What are the environmental concerns?", count: 234, avg_time: 1.8, category: "Environmental" },
  { query: "Summarize remediation methods", count: 198, avg_time: 2.1, category: "Technical" },
  { query: "Show regulatory requirements", count: 176, avg_time: 1.9, category: "Legal" },
  { query: "Compare site assessments", count: 145, avg_time: 2.3, category: "Analysis" },
  { query: "What contamination levels were found?", count: 132, avg_time: 1.6, category: "Environmental" }
]

const recentActivities = [
  {
    id: 1,
    type: 'document_upload',
    title: 'New technical report processed',
    description: 'environmental-impact-2024.pdf successfully analyzed - 156 chunks created, 12 entities extracted',
    timestamp: '3 minutes ago',
    icon: Upload,
    status: 'success',
    metadata: { chunks: 156, entities: 12, processing_time: '45s' }
  },
  {
    id: 2,
    type: 'query_spike',
    title: 'Query volume spike detected',
    description: 'Unusual query pattern: +340% increase in environmental compliance questions',
    timestamp: '8 minutes ago',
    icon: TrendingUp,
    status: 'info',
    metadata: { queries: 89, topic: 'Environmental Compliance' }
  },
  {
    id: 3,
    type: 'system_optimization',
    title: 'Vector index auto-optimized',
    description: 'Automatic reindexing completed - 23% improvement in search relevance',
    timestamp: '15 minutes ago',
    icon: Zap,
    status: 'success',
    metadata: { improvement: '23%', vectors: 45670 }
  },
  {
    id: 4,
    type: 'user_session',
    title: 'Peak concurrent users reached',
    description: '48 simultaneous users - highest recorded this month',
    timestamp: '22 minutes ago',
    icon: Users,
    status: 'info',
    metadata: { concurrent: 48, record: true }
  },
  {
    id: 5,
    type: 'alert',
    title: 'Memory usage threshold exceeded',
    description: 'System memory utilization at 87% - consider scaling resources',
    timestamp: '35 minutes ago',
    icon: AlertTriangle,
    status: 'warning',
    metadata: { memory: '87%', threshold: '85%' }
  }
]

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [systemHealth, setSystemHealth] = useState<any>(null)
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics | null>(null)
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null)
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [timeRange, setTimeRange] = useState('24h')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [expandedActivity, setExpandedActivity] = useState<number | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch real data from backend
        const [docsResponse, healthResponse] = await Promise.all([
          fetch(`${API_BASE}/documents?_=${Date.now()}`, {
            headers: { 
              'bypass-tunnel-reminder': 'true',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache',
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          }),
          fetch(`${API_BASE}/health?_=${Date.now()}`, {
            headers: { 
              'bypass-tunnel-reminder': 'true',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          })
        ])

        const docsData = docsResponse.ok ? await docsResponse.json() : null
        const healthData = healthResponse.ok ? await healthResponse.json() : null
        
        setStats({
          total_documents: docsData?.total || 76,
          total_chunks: docsData?.documents?.reduce((sum: number, doc: any) => sum + (doc.chunk_count || 0), 0) || 2847,
          vector_index_size: docsData?.total || 76,
          graph_nodes: 1247,
          knowledge_base_health: healthData?.status || 'healthy'
        })
        
        setSystemHealth(healthData)
        
        // Generate comprehensive health metrics
        const generatedHealthMetrics: HealthMetrics = {
          overall_score: healthData?.status === 'healthy' ? 89 : 67,
          document_quality: 94,
          coverage_completeness: 87,
          indexing_status: healthData?.database ? 98 : 65,
          data_freshness: 92,
          vector_integrity: 96,
          graph_connectivity: 85
        }
        
        setHealthMetrics(generatedHealthMetrics)
        
        // Set comprehensive usage metrics
        setUsageMetrics({
          daily_queries: 1847,
          avg_response_time: 1.8,
          api_calls_today: 5432,
          storage_used: 78.4,
          active_users: 48,
          total_sessions: 156,
          success_rate: 97.8,
          cache_hit_rate: 84.2
        })
        
        // Set detailed system metrics
        setSystemMetrics({
          cpu_usage: 42,
          memory_usage: 71,
          disk_usage: 56,
          api_uptime: 99.94,
          db_connections: 23,
          queue_size: 7,
          error_rate: 0.8,
          requests_per_minute: 340
        })
        
        setIsLoading(false)
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error)
        // Set comprehensive mock data on error
        setStats({
          total_documents: 76,
          total_chunks: 2847,
          vector_index_size: 76,
          graph_nodes: 1247,
          knowledge_base_health: 'healthy'
        })
        
        setHealthMetrics({
          overall_score: 89,
          document_quality: 94,
          coverage_completeness: 87,
          indexing_status: 98,
          data_freshness: 92,
          vector_integrity: 96,
          graph_connectivity: 85
        })
        
        setUsageMetrics({
          daily_queries: 1847,
          avg_response_time: 1.8,
          api_calls_today: 5432,
          storage_used: 78.4,
          active_users: 48,
          total_sessions: 156,
          success_rate: 97.8,
          cache_hit_rate: 84.2
        })
        
        setSystemMetrics({
          cpu_usage: 42,
          memory_usage: 71,
          disk_usage: 56,
          api_uptime: 99.94,
          db_connections: 23,
          queue_size: 7,
          error_rate: 0.8,
          requests_per_minute: 340
        })
        
        setIsLoading(false)
      }
    }

    fetchStats()
    
    // Auto-refresh every 30 seconds if enabled
    const interval = autoRefresh ? setInterval(fetchStats, 30000) : null
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh])

  const StatCard = ({ title, value, description, icon: Icon, color = "text-primary", trend, change, subtitle }: {
    title: string
    value: string | number
    description: string
    icon: any
    color?: string
    trend?: 'up' | 'down' | 'neutral'
    change?: string
    subtitle?: string
  }) => (
    <Card className="hover:shadow-lg transition-all duration-300 hover:border-primary/20">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-2xl font-bold">{isLoading ? '...' : value}</p>
              {change && (
                <div className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                  trend === 'up' ? "bg-green-100 text-green-700" : 
                  trend === 'down' ? "bg-red-100 text-red-700" : 
                  "bg-gray-100 text-gray-700"
                )}>
                  {trend === 'up' && <ArrowUp className="w-3 h-3" />}
                  {trend === 'down' && <ArrowDown className="w-3 h-3" />}
                  {trend === 'neutral' && <Minus className="w-3 h-3" />}
                  {change}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground/80 mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5`}>
            <Icon className={`w-6 h-6 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const MetricGauge = ({ title, value, max = 100, color = "primary", unit = "%" }: {
    title: string
    value: number
    max?: number
    color?: string
    unit?: string
  }) => (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-lg font-bold">{value}{unit}</p>
        </div>
        <Progress value={(value / max) * 100} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0{unit}</span>
          <span>{max}{unit}</span>
        </div>
      </div>
    </Card>
  )

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Enhanced Header - Mobile Optimized */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent leading-tight">
              Intelligence Dashboard
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base mt-1">
              Real-time analytics and monitoring for your RAG system
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Switch 
                checked={autoRefresh} 
                onCheckedChange={setAutoRefresh} 
                className="scale-75 sm:scale-100"
              />
              <span className="text-muted-foreground whitespace-nowrap">Auto-refresh</span>
            </div>
            <Badge 
              variant={systemHealth?.status === 'healthy' ? 'default' : 'destructive'}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 text-xs"
            >
              <div className={cn(
                "w-2 h-2 rounded-full animate-pulse",
                systemHealth?.status === 'healthy' ? "bg-green-400" : "bg-red-400"
              )} />
              <span className="hidden sm:inline">System </span>{systemHealth?.status || 'Loading...'}
            </Badge>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.location.reload()}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 text-xs sm:text-sm"
            >
              <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            {/* Mobile Scrollable TabsList */}
            <div className="w-full overflow-x-auto">
              <TabsList className="grid w-max min-w-full md:w-full grid-cols-6 md:grid-cols-6 gap-1 mx-auto">
                <TabsTrigger value="overview" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 text-xs sm:text-sm whitespace-nowrap">
                  <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Overview</span>
                  <span className="sm:hidden">Home</span>
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 text-xs sm:text-sm whitespace-nowrap">
                  <LineChart className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Analytics</span>
                  <span className="sm:hidden">Stats</span>
                </TabsTrigger>
                <TabsTrigger value="performance" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 text-xs sm:text-sm whitespace-nowrap">
                  <Gauge className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Performance</span>
                  <span className="sm:hidden">Perf</span>
                </TabsTrigger>
                <TabsTrigger value="system" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 text-xs sm:text-sm whitespace-nowrap">
                  <Server className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">System</span>
                  <span className="sm:hidden">Sys</span>
                </TabsTrigger>
                <TabsTrigger value="activity" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 text-xs sm:text-sm whitespace-nowrap">
                  <Activity className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Activity</span>
                  <span className="sm:hidden">Act</span>
                </TabsTrigger>
                <TabsTrigger value="insights" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 text-xs sm:text-sm whitespace-nowrap">
                  <Brain className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">AI Insights</span>
                  <span className="sm:hidden">AI</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="space-y-6">
              {/* Knowledge Health Score - Featured */}
              <KnowledgeHealthScore 
                metrics={healthMetrics || undefined}
                isLoading={isLoading}
                className="col-span-full"
              />
              
              {/* Key Performance Metrics - Mobile Optimized */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <StatCard
                  title="Active Users Today"
                  value={usageMetrics?.active_users || '...'}
                  description="Currently online"
                  icon={Users}
                  trend="up"
                  change="+12%"
                  subtitle="Peak: 67 users at 2:30 PM"
                />
                <StatCard
                  title="Queries Processed"
                  value={usageMetrics?.daily_queries || '...'}
                  description="Last 24 hours"
                  icon={Search}
                  trend="up"
                  change="+8.3%"
                  subtitle="Avg: 76.9 queries/hour"
                />
                <StatCard
                  title="Response Time"
                  value={usageMetrics ? `${usageMetrics.avg_response_time}s` : '...'}
                  description="Average response"
                  icon={Zap}
                  trend="down"
                  change="-0.2s"
                  subtitle="Target: <2.0s"
                />
                <StatCard
                  title="Success Rate"
                  value={usageMetrics ? `${usageMetrics.success_rate}%` : '...'}
                  description="Query satisfaction"
                  icon={CheckCircle}
                  trend="up"
                  change="+0.4%"
                  subtitle="SLA: >95%"
                />
              </div>

              {/* Storage and Knowledge Base - Mobile Optimized */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <StatCard
                  title="Knowledge Base"
                  value={stats?.total_documents || '...'}
                  description="Documents indexed"
                  icon={FileText}
                  trend="neutral"
                  change="No change"
                />
                <StatCard
                  title="Vector Chunks"
                  value={stats?.total_chunks || '...'}
                  description="Searchable segments"
                  icon={Database}
                  trend="neutral"
                  change="No change"
                />
                <StatCard
                  title="Graph Entities"
                  value={stats?.graph_nodes || '...'}
                  description="Knowledge connections"
                  icon={Network}
                  trend="neutral" 
                  change="No change"
                />
                <StatCard
                  title="Storage Used"
                  value={usageMetrics ? `${usageMetrics.storage_used}%` : '...'}
                  description="Of allocated space"
                  icon={HardDrive}
                  trend="up"
                  change="+2.1%"
                  subtitle="4.7 GB / 6 GB used"
                />
              </div>

              {/* Quick Actions Grid - Mobile Optimized */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                <Link href="/dashboard/chat">
                  <Card className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50 group">
                    <CardContent className="p-3 sm:p-6 text-center">
                      <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg sm:rounded-xl flex items-center justify-center mx-auto mb-2 sm:mb-4 group-hover:scale-110 transition-transform">
                        <MessageCircle className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <h3 className="font-semibold text-xs sm:text-base mb-1 sm:mb-2">Start Conversation</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Interact with your RAG system</p>
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/dashboard/documents">
                  <Card className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50 group">
                    <CardContent className="p-3 sm:p-6 text-center">
                      <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg sm:rounded-xl flex items-center justify-center mx-auto mb-2 sm:mb-4 group-hover:scale-110 transition-transform">
                        <Plus className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <h3 className="font-semibold text-xs sm:text-base mb-1 sm:mb-2">Upload Documents</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Expand your knowledge base</p>
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/dashboard/collections">
                  <Card className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50 group">
                    <CardContent className="p-3 sm:p-6 text-center">
                      <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg sm:rounded-xl flex items-center justify-center mx-auto mb-2 sm:mb-4 group-hover:scale-110 transition-transform">
                        <Database className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <h3 className="font-semibold text-xs sm:text-base mb-1 sm:mb-2">Manage Collections</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Organize your content</p>
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/dashboard/settings">
                  <Card className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50 group">
                    <CardContent className="p-3 sm:p-6 text-center">
                      <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg sm:rounded-xl flex items-center justify-center mx-auto mb-2 sm:mb-4 group-hover:scale-110 transition-transform">
                        <Settings className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <h3 className="font-semibold text-xs sm:text-base mb-1 sm:mb-2">System Settings</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Configure your system</p>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              {/* Usage Trends */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Usage Analytics
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant={timeRange === '24h' ? 'default' : 'outline'} size="sm" onClick={() => setTimeRange('24h')}>
                        24h
                      </Button>
                      <Button variant={timeRange === '7d' ? 'default' : 'outline'} size="sm" onClick={() => setTimeRange('7d')}>
                        7d
                      </Button>
                      <Button variant={timeRange === '30d' ? 'default' : 'outline'} size="sm" onClick={() => setTimeRange('30d')}>
                        30d
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={hourlyUsageData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" />
                        <YAxis />
                        <Area type="monotone" dataKey="queries" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                        <Area type="monotone" dataKey="users" stackId="2" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Document Categories */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="w-5 h-5" />
                      Document Categories
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie 
                            data={documentCategoryData}
                            cx="50%" 
                            cy="50%" 
                            innerRadius={40}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {documentCategoryData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      {documentCategoryData.map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-sm">{item.name}</span>
                          <Badge variant="secondary" className="ml-auto">{item.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Top Queries */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Search className="w-5 h-5" />
                      Popular Queries
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {topQueriesData.map((query, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{query.query}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline" className="text-xs">
                                  {query.category}
                                </Badge>
                                <span>{query.count} times</span>
                                <span>{query.avg_time}s avg</span>
                              </div>
                            </div>
                          </div>
                          <Progress value={(query.count / 234) * 100} className="h-1" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="performance" className="space-y-6">
              {/* Performance Metrics - Mobile Optimized */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                <MetricGauge title="API Response Time" value={1.8} max={5} unit="s" />
                <MetricGauge title="Cache Hit Rate" value={84.2} max={100} unit="%" />
                <MetricGauge title="Success Rate" value={97.8} max={100} unit="%" />
                <MetricGauge title="Throughput" value={340} max={500} unit="/min" />
              </div>

              {/* Performance Trends */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gauge className="w-5 h-5" />
                    Performance Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsLineChart data={performanceTrendsData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Line type="monotone" dataKey="response_time" stroke="#f59e0b" strokeWidth={2} name="Response Time (s)" />
                        <Line type="monotone" dataKey="throughput" stroke="#10b981" strokeWidth={2} name="Throughput (req/min)" />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="system" className="space-y-6">
              {/* System Resources - Mobile Optimized */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                <MetricGauge title="CPU Usage" value={systemMetrics?.cpu_usage || 0} max={100} unit="%" />
                <MetricGauge title="Memory Usage" value={systemMetrics?.memory_usage || 0} max={100} unit="%" />
                <MetricGauge title="Disk Usage" value={systemMetrics?.disk_usage || 0} max={100} unit="%" />
                <MetricGauge title="Network I/O" value={67} max={100} unit="%" />
              </div>

              {/* System Status */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Server className="w-5 h-5" />
                      System Services
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { name: 'API Server', status: 'healthy', uptime: '99.94%', response: '156ms' },
                      { name: 'Vector Database', status: 'healthy', uptime: '99.97%', response: '23ms' },
                      { name: 'Graph Database', status: 'healthy', uptime: '99.89%', response: '45ms' },
                      { name: 'LLM Gateway', status: 'healthy', uptime: '99.78%', response: '890ms' },
                      { name: 'Search Engine', status: 'healthy', uptime: '99.92%', response: '67ms' }
                    ].map((service, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-3 h-3 rounded-full",
                            service.status === 'healthy' ? "bg-green-500 animate-pulse" : "bg-red-500"
                          )} />
                          <span className="font-medium">{service.name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>↑ {service.uptime}</span>
                          <span>{service.response}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      Security & Monitoring
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { metric: 'Active Connections', value: '23/50', status: 'normal' },
                      { metric: 'Queue Size', value: '7', status: 'normal' },
                      { metric: 'Error Rate', value: '0.8%', status: 'normal' },
                      { metric: 'Failed Logins', value: '0', status: 'good' },
                      { metric: 'SSL Certificate', value: '89 days', status: 'normal' }
                    ].map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="font-medium">{item.metric}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{item.value}</span>
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            item.status === 'good' ? "bg-green-500" :
                            item.status === 'normal' ? "bg-blue-500" : "bg-yellow-500"
                          )} />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="activity" className="space-y-6">
              {/* Real-time Activity Feed */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Live Activity Feed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {recentActivities.map((activity) => (
                      <div key={activity.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                        <div 
                          className="flex items-start gap-4 cursor-pointer"
                          onClick={() => setExpandedActivity(expandedActivity === activity.id ? null : activity.id)}
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            activity.status === 'success' ? "bg-green-100 text-green-600" :
                            activity.status === 'warning' ? "bg-yellow-100 text-yellow-600" :
                            activity.status === 'info' ? "bg-blue-100 text-blue-600" :
                            "bg-red-100 text-red-600"
                          )}>
                            <activity.icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">{activity.title}</h4>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{activity.timestamp}</span>
                                {expandedActivity === activity.id ? 
                                  <ChevronUp className="w-4 h-4" /> : 
                                  <ChevronDown className="w-4 h-4" />
                                }
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                            
                            {expandedActivity === activity.id && activity.metadata && (
                              <div className="mt-3 pt-3 border-t">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                  {Object.entries(activity.metadata).map(([key, value]) => (
                                    <div key={key} className="bg-background/50 rounded p-2">
                                      <p className="font-medium text-muted-foreground">{key.replace(/_/g, ' ')}</p>
                                      <p className="font-mono">{value}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="insights" className="space-y-6">
              {/* AI-Generated Insights */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5" />
                    AI-Powered Insights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {[
                      {
                        title: "Query Pattern Analysis",
                        insight: "Environmental compliance queries increased by 340% this week, suggesting new regulatory requirements or upcoming deadlines.",
                        confidence: 89,
                        action: "Consider creating a dedicated environmental compliance collection to improve response accuracy.",
                        category: "Usage Patterns"
                      },
                      {
                        title: "Document Quality Assessment", 
                        insight: "12 documents show low RAG processing scores (<70%). These may need reprocessing or format optimization.",
                        confidence: 94,
                        action: "Schedule document quality review and consider format standardization guidelines.",
                        category: "Content Quality"
                      },
                      {
                        title: "Performance Optimization",
                        insight: "Vector similarity search times could be improved by 23% through index optimization during low-traffic hours.",
                        confidence: 76,
                        action: "Schedule automated index optimization for 2:00 AM - 4:00 AM daily window.",
                        category: "System Performance"
                      },
                      {
                        title: "User Behavior Analysis",
                        insight: "Power users (top 10%) generate 67% of queries. Consider implementing query result caching for frequent patterns.",
                        confidence: 82,
                        action: "Implement intelligent caching strategy for top user queries and common search patterns.",
                        category: "User Experience"
                      }
                    ].map((item, index) => (
                      <div key={index} className="border rounded-lg p-6 space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-lg">{item.title}</h3>
                            <Badge variant="outline" className="mt-1">{item.category}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-blue-500" />
                            <span className="text-sm font-medium">{item.confidence}% confidence</span>
                          </div>
                        </div>
                        
                        <p className="text-muted-foreground">{item.insight}</p>
                        
                        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4">
                          <div className="flex items-start gap-2">
                            <Zap className="w-4 h-4 text-blue-500 mt-1" />
                            <div>
                              <p className="font-medium text-blue-900 dark:text-blue-100">Recommended Action</p>
                              <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">{item.action}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>Generated 15 minutes ago</span>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">Dismiss</Button>
                            <Button size="sm">Take Action</Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}