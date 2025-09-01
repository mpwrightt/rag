'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings, User, Shield, Bell, Palette, Globe, HelpCircle } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur p-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your application settings and preferences
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center py-12">
            <Settings className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Settings Overview</h3>
            <p className="text-muted-foreground mb-6">
              Advanced settings are available in your Profile page
            </p>
            <div className="text-sm text-muted-foreground">
              Navigate to Profile → Settings tabs for detailed configuration options
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}