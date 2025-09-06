'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import {
  Brain,
  Search,
  Network,
  Database,
  Zap,
  Sparkles,
  Clock,
  CheckCircle2,
  Circle,
  ArrowRight,
  Activity,
  Hash,
  Tag,
  Target,
  Layers,
  GitMerge,
  Filter,
  ChevronDown,
  ChevronRight,
  FileText
} from 'lucide-react'

interface TimelineEvent {
  type: string
  step?: string
  status?: string
  data?: any
  timestamp?: string
  duration_ms?: number
  total_time_ms?: number
  results?: {
    graph?: number
    vector?: number
    final?: number
  }
}

interface RetrievalTimelineProps {
  events: TimelineEvent[]
  isLoading: boolean
}

export function RetrievalTimeline({ events, isLoading }: RetrievalTimelineProps) {
  const [expandedSteps, setExpandedSteps] = React.useState<Set<string>>(new Set())
  
  // Group events by step
  const stepGroups = React.useMemo(() => {
    const groups: Record<string, TimelineEvent[]> = {}
    events.forEach(event => {
      const key = event.step || event.type || 'unknown'
      if (!groups[key]) groups[key] = []
      groups[key].push(event)
    })
    return groups
  }, [events])
  
  // Calculate total time
  const totalTime = React.useMemo(() => {
    const summary = events.find(e => e.type === 'retrieval_summary')
    return summary?.total_time_ms || 0
  }, [events])
  
  const toggleStep = (step: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(step)) {
        next.delete(step)
      } else {
        next.add(step)
      }
      return next
    })
  }
  
  const getStepIcon = (step: string) => {
    const icons: Record<string, any> = {
      query_understanding: Brain,
      graph_search: Network,
      vector_search: Database,
      fusion: GitMerge,
      diversify: Filter,
      retrieval_step: Activity
    }
    return icons[step] || Circle
  }
  
  const getStepColor = (status: string) => {
    switch (status) {
      case 'start': return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'complete': return 'text-green-600 bg-green-50 border-green-200'
      case 'error': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-purple-600 bg-purple-50 border-purple-200'
    }
  }
  
  const renderQueryAnalysis = (data: any) => {
    if (!data) return null
    
    return (
      <div className="space-y-3 mt-3">
        {/* Intent */}
        {data.intent && (
          <div className="flex items-start gap-2">
            <Target className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">Intent</div>
              <Badge variant="outline" className="mt-1">{data.intent}</Badge>
            </div>
          </div>
        )}
        
        {/* Entities */}
        {data.entities > 0 && (
          <div className="flex items-start gap-2">
            <Hash className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">Entities Found</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {Array.isArray(data.entity_list) ? 
                  data.entity_list.map((e: any, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {e.text} <span className="text-muted-foreground ml-1">({e.type})</span>
                    </Badge>
                  )) :
                  <Badge variant="secondary">{data.entities} entities</Badge>
                }
              </div>
            </div>
          </div>
        )}
        
        {/* Keywords */}
        {data.keywords && data.keywords.length > 0 && (
          <div className="flex items-start gap-2">
            <Tag className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">Keywords</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {data.keywords.slice(0, 6).map((kw: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs">{kw}</Badge>
                ))}
                {data.keywords.length > 6 && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    +{data.keywords.length - 6} more
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
  
  const renderSearchMetrics = (data: any, type: string) => {
    if (!data) return null
    
    return (
      <div className="space-y-2 mt-3">
        {/* Result count and score */}
        <div className="grid grid-cols-2 gap-3">
          {data.results !== undefined && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Results</div>
              <div className="font-semibold text-lg">{data.results}</div>
            </div>
          )}
          {data.top_score !== undefined && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Top Score</div>
              <div className="flex items-center gap-1">
                <div className="font-semibold text-lg">{Math.round(data.top_score * 100)}%</div>
                <Progress value={data.top_score * 100} className="w-12 h-2" />
              </div>
            </div>
          )}
        </div>
        
        {/* Sample results */}
        {data.sample && data.sample.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">Top Results</div>
            {data.sample.slice(0, 3).map((item: any, i: number) => (
              <div key={i} className="p-2 rounded-md bg-secondary/30 text-xs">
                <div className="line-clamp-2">
                  {item.fact || item.content || item.text || 'Result'}
                </div>
                {item.score && (
                  <div className="flex items-center gap-1 mt-1">
                    <Progress value={item.score * 100} className="h-1 flex-1" />
                    <span className="text-[10px] text-muted-foreground">
                      {Math.round(item.score * 100)}%
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
  
  const renderStepTimeline = (step: string, events: TimelineEvent[]) => {
    const startEvent = events.find(e => e.status === 'start')
    const completeEvent = events.find(e => e.status === 'complete')
    const duration = completeEvent?.data?.elapsed_ms || completeEvent?.duration_ms || 0
    const isExpanded = expandedSteps.has(step)
    const Icon = getStepIcon(step)
    
    const stepNames: Record<string, string> = {
      query_understanding: 'Query Analysis',
      graph_search: 'Knowledge Graph',
      vector_search: 'Vector Search',
      fusion: 'Result Fusion',
      diversify: 'Diversification'
    }
    
    const isComplete = completeEvent !== undefined
    const isRunning = startEvent && !completeEvent
    
    return (
      <div key={step} className="relative">
        {/* Connection line */}
        <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-border" />
        
        {/* Step header */}
        <div 
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
            isExpanded ? "bg-secondary/50" : "hover:bg-secondary/20"
          )}
          onClick={() => toggleStep(step)}
        >
          {/* Status icon */}
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center border-2",
            isComplete ? getStepColor('complete') : 
            isRunning ? getStepColor('start') : 
            getStepColor('pending')
          )}>
            {isComplete ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
          </div>
          
          {/* Step info */}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{stepNames[step] || step}</span>
              {isRunning && (
                <Badge variant="outline" className="text-xs animate-pulse">Running</Badge>
              )}
              {duration > 0 && (
                <Badge variant="secondary" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  {duration}ms
                </Badge>
              )}
            </div>
            
            {/* Quick stats */}
            {completeEvent?.data && (
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {completeEvent.data.results !== undefined && (
                  <span>{completeEvent.data.results} results</span>
                )}
                {completeEvent.data.entities > 0 && (
                  <span>{completeEvent.data.entities} entities</span>
                )}
                {completeEvent.data.fused_count !== undefined && (
                  <span>{completeEvent.data.fused_count} fused</span>
                )}
                {completeEvent.data.final_count !== undefined && (
                  <span>{completeEvent.data.final_count} final</span>
                )}
              </div>
            )}
          </div>
          
          {/* Expand icon */}
          <div className="text-muted-foreground">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </div>
        
        {/* Expanded details */}
        {isExpanded && completeEvent?.data && (
          <div className="ml-11 mr-3 mb-3 p-3 rounded-lg bg-secondary/20">
            {step === 'query_understanding' && renderQueryAnalysis(completeEvent.data)}
            {(step === 'graph_search' || step === 'vector_search') && renderSearchMetrics(completeEvent.data, step)}
            {step === 'fusion' && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Fusion Strategy</div>
                <div className="flex items-center gap-2">
                  <GitMerge className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Combined {completeEvent.data.fused_count} results from multiple sources</span>
                </div>
              </div>
            )}
            {step === 'diversify' && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Diversity Optimization</div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Reduced to {completeEvent.data.final_count} diverse results</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
  
  // Get ordered steps
  const orderedSteps = ['query_understanding', 'graph_search', 'vector_search', 'fusion', 'diversify']
  const activeSteps = orderedSteps.filter(step => stepGroups[step])
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className={cn(
            "w-4 h-4",
            isLoading ? "text-yellow-500 animate-pulse" : "text-green-500"
          )} />
          <span className="text-sm font-medium">
            {isLoading ? 'Processing retrieval...' : 'Retrieval complete'}
          </span>
        </div>
        {totalTime > 0 && (
          <Badge variant="outline" className="text-xs">
            Total: {totalTime}ms
          </Badge>
        )}
      </div>
      
      {/* Timeline */}
      <div className="space-y-2">
        {activeSteps.length === 0 && !isLoading && (
          <div className="text-sm text-muted-foreground text-center py-8">
            No retrieval activity yet. Ask a question to see the detailed search path.
          </div>
        )}
        
        {activeSteps.map(step => renderStepTimeline(step, stepGroups[step]))}
      </div>
      
      {/* Summary card if complete */}
      {events.find(e => e.type === 'retrieval_summary') && (
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="font-medium text-green-900">Retrieval Complete</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            {(() => {
              const summary = events.find(e => e.type === 'retrieval_summary')
              if (!summary?.results) return null
              return (
                <>
                  <div>
                    <div className="text-green-700">Graph</div>
                    <div className="font-semibold text-green-900">
                      {summary.results.graph} facts
                    </div>
                  </div>
                  <div>
                    <div className="text-green-700">Vector</div>
                    <div className="font-semibold text-green-900">
                      {summary.results.vector} chunks
                    </div>
                  </div>
                  <div>
                    <div className="text-green-700">Final</div>
                    <div className="font-semibold text-green-900">
                      {summary.results.final} results
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </Card>
      )}
    </div>
  )
}
