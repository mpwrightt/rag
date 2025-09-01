'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Bell, 
  Check, 
  X, 
  Settings, 
  Filter,
  Search,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  Zap,
  FileText,
  Users,
  Brain,
  TrendingUp,
  Database,
  Upload,
  Download,
  Trash2,
  Archive,
  Mail,
  Smartphone,
  Volume2,
  VolumeX
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NotificationType = 'system' | 'document' | 'ai' | 'user' | 'integration' | 'security'
type NotificationPriority = 'low' | 'medium' | 'high' | 'critical'
type NotificationStatus = 'unread' | 'read' | 'archived'

type Notification = {
  id: string
  type: NotificationType
  priority: NotificationPriority
  status: NotificationStatus
  title: string
  message: string
  timestamp: string
  action?: {
    label: string
    url?: string
    onClick?: () => void
  }
  metadata?: Record<string, any>
}

type NotificationSettings = {
  email: boolean
  push: boolean
  browser: boolean
  sound: boolean
  types: Record<NotificationType, boolean>
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly'
  quietHours: {
    enabled: boolean
    start: string
    end: string
  }
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [settings, setSettings] = useState<NotificationSettings>({
    email: true,
    push: true,
    browser: true,
    sound: false,
    types: {
      system: true,
      document: true,
      ai: true,
      user: false,
      integration: true,
      security: true
    },
    frequency: 'immediate',
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00'
    }
  })
  const [filter, setFilter] = useState<'all' | NotificationType | NotificationStatus>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState('notifications')

  // Mock notifications data
  const mockNotifications: Notification[] = [
    {
      id: '1',
      type: 'ai',
      priority: 'high',
      status: 'unread',
      title: 'AI Enhancement Complete',
      message: 'Your prompt "Document Analysis Assistant" has been enhanced with 87% confidence improvements.',
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      action: {
        label: 'View Enhanced Prompt',
        url: '/dashboard/prompts'
      }
    },
    {
      id: '2',
      type: 'document',
      priority: 'medium',
      status: 'unread',
      title: 'Document Processing Complete',
      message: '3 new documents have been processed and added to your knowledge base.',
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      action: {
        label: 'View Documents',
        url: '/dashboard/documents'
      }
    },
    {
      id: '3',
      type: 'system',
      priority: 'critical',
      status: 'unread',
      title: 'System Maintenance Scheduled',
      message: 'Scheduled maintenance will occur tonight from 2-4 AM EST. Some features may be temporarily unavailable.',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '4',
      type: 'integration',
      priority: 'low',
      status: 'read',
      title: 'Google Drive Sync Complete',
      message: 'Successfully synchronized 12 documents from Google Drive.',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '5',
      type: 'security',
      priority: 'high',
      status: 'unread',
      title: 'New Login Detected',
      message: 'A new device has accessed your account from San Francisco, CA.',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      action: {
        label: 'Review Activity',
        url: '/dashboard/security'
      }
    },
    {
      id: '6',
      type: 'user',
      priority: 'medium',
      status: 'read',
      title: 'Team Invite Accepted',
      message: 'John Smith has joined your team workspace.',
      timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '7',
      type: 'ai',
      priority: 'low',
      status: 'read',
      title: 'Usage Analytics Available',
      message: 'Your monthly AI usage report is now available for review.',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      action: {
        label: 'View Report',
        url: '/dashboard/analytics'
      }
    }
  ]

  useEffect(() => {
    setNotifications(mockNotifications)
  }, [])

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'ai': return <Brain className="w-4 h-4" />
      case 'document': return <FileText className="w-4 h-4" />
      case 'system': return <Settings className="w-4 h-4" />
      case 'user': return <Users className="w-4 h-4" />
      case 'integration': return <Zap className="w-4 h-4" />
      case 'security': return <AlertTriangle className="w-4 h-4" />
      default: return <Bell className="w-4 h-4" />
    }
  }

  const getPriorityColor = (priority: NotificationPriority, status: NotificationStatus) => {
    if (status === 'read') return 'text-muted-foreground'
    
    switch (priority) {
      case 'critical': return 'text-red-600'
      case 'high': return 'text-orange-600'
      case 'medium': return 'text-blue-600'
      case 'low': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  const getPriorityBadge = (priority: NotificationPriority) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      medium: 'bg-blue-100 text-blue-800 border-blue-200',
      low: 'bg-green-100 text-green-800 border-green-200'
    }
    return colors[priority] || colors.low
  }

  const formatTimestamp = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diff = now.getTime() - time.getTime()
    
    if (diff < 60 * 1000) return 'Just now'
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}m ago`
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}h ago`
    if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24 * 60 * 60 * 1000))}d ago`
    
    return time.toLocaleDateString()
  }

  const filteredNotifications = notifications.filter(notification => {
    const matchesSearch = notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         notification.message.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filter === 'all' || notification.type === filter || notification.status === filter
    return matchesSearch && matchesFilter
  })

  const unreadCount = notifications.filter(n => n.status === 'unread').length
  const criticalCount = notifications.filter(n => n.priority === 'critical' && n.status === 'unread').length

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, status: 'read' as NotificationStatus } : n
    ))
  }

  const markAsArchived = (id: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, status: 'archived' as NotificationStatus } : n
    ))
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, status: 'read' as NotificationStatus })))
  }

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const toggleNotificationSelection = (id: string) => {
    setSelectedNotifications(prev => 
      prev.includes(id) 
        ? prev.filter(nId => nId !== id)
        : [...prev, id]
    )
  }

  const bulkAction = (action: 'read' | 'archive' | 'delete') => {
    if (action === 'delete') {
      setNotifications(prev => prev.filter(n => !selectedNotifications.includes(n.id)))
    } else {
      setNotifications(prev => prev.map(n => 
        selectedNotifications.includes(n.id) 
          ? { ...n, status: action as NotificationStatus }
          : n
      ))
    }
    setSelectedNotifications([])
  }

  const updateSettings = (key: keyof NotificationSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const updateTypeSettings = (type: NotificationType, value: boolean) => {
    setSettings(prev => ({ 
      ...prev, 
      types: { ...prev.types, [type]: value }
    }))
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Bell className="w-6 h-6 text-primary" />
              Notifications
            </h1>
            <p className="text-muted-foreground">
              Stay updated with system alerts and activity notifications
            </p>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <Badge variant="secondary" className="px-3 py-1">
                {unreadCount} unread
              </Badge>
            )}
            {criticalCount > 0 && (
              <Badge variant="destructive" className="px-3 py-1">
                {criticalCount} critical
              </Badge>
            )}
            <Button onClick={markAllAsRead} variant="outline" size="sm">
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark All Read
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Notifications</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
              <SelectItem value="read">Read</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="document">Documents</SelectItem>
              <SelectItem value="ai">AI & Enhancements</SelectItem>
              <SelectItem value="integration">Integrations</SelectItem>
              <SelectItem value="security">Security</SelectItem>
              <SelectItem value="user">Team & Users</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="notifications">
                Notifications ({filteredNotifications.length})
              </TabsTrigger>
              <TabsTrigger value="settings">
                Notification Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="notifications" className="mt-6">
              {/* Bulk Actions */}
              {selectedNotifications.length > 0 && (
                <Card className="mb-4 bg-blue-50/50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {selectedNotifications.length} notification{selectedNotifications.length > 1 ? 's' : ''} selected
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => bulkAction('read')}>
                          <Check className="w-4 h-4 mr-1" />
                          Mark Read
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => bulkAction('archive')}>
                          <Archive className="w-4 h-4 mr-1" />
                          Archive
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => bulkAction('delete')} className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Notifications List */}
              <div className="space-y-2">
                {filteredNotifications.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No notifications found</h3>
                      <p className="text-muted-foreground">
                        {searchQuery 
                          ? 'Try adjusting your search or filter criteria'
                          : 'You\'re all caught up! No new notifications.'
                        }
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredNotifications.map((notification) => (
                    <Card 
                      key={notification.id} 
                      className={cn(
                        "hover:shadow-md transition-all cursor-pointer group",
                        notification.status === 'unread' ? "border-l-4 border-l-blue-500 bg-blue-50/30" : "",
                        notification.priority === 'critical' ? "border-l-4 border-l-red-500 bg-red-50/30" : "",
                        selectedNotifications.includes(notification.id) ? "ring-2 ring-primary/20" : ""
                      )}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex items-center gap-3 flex-1">
                            {/* Selection Checkbox */}
                            <div 
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleNotificationSelection(notification.id)
                              }}
                            >
                              <div className={cn(
                                "w-4 h-4 border border-gray-300 rounded flex items-center justify-center cursor-pointer hover:bg-gray-100",
                                selectedNotifications.includes(notification.id) ? "bg-primary border-primary" : ""
                              )}>
                                {selectedNotifications.includes(notification.id) && (
                                  <Check className="w-3 h-3 text-white" />
                                )}
                              </div>
                            </div>

                            {/* Icon */}
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center",
                              notification.type === 'ai' ? 'bg-purple-100 text-purple-600' :
                              notification.type === 'document' ? 'bg-blue-100 text-blue-600' :
                              notification.type === 'system' ? 'bg-gray-100 text-gray-600' :
                              notification.type === 'security' ? 'bg-red-100 text-red-600' :
                              notification.type === 'integration' ? 'bg-green-100 text-green-600' :
                              'bg-yellow-100 text-yellow-600'
                            )}>
                              {getNotificationIcon(notification.type)}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className={cn(
                                  "font-medium text-sm truncate",
                                  notification.status === 'unread' ? 'text-foreground' : 'text-muted-foreground'
                                )}>
                                  {notification.title}
                                </h3>
                                <Badge className={cn("text-xs px-2 py-0", getPriorityBadge(notification.priority))}>
                                  {notification.priority}
                                </Badge>
                              </div>
                              <p className={cn(
                                "text-sm mb-2 line-clamp-2",
                                notification.status === 'unread' ? 'text-muted-foreground' : 'text-muted-foreground/70'
                              )}>
                                {notification.message}
                              </p>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Clock className="w-3 h-3" />
                                  {formatTimestamp(notification.timestamp)}
                                </div>
                                {notification.action && (
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-6 px-2 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      // Handle action
                                    }}
                                  >
                                    {notification.action.label}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation()
                                markAsArchived(notification.id)
                              }}
                            >
                              <Archive className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteNotification(notification.id)
                              }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="settings" className="mt-6">
              <div className="space-y-6">
                {/* Delivery Methods */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="w-5 h-5" />
                      Delivery Methods
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Email Notifications</p>
                          <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                        </div>
                      </div>
                      <Switch 
                        checked={settings.email}
                        onCheckedChange={(value) => updateSettings('email', value)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Smartphone className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Push Notifications</p>
                          <p className="text-sm text-muted-foreground">Mobile and desktop push notifications</p>
                        </div>
                      </div>
                      <Switch 
                        checked={settings.push}
                        onCheckedChange={(value) => updateSettings('push', value)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Bell className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Browser Notifications</p>
                          <p className="text-sm text-muted-foreground">In-browser notification popups</p>
                        </div>
                      </div>
                      <Switch 
                        checked={settings.browser}
                        onCheckedChange={(value) => updateSettings('browser', value)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {settings.sound ? (
                          <Volume2 className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <VolumeX className="w-4 h-4 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium">Sound Alerts</p>
                          <p className="text-sm text-muted-foreground">Play sound for notifications</p>
                        </div>
                      </div>
                      <Switch 
                        checked={settings.sound}
                        onCheckedChange={(value) => updateSettings('sound', value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Notification Types */}
                <Card>
                  <CardHeader>
                    <CardTitle>Notification Types</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.entries(settings.types).map(([type, enabled]) => (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            type === 'ai' ? 'bg-purple-100 text-purple-600' :
                            type === 'document' ? 'bg-blue-100 text-blue-600' :
                            type === 'system' ? 'bg-gray-100 text-gray-600' :
                            type === 'security' ? 'bg-red-100 text-red-600' :
                            type === 'integration' ? 'bg-green-100 text-green-600' :
                            'bg-yellow-100 text-yellow-600'
                          )}>
                            {getNotificationIcon(type as NotificationType)}
                          </div>
                          <div>
                            <p className="font-medium capitalize">{type} Notifications</p>
                            <p className="text-sm text-muted-foreground">
                              {type === 'ai' && 'AI enhancements and processing updates'}
                              {type === 'document' && 'Document uploads and processing'}
                              {type === 'system' && 'System maintenance and updates'}
                              {type === 'security' && 'Security alerts and login activity'}
                              {type === 'integration' && 'Third-party service integrations'}
                              {type === 'user' && 'Team activities and invitations'}
                            </p>
                          </div>
                        </div>
                        <Switch 
                          checked={enabled}
                          onCheckedChange={(value) => updateTypeSettings(type as NotificationType, value)}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Frequency Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle>Delivery Frequency</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="font-medium mb-2">Notification Frequency</p>
                      <Select value={settings.frequency} onValueChange={(value: any) => updateSettings('frequency', value)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="immediate">Immediately</SelectItem>
                          <SelectItem value="hourly">Hourly Digest</SelectItem>
                          <SelectItem value="daily">Daily Digest</SelectItem>
                          <SelectItem value="weekly">Weekly Digest</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Quiet Hours */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Quiet Hours</p>
                          <p className="text-sm text-muted-foreground">Suppress non-critical notifications during these hours</p>
                        </div>
                        <Switch 
                          checked={settings.quietHours.enabled}
                          onCheckedChange={(value) => updateSettings('quietHours', { ...settings.quietHours, enabled: value })}
                        />
                      </div>
                      {settings.quietHours.enabled && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium mb-1">Start Time</p>
                            <Input 
                              type="time" 
                              value={settings.quietHours.start}
                              onChange={(e) => updateSettings('quietHours', { 
                                ...settings.quietHours, 
                                start: e.target.value 
                              })}
                            />
                          </div>
                          <div>
                            <p className="text-sm font-medium mb-1">End Time</p>
                            <Input 
                              type="time" 
                              value={settings.quietHours.end}
                              onChange={(e) => updateSettings('quietHours', { 
                                ...settings.quietHours, 
                                end: e.target.value 
                              })}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Save Button */}
                <div className="flex justify-end">
                  <Button>
                    <Check className="w-4 h-4 mr-2" />
                    Save Settings
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}