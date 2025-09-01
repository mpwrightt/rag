'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Search,
  Filter,
  Clock,
  FileText,
  MessageSquare,
  Users,
  Brain,
  TrendingUp,
  Calendar,
  Tag,
  ExternalLink,
  BookOpen,
  Lightbulb,
  Zap
} from 'lucide-react'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results] = useState([
    {
      type: 'document',
      title: 'Q3 Financial Report',
      content: 'Quarterly financial performance showing 15% growth in revenue...',
      relevance: 95,
      lastModified: '2 days ago',
      source: 'financial_reports.pdf',
      highlights: ['revenue growth', '15% increase', 'quarterly performance']
    },
    {
      type: 'conversation',
      title: 'Discussion about market trends',
      content: 'AI analysis of current market conditions and future projections...',
      relevance: 88,
      lastModified: '5 hours ago',
      source: 'Chat History',
      highlights: ['market trends', 'AI analysis', 'projections']
    },
    {
      type: 'prompt',
      title: 'Market Analysis Assistant',
      content: 'Analyze market trends and provide insights on competitive landscape...',
      relevance: 82,
      lastModified: '1 week ago',
      source: 'Prompts Library',
      highlights: ['market analysis', 'competitive landscape']
    }
  ])

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Search className="w-6 h-6 text-primary" />
              Universal Search
            </h1>
            <p className="text-muted-foreground">
              Search across all your documents, conversations, and prompts
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <Input
            placeholder="Search everything..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 text-lg h-12"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">All Results</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="conversations">Conversations</TabsTrigger>
              <TabsTrigger value="prompts">Prompts</TabsTrigger>
              <TabsTrigger value="people">People</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6">
              <div className="space-y-4">
                {results.map((result, idx) => (
                  <Card key={idx} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {result.type === 'document' && <FileText className="w-4 h-4 text-blue-600" />}
                            {result.type === 'conversation' && <MessageSquare className="w-4 h-4 text-green-600" />}
                            {result.type === 'prompt' && <Brain className="w-4 h-4 text-purple-600" />}
                            <h3 className="font-semibold">{result.title}</h3>
                            <Badge variant="outline" className="text-xs capitalize">{result.type}</Badge>
                          </div>
                          <p className="text-muted-foreground mb-3 line-clamp-2">{result.content}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {result.lastModified}
                            </span>
                            <span className="flex items-center gap-1">
                              <BookOpen className="w-3 h-3" />
                              {result.source}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {result.highlights.map((highlight, hidx) => (
                              <Badge key={hidx} variant="secondary" className="text-xs">
                                {highlight}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-100 text-green-800">
                            {result.relevance}%
                          </Badge>
                          <Button size="sm" variant="ghost">
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}