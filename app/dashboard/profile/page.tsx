'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  User, 
  Settings, 
  Shield, 
  CreditCard,
  Bell,
  Eye,
  Key,
  Trash2,
  Download,
  Upload,
  Mail,
  Phone,
  Globe,
  Calendar,
  Clock,
  Activity,
  BarChart3,
  Brain,
  FileText,
  Users,
  Zap,
  Crown,
  Star,
  Award,
  TrendingUp,
  Database,
  Code,
  Camera,
  Edit3,
  Save,
  X,
  Check,
  AlertTriangle,
  Info,
  HelpCircle,
  ExternalLink
} from 'lucide-react'
import { cn } from '@/lib/utils'

type UserProfile = {
  id: string
  name: string
  email: string
  avatar?: string
  title?: string
  bio?: string
  company?: string
  location?: string
  timezone: string
  language: string
  theme: 'light' | 'dark' | 'system'
  created_at: string
  last_active: string
}

type UsageStats = {
  documents_processed: number
  queries_made: number
  ai_enhancements: number
  integrations_active: number
  storage_used: number
  api_calls: number
  monthly_limit: number
  prompts_created: number
}

type SecuritySettings = {
  two_factor_enabled: boolean
  session_timeout: number
  login_notifications: boolean
  api_access: boolean
  webhook_access: boolean
}

type PrivacySettings = {
  analytics_tracking: boolean
  usage_telemetry: boolean
  marketing_emails: boolean
  feature_updates: boolean
  security_alerts: boolean
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile>({
    id: 'user-123',
    name: 'Sarah Chen',
    email: 'sarah.chen@company.com',
    title: 'Senior Data Analyst',
    bio: 'Passionate about turning data into actionable insights. Love working with AI and machine learning to solve complex business problems.',
    company: 'DataCorp Inc.',
    location: 'San Francisco, CA',
    timezone: 'America/Los_Angeles',
    language: 'en-US',
    theme: 'system',
    created_at: '2024-01-15',
    last_active: new Date().toISOString()
  })

  const [usageStats] = useState<UsageStats>({
    documents_processed: 1247,
    queries_made: 8932,
    ai_enhancements: 156,
    integrations_active: 4,
    storage_used: 2.8,
    api_calls: 15743,
    monthly_limit: 50000,
    prompts_created: 23
  })

  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    two_factor_enabled: true,
    session_timeout: 8,
    login_notifications: true,
    api_access: true,
    webhook_access: false
  })

  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    analytics_tracking: true,
    usage_telemetry: true,
    marketing_emails: false,
    feature_updates: true,
    security_alerts: true
  })

  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')

  const achievements = [
    {
      id: 'early_adopter',
      name: 'Early Adopter',
      description: 'Joined during beta phase',
      icon: Crown,
      color: 'text-yellow-600 bg-yellow-100',
      earned: true
    },
    {
      id: 'power_user',
      name: 'Power User',
      description: 'Processed 1000+ documents',
      icon: Star,
      color: 'text-blue-600 bg-blue-100',
      earned: true
    },
    {
      id: 'ai_enthusiast',
      name: 'AI Enthusiast',
      description: 'Used 100+ AI enhancements',
      icon: Brain,
      color: 'text-purple-600 bg-purple-100',
      earned: true
    },
    {
      id: 'collaborator',
      name: 'Team Collaborator',
      description: 'Shared 50+ prompts',
      icon: Users,
      color: 'text-green-600 bg-green-100',
      earned: false
    },
    {
      id: 'integrator',
      name: 'Integration Master',
      description: 'Connected 5+ services',
      icon: Zap,
      color: 'text-orange-600 bg-orange-100',
      earned: false
    }
  ]

  const recentActivity = [
    {
      type: 'document',
      action: 'Processed quarterly_report_2024.pdf',
      timestamp: '2 hours ago',
      icon: FileText
    },
    {
      type: 'ai',
      action: 'Enhanced prompt "Data Analysis Assistant"',
      timestamp: '4 hours ago',
      icon: Brain
    },
    {
      type: 'query',
      action: 'Ran 15 queries in Marketing collection',
      timestamp: '6 hours ago',
      icon: BarChart3
    },
    {
      type: 'integration',
      action: 'Connected Google Drive integration',
      timestamp: '1 day ago',
      icon: Zap
    }
  ]

  const updateProfile = (field: keyof UserProfile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }))
  }

  const updateSecuritySetting = (field: keyof SecuritySettings, value: boolean | number) => {
    setSecuritySettings(prev => ({ ...prev, [field]: value }))
  }

  const updatePrivacySetting = (field: keyof PrivacySettings, value: boolean) => {
    setPrivacySettings(prev => ({ ...prev, [field]: value }))
  }

  const saveProfile = () => {
    setIsEditing(false)
    // In a real app, save to backend
  }

  const exportData = () => {
    // Simulate data export
    const data = {
      profile,
      usage_stats: usageStats,
      export_date: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `datadiver-profile-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Mobile-Optimized Header */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Avatar className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0">
              <div className="w-full h-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-sm sm:text-lg font-semibold">
                {profile.name.split(' ').map(n => n[0]).join('')}
              </div>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-semibold truncate">{profile.name}</h1>
              <p className="text-muted-foreground text-sm sm:text-base truncate">{profile.email}</p>
              <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  Pro Plan
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Member since {new Date(profile.created_at).toLocaleDateString()}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <Button variant="outline" onClick={exportData} size="sm" className="text-xs sm:text-sm">
              <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Export Data
            </Button>
            {isEditing ? (
              <div className="flex gap-2">
                <Button size="sm" onClick={saveProfile} className="flex-1 sm:flex-none text-xs sm:text-sm">
                  <Save className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} className="flex-1 sm:flex-none text-xs sm:text-sm">
                  <X className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  Cancel
                </Button>
              </div>
            ) : (
              <Button onClick={() => setIsEditing(true)} size="sm" className="text-xs sm:text-sm">
                <Edit3 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Edit Profile
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile-Optimized Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-6xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Mobile-Scrollable TabsList */}
            <div className="w-full overflow-x-auto">
              <TabsList className="grid w-max min-w-full sm:w-full grid-cols-5 gap-1 mx-auto">
                <TabsTrigger value="profile" className="text-xs sm:text-sm px-2 sm:px-3 py-2 whitespace-nowrap">Profile</TabsTrigger>
                <TabsTrigger value="usage" className="text-xs sm:text-sm px-2 sm:px-3 py-2 whitespace-nowrap">Usage & Stats</TabsTrigger>
                <TabsTrigger value="security" className="text-xs sm:text-sm px-2 sm:px-3 py-2 whitespace-nowrap">Security</TabsTrigger>
                <TabsTrigger value="privacy" className="text-xs sm:text-sm px-2 sm:px-3 py-2 whitespace-nowrap">Privacy</TabsTrigger>
                <TabsTrigger value="billing" className="text-xs sm:text-sm px-2 sm:px-3 py-2 whitespace-nowrap">Billing</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="profile" className="mt-4 sm:mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* Mobile-Optimized Profile Information */}
                <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                  <Card>
                    <CardHeader className="pb-3 sm:pb-6">
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <User className="w-4 h-4 sm:w-5 sm:h-5" />
                        Personal Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 p-4 sm:p-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2 md:col-span-1">
                          <label className="text-sm font-medium">Full Name</label>
                          <Input
                            value={profile.name}
                            onChange={(e) => updateProfile('name', e.target.value)}
                            disabled={!isEditing}
                            className="mt-1 h-10 sm:h-10 text-base"
                            placeholder="Enter your full name"
                          />
                        </div>
                        <div className="sm:col-span-2 md:col-span-1">
                          <label className="text-sm font-medium">Email</label>
                          <Input
                            value={profile.email}
                            type="email"
                            disabled={!isEditing}
                            className="mt-1 h-10 sm:h-10 text-base"
                            placeholder="your.email@example.com"
                          />
                        </div>
                        <div className="sm:col-span-2 md:col-span-1">
                          <label className="text-sm font-medium">Job Title</label>
                          <Input
                            value={profile.title || ''}
                            onChange={(e) => updateProfile('title', e.target.value)}
                            disabled={!isEditing}
                            className="mt-1 h-10 sm:h-10 text-base"
                            placeholder="Your job title"
                          />
                        </div>
                        <div className="sm:col-span-2 md:col-span-1">
                          <label className="text-sm font-medium">Company</label>
                          <Input
                            value={profile.company || ''}
                            onChange={(e) => updateProfile('company', e.target.value)}
                            disabled={!isEditing}
                            className="mt-1 h-10 sm:h-10 text-base"
                            placeholder="Your company"
                          />
                        </div>
                        <div className="sm:col-span-2 md:col-span-1">
                          <label className="text-sm font-medium">Location</label>
                          <Input
                            value={profile.location || ''}
                            onChange={(e) => updateProfile('location', e.target.value)}
                            disabled={!isEditing}
                            className="mt-1 h-10 sm:h-10 text-base"
                            placeholder="City, Country"
                          />
                        </div>
                        <div className="sm:col-span-2 md:col-span-1">
                          <label className="text-sm font-medium">Timezone</label>
                          <Select value={profile.timezone} disabled={!isEditing}>
                            <SelectTrigger className="mt-1 h-10 sm:h-10 text-base">
                              <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                              <SelectItem value="America/New_York">Eastern Time</SelectItem>
                              <SelectItem value="Europe/London">GMT</SelectItem>
                              <SelectItem value="Asia/Tokyo">JST</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-sm font-medium">Bio</label>
                        <Textarea
                          value={profile.bio || ''}
                          onChange={(e) => updateProfile('bio', e.target.value)}
                          disabled={!isEditing}
                          rows={3}
                          className="mt-1 text-base resize-none"
                          placeholder="Tell us about yourself..."
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Mobile-Optimized Preferences */}
                  <Card>
                    <CardHeader className="pb-3 sm:pb-6">
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                        Preferences
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 p-4 sm:p-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">Language</label>
                          <Select value={profile.language} disabled={!isEditing}>
                            <SelectTrigger className="mt-1 h-10 sm:h-10 text-base">
                              <SelectValue placeholder="Select language" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="en-US">English (US)</SelectItem>
                              <SelectItem value="en-GB">English (UK)</SelectItem>
                              <SelectItem value="es-ES">Español</SelectItem>
                              <SelectItem value="fr-FR">Français</SelectItem>
                              <SelectItem value="de-DE">Deutsch</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Theme</label>
                          <Select value={profile.theme} disabled={!isEditing}>
                            <SelectTrigger className="mt-1 h-10 sm:h-10 text-base">
                              <SelectValue placeholder="Select theme" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="light">Light</SelectItem>
                              <SelectItem value="dark">Dark</SelectItem>
                              <SelectItem value="system">System</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Mobile-Optimized Sidebar */}
                <div className="space-y-4 sm:space-y-6">
                  {/* Mobile-Optimized Achievements */}
                  <Card>
                    <CardHeader className="pb-3 sm:pb-6">
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <Award className="w-4 h-4 sm:w-5 sm:h-5" />
                        Achievements
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6">
                      <div className="grid grid-cols-1 gap-2 sm:gap-3">
                        {achievements.map((achievement) => {
                          const IconComponent = achievement.icon
                          return (
                            <div
                              key={achievement.id}
                              className={cn(
                                "flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border",
                                achievement.earned 
                                  ? "bg-background border-border" 
                                  : "bg-muted/50 border-dashed opacity-50"
                              )}
                            >
                              <div className={cn("w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0", achievement.color)}>
                                <IconComponent className="w-3 h-3 sm:w-4 sm:h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-medium">{achievement.name}</p>
                                <p className="text-xs text-muted-foreground">{achievement.description}</p>
                              </div>
                              {achievement.earned && <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />}
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Mobile-Optimized Recent Activity */}
                  <Card>
                    <CardHeader className="pb-3 sm:pb-6">
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
                        Recent Activity
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6">
                      <div className="space-y-2 sm:space-y-3">
                        {recentActivity.map((activity, idx) => {
                          const IconComponent = activity.icon
                          return (
                            <div key={idx} className="flex items-start gap-2 sm:gap-3">
                              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                                <IconComponent className="w-3 h-3 sm:w-4 sm:h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm">{activity.action}</p>
                                <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="usage" className="mt-4 sm:mt-6">
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                {/* Mobile-Optimized Usage Statistics Cards */}
                <Card>
                  <CardContent className="p-3 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-lg sm:text-2xl font-bold">{usageStats.documents_processed.toLocaleString()}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">Documents Processed</p>
                      </div>
                      <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 self-start sm:self-center" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-3 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-lg sm:text-2xl font-bold">{usageStats.queries_made.toLocaleString()}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">Queries Made</p>
                      </div>
                      <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 self-start sm:self-center" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-3 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-lg sm:text-2xl font-bold">{usageStats.ai_enhancements}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">AI Enhancements</p>
                      </div>
                      <Brain className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600 self-start sm:self-center" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-3 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-lg sm:text-2xl font-bold">{usageStats.integrations_active}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">Active Integrations</p>
                      </div>
                      <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600 self-start sm:self-center" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* API Usage */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>API Usage This Month</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>API Calls</span>
                      <span className="font-semibold">
                        {usageStats.api_calls.toLocaleString()} / {usageStats.monthly_limit.toLocaleString()}
                      </span>
                    </div>
                    <Progress value={(usageStats.api_calls / usageStats.monthly_limit) * 100} className="h-3" />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{((usageStats.api_calls / usageStats.monthly_limit) * 100).toFixed(1)}% used</span>
                      <span>Resets on {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Storage Usage */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Storage Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Used Storage</span>
                      <span className="font-semibold">{usageStats.storage_used} GB / 10 GB</span>
                    </div>
                    <Progress value={(usageStats.storage_used / 10) * 100} className="h-3" />
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Documents:</span>
                        <span className="ml-1 font-medium">2.1 GB</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Vectors:</span>
                        <span className="ml-1 font-medium">0.6 GB</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Other:</span>
                        <span className="ml-1 font-medium">0.1 GB</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      Account Security
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Two-Factor Authentication</p>
                        <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                      </div>
                      <Switch 
                        checked={securitySettings.two_factor_enabled}
                        onCheckedChange={(value) => updateSecuritySetting('two_factor_enabled', value)}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Login Notifications</p>
                        <p className="text-sm text-muted-foreground">Get notified of new logins</p>
                      </div>
                      <Switch 
                        checked={securitySettings.login_notifications}
                        onCheckedChange={(value) => updateSecuritySetting('login_notifications', value)}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">Session Timeout</label>
                      <Select 
                        value={securitySettings.session_timeout.toString()}
                        onValueChange={(value) => updateSecuritySetting('session_timeout', parseInt(value))}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 hour</SelectItem>
                          <SelectItem value="4">4 hours</SelectItem>
                          <SelectItem value="8">8 hours</SelectItem>
                          <SelectItem value="24">24 hours</SelectItem>
                          <SelectItem value="168">1 week</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="w-5 h-5" />
                      API Access
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">API Access</p>
                        <p className="text-sm text-muted-foreground">Enable API key access</p>
                      </div>
                      <Switch 
                        checked={securitySettings.api_access}
                        onCheckedChange={(value) => updateSecuritySetting('api_access', value)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Webhook Access</p>
                        <p className="text-sm text-muted-foreground">Allow webhook endpoints</p>
                      </div>
                      <Switch 
                        checked={securitySettings.webhook_access}
                        onCheckedChange={(value) => updateSecuritySetting('webhook_access', value)}
                      />
                    </div>

                    {securitySettings.api_access && (
                      <div className="pt-4 border-t space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">API Key</span>
                          <Button size="sm" variant="outline">
                            <Eye className="w-4 h-4 mr-1" />
                            Show
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded">
                          sk-•••••••••••••••••••••••••••••••••••••••••••••••••••••••••
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Download className="w-4 h-4 mr-1" />
                            Regenerate
                          </Button>
                          <Button size="sm" variant="outline">
                            <Code className="w-4 h-4 mr-1" />
                            View Docs
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Password Change */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Current Password</label>
                    <Input type="password" className="mt-1" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">New Password</label>
                      <Input type="password" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Confirm Password</label>
                      <Input type="password" className="mt-1" />
                    </div>
                  </div>
                  <Button>Update Password</Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="privacy" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Privacy Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Analytics Tracking</p>
                      <p className="text-sm text-muted-foreground">Help improve our service with usage analytics</p>
                    </div>
                    <Switch 
                      checked={privacySettings.analytics_tracking}
                      onCheckedChange={(value) => updatePrivacySetting('analytics_tracking', value)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Usage Telemetry</p>
                      <p className="text-sm text-muted-foreground">Send anonymous usage data</p>
                    </div>
                    <Switch 
                      checked={privacySettings.usage_telemetry}
                      onCheckedChange={(value) => updatePrivacySetting('usage_telemetry', value)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Marketing Emails</p>
                      <p className="text-sm text-muted-foreground">Receive marketing and promotional emails</p>
                    </div>
                    <Switch 
                      checked={privacySettings.marketing_emails}
                      onCheckedChange={(value) => updatePrivacySetting('marketing_emails', value)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Feature Updates</p>
                      <p className="text-sm text-muted-foreground">Get notified about new features</p>
                    </div>
                    <Switch 
                      checked={privacySettings.feature_updates}
                      onCheckedChange={(value) => updatePrivacySetting('feature_updates', value)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Security Alerts</p>
                      <p className="text-sm text-muted-foreground">Important security notifications</p>
                    </div>
                    <Switch 
                      checked={privacySettings.security_alerts}
                      onCheckedChange={(value) => updatePrivacySetting('security_alerts', value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Data Management */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Data Management</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button variant="outline" onClick={exportData}>
                      <Download className="w-4 h-4 mr-2" />
                      Export Data
                    </Button>
                    <Button variant="outline">
                      <Upload className="w-4 h-4 mr-2" />
                      Import Data
                    </Button>
                    <Button variant="destructive">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Account
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>• Export: Download all your data in JSON format</p>
                    <p>• Import: Restore data from a previous export</p>
                    <p>• Delete: Permanently remove your account and all data</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5" />
                      Current Plan
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold">Pro Plan</p>
                        <p className="text-muted-foreground">$29/month</p>
                      </div>
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        <span>50,000 API calls/month</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        <span>10GB storage</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        <span>AI enhancements</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        <span>Priority support</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t space-y-2">
                      <Button className="w-full" variant="outline">
                        Upgrade Plan
                      </Button>
                      <Button className="w-full" variant="ghost">
                        Cancel Subscription
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Billing History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { date: '2024-08-01', amount: '$29.00', status: 'Paid' },
                        { date: '2024-07-01', amount: '$29.00', status: 'Paid' },
                        { date: '2024-06-01', amount: '$29.00', status: 'Paid' },
                      ].map((invoice, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{invoice.amount}</p>
                            <p className="text-sm text-muted-foreground">{invoice.date}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{invoice.status}</Badge>
                            <Button size="sm" variant="ghost">
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
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
    </div>
  )
}