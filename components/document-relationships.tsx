"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Network, 
  FileText, 
  Folder, 
  ArrowRight, 
  Maximize2, 
  Minimize2, 
  Download, 
  Filter,
  Search,
  Zap,
  Users,
  Calendar,
  Tag
} from 'lucide-react'
import { cn } from '@/lib/utils'

type DocumentNode = {
  id: string
  title: string
  category: string
  quality_score: number
  connections: number
  x?: number
  y?: number
}

type DocumentRelation = {
  source: string
  target: string
  strength: number
  type: 'content_similarity' | 'topic_overlap' | 'citation' | 'temporal'
}

interface DocumentRelationshipsProps {
  documents: DocumentNode[]
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
}

export function DocumentRelationships({ 
  documents = [], 
  isFullscreen = false, 
  onToggleFullscreen 
}: DocumentRelationshipsProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedNode, setSelectedNode] = useState<DocumentNode | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [strengthThreshold, setStrengthThreshold] = useState<number>(0.3)
  
  // Mock data for demonstration
  const mockDocuments: DocumentNode[] = documents.length > 0 ? documents : [
    { id: '1', title: 'Technical Requirements Document', category: 'Technical', quality_score: 92, connections: 5 },
    { id: '2', title: 'Business Plan Overview', category: 'Business', quality_score: 88, connections: 3 },
    { id: '3', title: 'User Research Findings', category: 'Research', quality_score: 95, connections: 7 },
    { id: '4', title: 'Project Timeline', category: 'Planning', quality_score: 78, connections: 4 },
    { id: '5', title: 'Security Guidelines', category: 'Technical', quality_score: 91, connections: 6 },
    { id: '6', title: 'Marketing Strategy', category: 'Business', quality_score: 84, connections: 2 },
  ]

  const mockRelations: DocumentRelation[] = [
    { source: '1', target: '5', strength: 0.8, type: 'content_similarity' },
    { source: '1', target: '4', strength: 0.6, type: 'temporal' },
    { source: '2', target: '6', strength: 0.9, type: 'topic_overlap' },
    { source: '3', target: '1', strength: 0.7, type: 'citation' },
    { source: '3', target: '2', strength: 0.5, type: 'content_similarity' },
    { source: '4', target: '2', strength: 0.4, type: 'temporal' },
    { source: '5', target: '3', strength: 0.6, type: 'content_similarity' },
  ]

  // Calculate node positions using a simple force-directed layout simulation
  const calculateLayout = () => {
    const nodes = [...mockDocuments]
    const width = 800
    const height = 600
    const centerX = width / 2
    const centerY = height / 2

    // Simple circular layout for demonstration
    nodes.forEach((node, index) => {
      const angle = (index * 2 * Math.PI) / nodes.length
      const radius = Math.min(width, height) * 0.3
      node.x = centerX + radius * Math.cos(angle)
      node.y = centerY + radius * Math.sin(angle)
    })

    return nodes
  }

  const [layoutNodes, setLayoutNodes] = useState<DocumentNode[]>(calculateLayout())

  useEffect(() => {
    setLayoutNodes(calculateLayout())
  }, [mockDocuments])

  const filteredRelations = mockRelations.filter(relation => {
    if (strengthThreshold > relation.strength) return false
    if (filterType !== 'all' && relation.type !== filterType) return false
    return true
  })

  const getRelationColor = (type: string) => {
    switch (type) {
      case 'content_similarity': return '#3b82f6'
      case 'topic_overlap': return '#10b981'
      case 'citation': return '#f59e0b'
      case 'temporal': return '#8b5cf6'
      default: return '#6b7280'
    }
  }

  const getNodeColor = (category: string, quality: number) => {
    const baseColors = {
      'Technical': '#3b82f6',
      'Business': '#10b981', 
      'Research': '#f59e0b',
      'Planning': '#8b5cf6',
      'Marketing': '#ef4444'
    }
    
    const opacity = quality >= 90 ? 1 : quality >= 70 ? 0.8 : 0.6
    return baseColors[category as keyof typeof baseColors] || '#6b7280'
  }

  return (
    <Card className={cn("w-full", isFullscreen && "h-screen")}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Network className="w-5 h-5" />
            Document Relationships
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleFullscreen}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Relations</SelectItem>
                <SelectItem value="content_similarity">Content Similarity</SelectItem>
                <SelectItem value="topic_overlap">Topic Overlap</SelectItem>
                <SelectItem value="citation">Citations</SelectItem>
                <SelectItem value="temporal">Temporal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Strength:</span>
            <input 
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={strengthThreshold}
              onChange={(e) => setStrengthThreshold(parseFloat(e.target.value))}
              className="w-20"
            />
            <span className="text-xs text-muted-foreground w-8">{strengthThreshold}</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="flex h-96">
          {/* Graph Visualization */}
          <div className="flex-1 relative">
            <svg 
              ref={svgRef}
              viewBox="0 0 800 600" 
              className="w-full h-full border rounded-lg"
              style={{ background: 'linear-gradient(45deg, #f8fafc 25%, transparent 25%), linear-gradient(-45deg, #f8fafc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f8fafc 75%), linear-gradient(-45deg, transparent 75%, #f8fafc 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px' }}
            >
              {/* Relations/Edges */}
              <g className="relations">
                {filteredRelations.map((relation, index) => {
                  const sourceNode = layoutNodes.find(n => n.id === relation.source)
                  const targetNode = layoutNodes.find(n => n.id === relation.target)
                  
                  if (!sourceNode || !targetNode) return null
                  
                  return (
                    <g key={`relation-${index}`}>
                      <line
                        x1={sourceNode.x}
                        y1={sourceNode.y}
                        x2={targetNode.x}
                        y2={targetNode.y}
                        stroke={getRelationColor(relation.type)}
                        strokeWidth={relation.strength * 4}
                        strokeOpacity={0.6}
                        className="hover:stroke-opacity-100"
                      />
                      <text
                        x={(sourceNode.x! + targetNode.x!) / 2}
                        y={(sourceNode.y! + targetNode.y!) / 2 - 5}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#6b7280"
                        className="pointer-events-none"
                      >
                        {Math.round(relation.strength * 100)}%
                      </text>
                    </g>
                  )
                })}
              </g>
              
              {/* Nodes */}
              <g className="nodes">
                {layoutNodes.map((node) => (
                  <g 
                    key={node.id} 
                    className="cursor-pointer"
                    onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
                  >
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={Math.max(20, node.connections * 3)}
                      fill={getNodeColor(node.category, node.quality_score)}
                      fillOpacity={selectedNode?.id === node.id ? 1 : 0.8}
                      stroke={selectedNode?.id === node.id ? '#1f2937' : 'white'}
                      strokeWidth={selectedNode?.id === node.id ? 3 : 2}
                      className="hover:stroke-gray-800 hover:stroke-width-3 transition-all"
                    />
                    <text
                      x={node.x}
                      y={node.y - 30}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="500"
                      fill="#1f2937"
                      className="pointer-events-none"
                    >
                      {node.title.length > 15 ? `${node.title.slice(0, 15)}...` : node.title}
                    </text>
                    <text
                      x={node.x}
                      y={node.y + 5}
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="bold"
                      fill="white"
                      className="pointer-events-none"
                    >
                      {node.quality_score}%
                    </text>
                  </g>
                ))}
              </g>
            </svg>
          </div>
          
          {/* Side Panel */}
          <div className="w-80 border-l bg-gray-50/50 p-4">
            <div className="space-y-4">
              {selectedNode ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">{selectedNode.title}</h3>
                    <div className="space-y-2">
                      <Badge variant="outline">{selectedNode.category}</Badge>
                      <div className="flex items-center gap-2 text-sm">
                        <Zap className="w-4 h-4 text-yellow-500" />
                        <span>Quality: {selectedNode.quality_score}%</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Network className="w-4 h-4 text-blue-500" />
                        <span>{selectedNode.connections} connections</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Related Documents</h4>
                    <div className="space-y-2">
                      {filteredRelations
                        .filter(r => r.source === selectedNode.id || r.target === selectedNode.id)
                        .map((relation, index) => {
                          const relatedId = relation.source === selectedNode.id ? relation.target : relation.source
                          const relatedNode = layoutNodes.find(n => n.id === relatedId)
                          
                          return (
                            <div key={index} className="flex items-center gap-2 p-2 bg-white rounded border text-xs">
                              <FileText className="w-3 h-3 text-muted-foreground" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{relatedNode?.title}</div>
                                <div className="text-muted-foreground">
                                  {relation.type.replace('_', ' ')} • {Math.round(relation.strength * 100)}%
                                </div>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm">
                        <Search className="w-3 h-3 mr-1" />
                        Analyze
                      </Button>
                      <Button variant="outline" size="sm">
                        <Download className="w-3 h-3 mr-1" />
                        Export
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Network className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-medium mb-2">Document Network</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Click on any document node to explore its relationships and connections.
                  </p>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span>Content Similarity</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span>Topic Overlap</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <span>Citations</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                      <span>Temporal Relations</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}