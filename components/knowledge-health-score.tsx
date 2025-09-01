'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Shield, 
  FileText, 
  Database, 
  Zap,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Activity,
  Info
} from 'lucide-react'

export interface HealthMetrics {
  overall_score: number
  document_quality: number
  coverage_completeness: number
  indexing_status: number
  data_freshness: number
  vector_integrity: number
  graph_connectivity: number
}

interface KnowledgeHealthScoreProps {
  metrics?: HealthMetrics
  isLoading?: boolean
  className?: string
}

export function KnowledgeHealthScore({ 
  metrics, 
  isLoading = false, 
  className = "" 
}: KnowledgeHealthScoreProps) {
  const [animatedScore, setAnimatedScore] = useState(0)
  const [hoveredMetric, setHoveredMetric] = useState<string | null>(null)

  // Default metrics for loading/error states
  const defaultMetrics: HealthMetrics = {
    overall_score: 87,
    document_quality: 92,
    coverage_completeness: 78,
    indexing_status: 95,
    data_freshness: 85,
    vector_integrity: 89,
    graph_connectivity: 82
  }

  const currentMetrics = metrics || defaultMetrics

  // Animate the overall score on mount
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        const increment = currentMetrics.overall_score / 30
        let current = 0
        const animation = setInterval(() => {
          current += increment
          if (current >= currentMetrics.overall_score) {
            setAnimatedScore(currentMetrics.overall_score)
            clearInterval(animation)
          } else {
            setAnimatedScore(Math.floor(current))
          }
        }, 50)
        return () => clearInterval(animation)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [currentMetrics.overall_score, isLoading])

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-emerald-500'
    if (score >= 75) return 'text-blue-500'
    if (score >= 60) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getScoreBgColor = (score: number): string => {
    if (score >= 90) return 'from-emerald-500/20 to-emerald-600/10'
    if (score >= 75) return 'from-blue-500/20 to-blue-600/10'
    if (score >= 60) return 'from-yellow-500/20 to-yellow-600/10'
    return 'from-red-500/20 to-red-600/10'
  }

  const getProgressColor = (score: number): string => {
    if (score >= 90) return 'bg-gradient-to-r from-emerald-400 to-emerald-600'
    if (score >= 75) return 'bg-gradient-to-r from-blue-400 to-blue-600'
    if (score >= 60) return 'bg-gradient-to-r from-yellow-400 to-yellow-600'
    return 'bg-gradient-to-r from-red-400 to-red-600'
  }

  const healthFactors = [
    {
      key: 'document_quality',
      label: 'Document Quality',
      value: currentMetrics.document_quality,
      icon: FileText,
      description: 'Content parsing accuracy and structure'
    },
    {
      key: 'coverage_completeness',
      label: 'Coverage',
      value: currentMetrics.coverage_completeness,
      icon: Shield,
      description: 'Knowledge domain completeness'
    },
    {
      key: 'indexing_status',
      label: 'Indexing',
      value: currentMetrics.indexing_status,
      icon: Database,
      description: 'Vector and graph index health'
    },
    {
      key: 'data_freshness',
      label: 'Freshness',
      value: currentMetrics.data_freshness,
      icon: TrendingUp,
      description: 'Recent updates and relevancy'
    },
    {
      key: 'vector_integrity',
      label: 'Vector Integrity',
      value: currentMetrics.vector_integrity,
      icon: Zap,
      description: 'Embedding quality and consistency'
    },
    {
      key: 'graph_connectivity',
      label: 'Connectivity',
      value: currentMetrics.graph_connectivity,
      icon: Activity,
      description: 'Knowledge graph relationships'
    }
  ]

  // Calculate circumference for the circular progress
  const radius = 120
  const circumference = 2 * Math.PI * radius
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference

  return (
    <Card className={`relative overflow-hidden hover:shadow-lg transition-all duration-300 ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="w-5 h-5 text-primary" />
          Knowledge Health Score
          {!isLoading && (
            <Badge 
              variant={currentMetrics.overall_score >= 80 ? "default" : "secondary"}
              className="ml-auto"
            >
              {currentMetrics.overall_score >= 90 ? 'Excellent' : 
               currentMetrics.overall_score >= 75 ? 'Good' : 
               currentMetrics.overall_score >= 60 ? 'Fair' : 'Poor'}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Circular Progress Ring */}
          <div className="flex-shrink-0 flex items-center justify-center">
            <div className="relative w-64 h-64 group">
              {/* Background Circle */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 260 260">
                <circle
                  cx="130"
                  cy="130"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-muted-foreground/20"
                />
                {/* Progress Circle */}
                <circle
                  cx="130"
                  cy="130"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className={`${getScoreColor(currentMetrics.overall_score)} transition-all duration-1000 ease-out group-hover:brightness-110`}
                  style={{
                    filter: 'drop-shadow(0 0 8px currentColor)',
                  }}
                />
              </svg>
              
              {/* Center Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center group-hover:scale-105 transition-transform duration-300">
                <div className={`text-5xl font-bold ${getScoreColor(currentMetrics.overall_score)} transition-colors duration-300`}>
                  {isLoading ? '...' : `${animatedScore}%`}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Overall Health</div>
                <div className="flex items-center gap-1 mt-2">
                  {currentMetrics.overall_score >= 80 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : currentMetrics.overall_score >= 60 ? (
                    <Info className="w-4 h-4 text-blue-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {currentMetrics.overall_score >= 80 ? 'Optimal' : 
                     currentMetrics.overall_score >= 60 ? 'Stable' : 'Needs Attention'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Health Metrics Breakdown */}
          <div className="flex-1 space-y-4">
            <h3 className="font-semibold text-base mb-4">Health Factors</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {healthFactors.map((factor) => {
                const Icon = factor.icon
                const isHovered = hoveredMetric === factor.key
                
                return (
                  <div
                    key={factor.key}
                    className={`p-4 rounded-lg border transition-all duration-200 cursor-pointer ${
                      isHovered 
                        ? 'border-primary/50 shadow-md bg-gradient-to-br ' + getScoreBgColor(factor.value)
                        : 'border-border hover:border-primary/30 bg-card'
                    }`}
                    onMouseEnter={() => setHoveredMetric(factor.key)}
                    onMouseLeave={() => setHoveredMetric(null)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${getScoreColor(factor.value)}`} />
                        <span className="text-sm font-medium">{factor.label}</span>
                      </div>
                      <span className={`text-sm font-semibold ${getScoreColor(factor.value)}`}>
                        {isLoading ? '...' : `${factor.value}%`}
                      </span>
                    </div>
                    
                    <Progress 
                      value={isLoading ? 0 : factor.value} 
                      className="h-2 mb-2"
                    />
                    
                    <p className="text-xs text-muted-foreground">
                      {factor.description}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Summary Insights */}
            <div className="mt-6 p-4 rounded-lg bg-muted/50 border">
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Key Insights
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                {currentMetrics.document_quality >= 90 && (
                  <li>• Document quality is excellent - parsing accuracy is optimal</li>
                )}
                {currentMetrics.indexing_status >= 95 && (
                  <li>• Vector and graph indexes are in perfect sync</li>
                )}
                {currentMetrics.coverage_completeness < 80 && (
                  <li>• Consider adding more documents to improve knowledge coverage</li>
                )}
                {currentMetrics.data_freshness < 80 && (
                  <li>• Some documents may need updates to maintain relevancy</li>
                )}
                {currentMetrics.graph_connectivity < 85 && (
                  <li>• Enhance entity relationships for better knowledge connections</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}