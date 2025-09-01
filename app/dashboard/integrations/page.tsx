'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Zap, 
  Plus, 
  Settings, 
  Search,
  Check,
  X,
  ExternalLink,
  RefreshCw as Sync,
  AlertTriangle,
  Clock,
  TrendingUp,
  Database,
  Cloud,
  Globe,
  Smartphone,
  Mail,
  Calendar,
  FileText,
  Users,
  Brain,
  BarChart3,
  Shield,
  Key,
  Webhook,
  Code,
  Download,
  Upload,
  RefreshCw,
  PlayCircle,
  StopCircle,
  ChevronRight,
  Activity,
  Layers
} from 'lucide-react'
import { cn } from '@/lib/utils'

type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'configuring' | 'syncing'
type IntegrationType = 'storage' | 'productivity' | 'communication' | 'ai' | 'analytics' | 'security' | 'database'

type Integration = {
  id: string
  name: string
  description: string
  type: IntegrationType
  status: IntegrationStatus
  icon: React.ComponentType<any>
  color: string
  features: string[]
  lastSync?: string
  syncedItems?: number
  apiCalls?: number
  monthlyLimit?: number
  webhookUrl?: string
  settings?: Record<string, any>
  documentation?: string
  pricing?: string
  setupComplexity: 'easy' | 'medium' | 'advanced'
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | IntegrationType>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | IntegrationStatus>('all')
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('browse')

  // Mock integrations data
  const mockIntegrations: Integration[] = [
    {
      id: 'google-drive',
      name: 'Google Drive',
      description: 'Sync documents from your Google Drive to automatically build your knowledge base',
      type: 'storage',
      status: 'connected',
      icon: Cloud,
      color: 'bg-blue-100 text-blue-600',
      features: ['Auto-sync documents', 'Real-time updates', 'Selective folder sync', 'Version control'],
      lastSync: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      syncedItems: 247,
      apiCalls: 1243,
      monthlyLimit: 10000,
      setupComplexity: 'easy'
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Get AI-powered insights and document summaries directly in your Slack channels',
      type: 'communication',
      status: 'connected',
      icon: Users,
      color: 'bg-purple-100 text-purple-600',
      features: ['Channel notifications', 'Document search', 'AI summaries', 'Team collaboration'],
      lastSync: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      syncedItems: 52,
      apiCalls: 876,
      monthlyLimit: 5000,
      setupComplexity: 'medium'
    },
    {
      id: 'notion',
      name: 'Notion',
      description: 'Import your Notion databases and pages to enhance your knowledge base',
      type: 'productivity',
      status: 'configuring',
      icon: FileText,
      color: 'bg-gray-100 text-gray-600',
      features: ['Database sync', 'Page import', 'Nested content', 'Rich formatting'],
      setupComplexity: 'medium'
    },
    {
      id: 'openai',
      name: 'OpenAI GPT',
      description: 'Enhanced AI capabilities with GPT models for better document analysis',
      type: 'ai',
      status: 'connected',
      icon: Brain,
      color: 'bg-green-100 text-green-600',
      features: ['GPT-4 integration', 'Custom prompts', 'Token optimization', 'Model switching'],
      apiCalls: 2341,
      monthlyLimit: 50000,
      setupComplexity: 'advanced'
    },
    {
      id: 'zapier',
      name: 'Zapier',
      description: 'Automate workflows with 5000+ apps using Zapier integrations',
      type: 'productivity',
      status: 'disconnected',
      icon: Zap,
      color: 'bg-orange-100 text-orange-600',
      features: ['5000+ app connections', 'Workflow automation', 'Trigger events', 'Data transformation'],
      setupComplexity: 'advanced'
    },
    {
      id: 'dropbox',
      name: 'Dropbox',
      description: 'Access and sync files from your Dropbox account automatically',
      type: 'storage',
      status: 'error',
      icon: Database,
      color: 'bg-blue-100 text-blue-600',
      features: ['File sync', 'Shared folders', 'Version history', 'Selective sync'],
      setupComplexity: 'easy'
    },
    {
      id: 'github',
      name: 'GitHub',
      description: 'Analyze code repositories, documentation, and issues for technical knowledge',
      type: 'productivity',
      status: 'disconnected',
      icon: Code,
      color: 'bg-gray-100 text-gray-600',
      features: ['Repository sync', 'Code analysis', 'Documentation import', 'Issue tracking'],
      setupComplexity: 'advanced'
    },
    {
      id: 'confluence',
      name: 'Confluence',
      description: 'Import team knowledge and documentation from Atlassian Confluence',
      type: 'productivity',
      status: 'disconnected',
      icon: Globe,
      color: 'bg-blue-100 text-blue-600',
      features: ['Page import', 'Space sync', 'Comments integration', 'Attachment handling'],
      setupComplexity: 'medium'
    },
    {
      id: 'microsoft-365',
      name: 'Microsoft 365',
      description: 'Connect to OneDrive, SharePoint, and Teams for comprehensive document access',
      type: 'productivity',
      status: 'disconnected',
      icon: Cloud,
      color: 'bg-blue-100 text-blue-600',
      features: ['OneDrive sync', 'SharePoint integration', 'Teams messages', 'Office documents'],
      setupComplexity: 'medium'
    },
    {
      id: 'webhooks',
      name: 'Custom Webhooks',
      description: 'Create custom integrations with webhook endpoints for real-time updates',
      type: 'ai',
      status: 'connected',
      icon: Webhook,
      color: 'bg-indigo-100 text-indigo-600',
      features: ['Custom endpoints', 'Real-time events', 'Payload customization', 'Authentication'],
      webhookUrl: 'https://api.datadiver.ai/webhooks/custom',
      setupComplexity: 'advanced'
    }
  ]

  useEffect(() => {
    setIntegrations(mockIntegrations)
  }, [])

  const getStatusIcon = (status: IntegrationStatus) => {
    switch (status) {
      case 'connected': return <Check className="w-4 h-4 text-green-600" />
      case 'disconnected': return <X className="w-4 h-4 text-gray-400" />
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-600" />
      case 'configuring': return <Settings className="w-4 h-4 text-yellow-600" />
      case 'syncing': return <Sync className="w-4 h-4 text-blue-600 animate-spin" />
      default: return <X className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: IntegrationStatus) => {
    const styles = {
      connected: 'bg-green-100 text-green-800 border-green-200',
      disconnected: 'bg-gray-100 text-gray-600 border-gray-200',
      error: 'bg-red-100 text-red-800 border-red-200',
      configuring: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      syncing: 'bg-blue-100 text-blue-800 border-blue-200'
    }
    return styles[status] || styles.disconnected
  }

  const formatLastSync = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diff = now.getTime() - time.getTime()
    
    if (diff < 60 * 1000) return 'Just now'
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}m ago`
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}h ago`
    
    return time.toLocaleDateString()
  }

  const filteredIntegrations = integrations.filter(integration => {
    const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         integration.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = filterType === 'all' || integration.type === filterType
    const matchesStatus = filterStatus === 'all' || integration.status === filterStatus
    return matchesSearch && matchesType && matchesStatus
  })

  const connectedCount = integrations.filter(i => i.status === 'connected').length
  const availableCount = integrations.filter(i => i.status === 'disconnected').length
  const totalApiCalls = integrations
    .filter(i => i.apiCalls)
    .reduce((sum, i) => sum + (i.apiCalls || 0), 0)

  const toggleIntegration = (id: string) => {
    setIntegrations(prev => prev.map(integration => 
      integration.id === id 
        ? { 
          ...integration, 
          status: integration.status === 'connected' ? 'disconnected' : 'connected' 
        }
        : integration
    ))
  }

  const configureIntegration = (integration: Integration) => {
    setSelectedIntegration(integration)
    setIsConfigModalOpen(true)
  }

  const syncIntegration = (id: string) => {
    setIntegrations(prev => prev.map(integration => 
      integration.id === id 
        ? { 
          ...integration, 
          status: 'syncing',
          lastSync: new Date().toISOString()
        }
        : integration
    ))

    // Simulate sync completion
    setTimeout(() => {
      setIntegrations(prev => prev.map(integration => 
        integration.id === id 
          ? { 
            ...integration, 
            status: 'connected',
            syncedItems: (integration.syncedItems || 0) + Math.floor(Math.random() * 10)
          }
          : integration
      ))
    }, 2000)
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Layers className="w-6 h-6 text-primary" />
              Integrations Marketplace
            </h1>
            <p className="text-muted-foreground">
              Connect your favorite tools and services to enhance your RAG workflow
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="px-3 py-1">
              {connectedCount} active
            </Badge>
            <Badge variant="outline" className="px-3 py-1">
              {availableCount} available
            </Badge>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <select 
            className="px-3 py-2 border rounded-lg bg-background"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
          >
            <option value="all">All Types</option>
            <option value="storage">Storage</option>
            <option value="productivity">Productivity</option>
            <option value="communication">Communication</option>
            <option value="ai">AI & ML</option>
            <option value="analytics">Analytics</option>
            <option value="security">Security</option>
          </select>
          <select 
            className="px-3 py-2 border rounded-lg bg-background"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="all">All Status</option>
            <option value="connected">Connected</option>
            <option value="disconnected">Available</option>
            <option value="error">Needs Attention</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="browse">
                Browse & Connect ({filteredIntegrations.length})
              </TabsTrigger>
              <TabsTrigger value="active">
                Active Integrations ({connectedCount})
              </TabsTrigger>
              <TabsTrigger value="analytics">
                Usage Analytics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="browse" className="mt-6">
              {/* Integration Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredIntegrations.map((integration) => {
                  const IconComponent = integration.icon
                  return (
                    <Card 
                      key={integration.id} 
                      className="hover:shadow-lg transition-all duration-200 hover:border-primary/20 group"
                    >
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", integration.color)}>
                              <IconComponent className="w-5 h-5" />
                            </div>
                            <div>
                              <CardTitle className="text-base">{integration.name}</CardTitle>
                              <Badge className={cn("text-xs mt-1", getStatusBadge(integration.status))}>
                                <div className="flex items-center gap-1">
                                  {getStatusIcon(integration.status)}
                                  {integration.status}
                                </div>
                              </Badge>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {integration.setupComplexity === 'easy' && '🟢'}
                            {integration.setupComplexity === 'medium' && '🟡'}
                            {integration.setupComplexity === 'advanced' && '🔴'}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {integration.description}
                        </p>

                        {/* Features */}
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Key Features
                          </p>
                          <div className="grid grid-cols-1 gap-1">
                            {integration.features.slice(0, 3).map((feature, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs">
                                <div className="w-1 h-1 bg-primary rounded-full" />
                                {feature}
                              </div>
                            ))}
                            {integration.features.length > 3 && (
                              <div className="text-xs text-muted-foreground">
                                +{integration.features.length - 3} more features
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Stats */}
                        {integration.status === 'connected' && (
                          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                            {integration.syncedItems && (
                              <div className="text-center">
                                <p className="text-lg font-semibold">{integration.syncedItems}</p>
                                <p className="text-xs text-muted-foreground">Items synced</p>
                              </div>
                            )}
                            {integration.lastSync && (
                              <div className="text-center">
                                <p className="text-xs font-medium">{formatLastSync(integration.lastSync)}</p>
                                <p className="text-xs text-muted-foreground">Last sync</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-3 border-t">
                          {integration.status === 'connected' ? (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="flex-1"
                                onClick={() => configureIntegration(integration)}
                              >
                                <Settings className="w-4 h-4 mr-1" />
                                Configure
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => syncIntegration(integration.id)}
                                disabled={integration.status === 'syncing' || integration.status === 'connected'}
                              >
                                <RefreshCw className={cn("w-4 h-4", integration.status === 'syncing' ? "animate-spin" : "")} />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => toggleIntegration(integration.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <StopCircle className="w-4 h-4" />
                              </Button>
                            </>
                          ) : integration.status === 'configuring' ? (
                            <Button 
                              size="sm" 
                              className="flex-1"
                              onClick={() => configureIntegration(integration)}
                            >
                              <Settings className="w-4 h-4 mr-1" />
                              Complete Setup
                            </Button>
                          ) : integration.status === 'error' ? (
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              className="flex-1"
                              onClick={() => configureIntegration(integration)}
                            >
                              <AlertTriangle className="w-4 h-4 mr-1" />
                              Fix Issues
                            </Button>
                          ) : (
                            <Button 
                              size="sm" 
                              className="flex-1"
                              onClick={() => toggleIntegration(integration.id)}
                            >
                              <PlayCircle className="w-4 h-4 mr-1" />
                              Connect
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </TabsContent>

            <TabsContent value="active" className="mt-6">
              <div className="space-y-6">
                {integrations.filter(i => i.status === 'connected').map((integration) => {
                  const IconComponent = integration.icon
                  return (
                    <Card key={integration.id}>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", integration.color)}>
                              <IconComponent className="w-6 h-6" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{integration.name}</h3>
                              <p className="text-sm text-muted-foreground">{integration.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {integration.apiCalls && integration.monthlyLimit && (
                              <div className="text-right">
                                <p className="text-sm font-medium">
                                  {integration.apiCalls.toLocaleString()} / {integration.monthlyLimit.toLocaleString()}
                                </p>
                                <Progress 
                                  value={(integration.apiCalls / integration.monthlyLimit) * 100} 
                                  className="w-20 h-2 mt-1"
                                />
                                <p className="text-xs text-muted-foreground">API calls this month</p>
                              </div>
                            )}
                            <Button size="sm" variant="outline" onClick={() => configureIntegration(integration)}>
                              <Settings className="w-4 h-4 mr-1" />
                              Settings
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="w-5 h-5" />
                      Usage Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total API Calls</span>
                        <span className="font-semibold">{totalApiCalls.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Active Integrations</span>
                        <span className="font-semibold">{connectedCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Data Synced</span>
                        <span className="font-semibold">
                          {integrations
                            .filter(i => i.syncedItems)
                            .reduce((sum, i) => sum + (i.syncedItems || 0), 0)
                            .toLocaleString()} items
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">Success Rate</span>
                          <span className="font-semibold text-green-600">98.2%</span>
                        </div>
                        <Progress value={98.2} className="h-2" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">Avg Response Time</span>
                          <span className="font-semibold">245ms</span>
                        </div>
                        <Progress value={75} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Top Integrations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {integrations
                        .filter(i => i.apiCalls)
                        .sort((a, b) => (b.apiCalls || 0) - (a.apiCalls || 0))
                        .slice(0, 3)
                        .map((integration, idx) => (
                          <div key={integration.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs w-4 text-center text-muted-foreground">#{idx + 1}</span>
                              <span className="text-sm">{integration.name}</span>
                            </div>
                            <span className="text-sm font-medium">
                              {integration.apiCalls?.toLocaleString()}
                            </span>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Configuration Modal */}
      {selectedIntegration && (
        <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <selectedIntegration.icon className="w-5 h-5" />
                Configure {selectedIntegration.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="text-sm text-muted-foreground">
                {selectedIntegration.description}
              </div>

              {/* Configuration Form */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">API Key</label>
                  <Input 
                    type="password" 
                    placeholder="Enter your API key..."
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Sync Frequency</label>
                  <select className="w-full mt-1 px-3 py-2 border rounded-lg bg-background">
                    <option>Every hour</option>
                    <option>Every 6 hours</option>
                    <option>Daily</option>
                    <option>Weekly</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Enable Webhooks</p>
                    <p className="text-sm text-muted-foreground">Receive real-time updates</p>
                  </div>
                  <Switch />
                </div>

                {selectedIntegration.webhookUrl && (
                  <div>
                    <label className="text-sm font-medium">Webhook URL</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input 
                        value={selectedIntegration.webhookUrl}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button size="sm" variant="outline">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Features List */}
              <div>
                <h4 className="font-medium mb-3">Available Features</h4>
                <div className="grid grid-cols-1 gap-2">
                  {selectedIntegration.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">{feature}</span>
                      <Switch defaultChecked />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsConfigModalOpen(false)}>
                  Cancel
                </Button>
                <Button>
                  Save Configuration
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}