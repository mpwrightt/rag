'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings, User, Shield, Bell, Palette, Globe, HelpCircle } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Mobile-Optimized Header */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur p-4 sm:p-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            Settings
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage your application settings and preferences
          </p>
        </div>
      </div>

      {/* Mobile-Optimized Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center py-8 sm:py-12">
            <Settings className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-medium mb-2">Settings Overview</h3>
            <p className="text-muted-foreground mb-4 sm:mb-6 text-sm sm:text-base px-4">
              Advanced settings are available in your Profile page
            </p>
            <Card className="p-4 sm:p-6 text-left mx-4 sm:mx-0">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm sm:text-base">Account & Profile</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">Personal information and preferences</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <Shield className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm sm:text-base">Security Settings</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">Two-factor authentication and API keys</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Bell className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm sm:text-base">Notification Preferences</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">Email and system notifications</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Palette className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm sm:text-base">Appearance & Theme</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">Dark mode, language, and layout</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t">
                <div className="text-xs sm:text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
                  <div className="flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-blue-900 dark:text-blue-100">Quick Tip</p>
                      <p className="text-blue-700 dark:text-blue-200 mt-1">
                        Navigate to <strong>Profile → Settings tabs</strong> for detailed configuration options
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}