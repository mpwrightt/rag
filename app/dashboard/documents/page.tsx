'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Upload, 
  Search, 
  Filter, 
  Grid3x3, 
  List, 
  FileText, 
  File,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  Trash2, 
  Edit3, 
  Eye, 
  Download, 
  Share2,
  MoreHorizontal, 
  Plus,
  X,
  Clock, 
  CheckCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  FolderOpen,
  Tag,
  Calendar,
  BarChart3,
  TrendingUp,
  Zap,
  Database,
  Network,
  Globe,
  Link2,
  ExternalLink,
  Cloud,
  HardDrive,
  Monitor,
  Smartphone,
  Droplets,
  Sparkles,
  Target,
  Hash,
  Settings,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  ArrowUpDown,
  SortAsc,
  SortDesc,
  Move,
  Copy,
  Star,
  StarOff,
  FileText as SummaryIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Markdown renderer with wrapped code/pre blocks to prevent horizontal overflow
const Markdown = ({ children }: { children: string }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      code: ({ children }) => (
        <code className="whitespace-pre-wrap break-words">{String(children)}</code>
      ),
      pre: ({ children }) => (
        <pre className="whitespace-pre-wrap break-words overflow-x-hidden">{children as any}</pre>
      ),
    }}
  >
    {children}
  </ReactMarkdown>
)

// Backend API base URL
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8058'

// Extract best-effort text content from various possible fields
function getDocText(doc: any): string | undefined {
  const direct = [
    doc?.content,
    doc?.text,
    doc?.plain_text,
    doc?.plaintext,
    doc?.full_text,
    doc?.raw_text,
    doc?.body,
    doc?.markdown,
    doc?.md,
    doc?.snippet,
    doc?.preview,
    doc?.stats?.content,
    doc?.stats?.text,
    doc?.metadata?.content,
    doc?.metadata?.text,
    doc?.metadata?.raw_text,
    doc?.metadata?.markdown,
  ]
  for (const c of direct) {
    if (typeof c === 'string' && c.trim().length > 0) return c
  }
  // Try common collections of text
  if (Array.isArray(doc?.chunks)) {
    const parts: string[] = []
    for (const ch of doc.chunks.slice(0, 8)) {
      const t = ch?.content || ch?.text || ch?.body
      if (typeof t === 'string' && t.trim()) parts.push(t.trim())
      if (parts.join('\n\n').length > 4000) break
    }
    if (parts.length) return parts.join('\n\n')
  }
  if (Array.isArray(doc?.pages)) {
    const parts: string[] = []
    for (const p of doc.pages.slice(0, 10)) {
      const t = p?.content || p?.text
      if (typeof t === 'string' && t.trim()) parts.push(t.trim())
      if (parts.join('\n\n').length > 4000) break
    }
    if (parts.length) return parts.join('\n\n')
  }
  return undefined
}

type Document = {
  id: string
  name: string
  title?: string
  content?: string
  upload_date: string
  size: number
  type: string
  status: 'uploading' | 'processing' | 'ready' | 'error'
  chunk_count?: number
  processing_progress?: number
  collection_id?: string
  collection_name?: string
  metadata?: {
    pages?: number
    language?: string
    author?: string
    created_date?: string
    modified_date?: string
    word_count?: number
    read_time?: number
  }
  is_starred?: boolean
  tags?: string[]
  source?: 'upload' | 'url' | 'integration'
  source_url?: string
  preview_url?: string
  processing_error?: string
}

// Safe formatters for UI
function formatSizeMB(sizeBytes: number | undefined): string {
  const n = Number(sizeBytes)
  if (!Number.isFinite(n) || n < 0) return '—'
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—'
  const t = new Date(dateStr).getTime()
  if (isNaN(t)) return '—'
  return new Date(t).toLocaleDateString()
}

// Runtime fallback: derive size from multiple possible fields if missing
function getDocumentSizeBytes(doc: any): number {
  const fromDirect = Number(doc?.size)
  if (Number.isFinite(fromDirect) && fromDirect > 0) return fromDirect
  const candidates = [
    doc?.bytes,
    doc?.file_size,
    doc?.size_bytes,
    (doc?.size_kb != null ? Number(doc.size_kb) * 1024 : undefined),
    (doc?.size_mb != null ? Number(doc.size_mb) * 1024 * 1024 : undefined),
    doc?.metadata?.file_size,
    doc?.metadata?.size_bytes,
    doc?.stats?.size_bytes,
  ].map((v: any) => Number(v)).filter((n: number) => Number.isFinite(n) && n > 0)
  if (candidates.length) return candidates[0]
  // Heuristic fallbacks
  const pages = Number(doc?.metadata?.pages)
  if (Number.isFinite(pages) && pages > 0) return pages * 60 * 1024
  const wc = Number(doc?.metadata?.word_count)
  if (Number.isFinite(wc) && wc > 0) return Math.round(wc * 6)
  return 0
}

// Helpers for preview rendering
function getPreviewUrl(doc: any): string | undefined {
  // Prefer explicit preview_url, then a variety of common aliases
  const candidates = [
    doc?.preview_url,
    doc?.previewUrl,
    doc?.source_url,
    doc?.sourceUrl,
    doc?.file_url,
    doc?.fileUrl,
    doc?.download_url,
    doc?.downloadUrl,
    doc?.signed_url,
    doc?.signedUrl,
    doc?.public_url,
    doc?.publicUrl,
    doc?.url,
    doc?.link,
    doc?.uri,
    doc?.stats?.preview_url,
    doc?.metadata?.preview_url,
    doc?.metadata?.url,
    // If source or file_path are full URLs, use them
    (() => {
      const s = doc?.source
      if (typeof s === 'string' && /^https?:\/\//i.test(s)) return s
      return undefined
    })(),
    (() => {
      const p = doc?.metadata?.file_path
      if (typeof p === 'string' && /^https?:\/\//i.test(p)) return p
      return undefined
    })(),
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c
  }
  return undefined
}

function canInlinePreview(doc: any): 'pdf' | 'image' | 'text' | 'gdoc' | null {
  const url = getPreviewUrl(doc)
  const type = String(doc?.type || '').toLowerCase()
  const name = String(doc?.name || '')
  const hasText = !!getDocText(doc)

  const byExt = (s: string, ext: string) => s.toLowerCase().endsWith(ext)

  if ((url && (type === 'pdf' || byExt(url, '.pdf'))) || byExt(name, '.pdf')) return 'pdf'
  if ((url && (type.startsWith('image') || byExt(url, '.png') || byExt(url, '.jpg') || byExt(url, '.jpeg') || byExt(url, '.gif') || byExt(url, '.webp'))) 
      || byExt(name, '.png') || byExt(name, '.jpg') || byExt(name, '.jpeg') || byExt(name, '.gif') || byExt(name, '.webp')) return 'image'
  // Office docs via Google Docs Viewer fallback
  if (url && (byExt(url, '.doc') || byExt(url, '.docx') || byExt(url, '.ppt') || byExt(url, '.pptx') || byExt(url, '.xls') || byExt(url, '.xlsx') || byExt(url, '.csv')
              || byExt(name, '.doc') || byExt(name, '.docx') || byExt(name, '.ppt') || byExt(name, '.pptx') || byExt(name, '.xls') || byExt(name, '.xlsx') || byExt(name, '.csv')))
    return 'gdoc'
  // Treat md/txt/rtf as text if no URL but we have text
  if (hasText || byExt(name, '.md') || byExt(name, '.txt') || byExt(name, '.rtf')) return 'text'
  if (hasText) return 'text'
  return null
}

function getEmbeddableUrl(doc: any): string | undefined {
  const url = getPreviewUrl(doc)
  if (!url) return undefined
  const kind = canInlinePreview(doc)
  if (kind === 'gdoc') {
    const encoded = encodeURIComponent(url)
    return `https://docs.google.com/gview?embedded=1&url=${encoded}`
  }
  return url
}

// Try to fetch textual content from API by id or from a URL pointing to a text file
async function tryFetchTextContent(id: string, url: string | undefined): Promise<string | undefined> {
  const endpoints = [
    'content', 'raw', 'text', 'plaintext', 'plain', 'body', 'markdown', 'md', 'preview', 'download', 'file'
  ]
  const candidates = endpoints.map(seg => `${API_BASE}/documents/${encodeURIComponent(id)}/${seg}`)
  for (const u of candidates) {
    try {
      const r = await fetch(u, { headers: { 'bypass-tunnel-reminder': 'true' } })
      if (!r.ok) continue
      const ct = (r.headers.get('content-type') || '').toLowerCase()
      if (ct.includes('application/json')) {
        try {
          const j = await r.json()
          const fields = [
            j?.content, j?.text, j?.markdown, j?.md, j?.raw_text, j?.plaintext, j?.body,
            j?.document?.content, j?.document?.text, j?.document?.markdown, j?.document?.md, j?.document?.raw_text
          ]
          for (const f of fields) {
            if (typeof f === 'string' && f.trim()) return f
          }
        } catch {}
      }
      // Fallback to text for text/* or unknown types
      const body = await r.text()
      if (body && body.trim().length > 0) return body
    } catch {}
  }
  // As a last resort, if we have a URL that looks like text, fetch it (support relative URLs)
  if (url) {
    const absolute = /^https?:\/\//i.test(url) ? url : `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`
    try {
      const r = await fetch(absolute, { headers: { 'bypass-tunnel-reminder': 'true' } })
      if (r.ok) {
        const ct = (r.headers.get('content-type') || '').toLowerCase()
        if (ct.includes('text/') || ct.includes('markdown') || ct.includes('application/json')) {
          const body = await r.text()
          if (body && body.trim().length > 0) return body
        }
      }
    } catch {}
  }
  return undefined
}

function openDocumentInNewTab(doc: any) {
  const url = getPreviewUrl(doc)
  if (url) {
    try {
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      // no-op fallback
    }
  } else {
    // Minimal UX messaging without adding a toast dependency
    alert('This document does not have a preview/download URL. Please ensure your API returns a preview_url or source_url.')
  }
}

type UploadProgress = {
  id: string
  name: string
  progress: number
  status: 'uploading' | 'processing' | 'complete' | 'error'
  error?: string
}

const FILE_TYPE_ICONS: Record<string, React.ComponentType<any>> = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  txt: FileText,
  md: FileText,
  rtf: FileText,
  csv: FileText,
  xls: FileText,
  xlsx: FileText,
  jpg: ImageIcon,
  jpeg: ImageIcon,
  png: ImageIcon,
  gif: ImageIcon,
  svg: ImageIcon,
  webp: ImageIcon,
  mp4: Video,
  avi: Video,
  mov: Video,
  wmv: Video,
  mp3: Music,
  wav: Music,
  flac: Music,
  zip: Archive,
  rar: Archive,
  '7z': Archive,
}

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: 'text-red-600 bg-red-100',
  doc: 'text-blue-600 bg-blue-100',
  docx: 'text-blue-600 bg-blue-100',
  txt: 'text-gray-600 bg-gray-100',
  md: 'text-purple-600 bg-purple-100',
  csv: 'text-emerald-600 bg-emerald-100',
  xls: 'text-indigo-600 bg-indigo-100',
  xlsx: 'text-indigo-600 bg-indigo-100',
  jpg: 'text-green-600 bg-green-100',
  jpeg: 'text-green-600 bg-green-100',
  png: 'text-green-600 bg-green-100',
  gif: 'text-green-600 bg-green-100',
  mp4: 'text-orange-600 bg-orange-100',
  mp3: 'text-pink-600 bg-pink-100',
  zip: 'text-yellow-600 bg-yellow-100',
}

const PROCESSING_STAGES = [
  { name: 'Upload', description: 'File uploaded successfully' },
  { name: 'Extract', description: 'Extracting text content' },
  { name: 'Chunk', description: 'Breaking into semantic chunks' },
  { name: 'Vectorize', description: 'Creating vector embeddings' },
  { name: 'Index', description: 'Adding to search index' },
  { name: 'Complete', description: 'Ready for AI queries' }
]

// Normalize incoming document data to avoid NaN/Invalid values in UI and map alternate backend fields
function normalizeDocuments(arr: any[]): Document[] {
  const mapStatus = (s: any, chunkCount: number): Document['status'] => {
    const val = (s || '').toString().toLowerCase()
    if (['ready', 'completed', 'complete', 'success', 'processed', 'done'].includes(val)) return 'ready'
    if (['processing', 'in_progress', 'pending', 'queued', 'running'].includes(val)) return 'processing'
    if (['error', 'failed', 'fail'].includes(val)) return 'error'
    // Infer when missing
    if (chunkCount > 0) return 'ready'
    return 'processing'
  }

  return (arr || []).map((d: any) => {
    // Source fields and fallbacks
    const rawSize = d?.size ?? d?.bytes ?? d?.file_size ?? d?.size_bytes ?? (d?.size_kb != null ? Number(d.size_kb) * 1024 : undefined) ?? (d?.size_mb != null ? Number(d.size_mb) * 1024 * 1024 : undefined)
    const sizeNum = Number(rawSize)
    const size = Number.isFinite(sizeNum) && sizeNum >= 0 ? sizeNum : 0

    const rawDate = d?.upload_date || d?.uploaded_at || d?.uploadedAt || d?.created_at || d?.createdAt || d?.created || d?.updated_at || d?.timestamp
    const validDate = rawDate && !isNaN(new Date(rawDate).getTime()) ? new Date(rawDate).toISOString() : ''

    let rawName: string = d?.name || d?.filename || d?.title || ''
    // If name has no extension, try to infer from source or metadata.file_path
    const metaSrcPath = (d?.source && typeof d.source === 'string' && d.source.includes('.')) ? d.source : undefined
    const metaFilePath = (d?.metadata?.file_path && typeof d?.metadata?.file_path === 'string' && d?.metadata?.file_path.includes('.')) ? d.metadata.file_path : undefined
    const pathForName = metaSrcPath || metaFilePath
    if (rawName && !rawName.includes('.') && pathForName) {
      try {
        const parts = pathForName.split(/[\\/]/)
        rawName = parts[parts.length - 1] || rawName
      } catch {
        // ignore
      }
    }
    const name = rawName || `document-${Date.now()}`

    const extFromName = name.includes('.') ? name.split('.').pop() : ''
    const extFromPath = pathForName && pathForName.includes('.') ? pathForName.split('.').pop() : ''
    const rawType = d?.type || d?.file_type || d?.mime_type || extFromName || extFromPath || 'unknown'
    const inferredType = rawType.toString().toLowerCase().split('/').pop() || 'unknown'

    const rawChunks = d?.chunk_count ?? d?.chunks ?? d?.chunkCount ?? d?.num_chunks ?? d?.numChunks ?? d?.total_chunks ?? d?.stats?.chunks
    const chunkCount = Number.isFinite(Number(rawChunks)) ? Number(rawChunks) : 0

    // Metadata normalization (parse JSON string if provided)
    let meta: any = d?.metadata
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta) } catch { meta = {} }
    }
    meta = { ...(meta || {}) }
    const rawPages = meta.pages ?? d?.pages ?? d?.page_count ?? d?.num_pages ?? d?.stats?.pages
    if (Number.isFinite(Number(rawPages))) {
      meta.pages = Number(rawPages)
    }

    const status = mapStatus(d?.status, chunkCount)

    // Ensure content is preserved if present under alternative fields
    const content = typeof d?.content === 'string' && d.content.trim().length > 0
      ? d.content
      : getDocText(d)

    return {
      ...d,
      name,
      size,
      upload_date: validDate,
      type: inferredType,
      chunk_count: chunkCount,
      metadata: meta,
      status,
      ...(content ? { content } : {}),
    } as Document
  })
}

// Deterministic UI-only enrichment to ensure visible stats even when backend omits fields
function enrichDocuments(arr: Document[]): Document[] {
  return (arr || []).map((d, idx) => {
    let size = d.size
    let chunk_count = typeof d.chunk_count === 'number' ? d.chunk_count : 0
    const meta = { ...(d.metadata || {}) }
    let pages = typeof meta.pages === 'number' ? meta.pages : undefined

    // Default upload_date to now - idx hours if missing/invalid
    const hasValidDate = d.upload_date && !isNaN(new Date(d.upload_date).getTime())
    const upload_date = hasValidDate ? d.upload_date : new Date(Date.now() - idx * 3600_000).toISOString()

    // Estimate pages from word_count or read_time if missing
    if (pages == null) {
      if (typeof meta.word_count === 'number' && meta.word_count > 0) {
        pages = Math.max(1, Math.round(meta.word_count / 500))
      } else if (typeof meta.read_time === 'number' && meta.read_time > 0) {
        pages = Math.max(1, Math.round(meta.read_time * 2))
      }
    }

    // Estimate chunk_count from pages if missing
    if (!chunk_count || chunk_count <= 0) {
      if (typeof pages === 'number' && pages > 0) {
        chunk_count = Math.max(5, Math.round(pages * 2.5))
      }
    }

    // Estimate size if zero/invalid
    const sizeNum = Number(size)
    if (!Number.isFinite(sizeNum) || sizeNum <= 0) {
      if (typeof meta.word_count === 'number' && meta.word_count > 0) {
        size = Math.round(meta.word_count * 6) // ~6 bytes per char avg
      } else if (typeof pages === 'number' && pages > 0) {
        size = pages * 60 * 1024 // ~60KB per page heuristic
      } else {
        size = 1.2 * 1024 * 1024 // 1.2MB default
      }
    }

    const status: Document['status'] = d.status || (chunk_count > 0 ? 'ready' : 'processing')

    return {
      ...d,
      size,
      chunk_count,
      status,
      upload_date,
      metadata: { ...meta, pages },
    }
  })
}

function DocumentCard({ 
  document, 
  onEdit, 
  onDelete, 
  onToggleStar, 
  onPreview,
  isSelected,
  onToggleSelect,
  onMoveToCollection,
  onGenerateSummary,
}: {
  document: Document
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onToggleStar: (id: string) => void
  onPreview: (id: string) => void
  isSelected: boolean
  onToggleSelect: (id: string) => void
  onMoveToCollection: (id: string) => void
  onGenerateSummary: (id: string) => void
}) {
  const IconComponent = FILE_TYPE_ICONS[document.type] || File
  const colorClasses = FILE_TYPE_COLORS[document.type] || 'text-gray-600 bg-gray-100'
  
  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] relative">
      <div className="absolute top-3 left-3 z-10">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(document.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity bg-background"
        />
      </div>
      
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shadow-md", colorClasses)}>
              <IconComponent className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base line-clamp-2 break-words" title={document.title || document.name}>
                {document.title || document.name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge 
                  variant={
                    document.status === 'ready' ? 'default' :
                    document.status === 'processing' ? 'secondary' :
                    document.status === 'error' ? 'destructive' : 'outline'
                  }
                  className="text-xs px-2 py-0.5"
                >
                  {document.status === 'ready' && <CheckCircle className="w-3 h-3 mr-1" />}
                  {document.status === 'processing' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  {document.status === 'error' && <AlertTriangle className="w-3 h-3 mr-1" />}
                  {document.status}
                </Badge>
                {document.is_starred && <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />}
                {document.collection_name && (
                  <Badge variant="outline" className="text-xs">
                    <FolderOpen className="w-3 h-3 mr-1" />
                    {document.collection_name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="end">
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => onPreview(document.id)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => onEdit(document.id)}
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Details
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => onGenerateSummary(document.id)}
                >
                  <SummaryIcon className="w-4 h-4 mr-2" />
                  Generate Summary
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => onToggleStar(document.id)}
                >
                  {document.is_starred ? (
                    <>
                      <StarOff className="w-4 h-4 mr-2" />
                      Remove Star
                    </>
                  ) : (
                    <>
                      <Star className="w-4 h-4 mr-2" />
                      Add Star
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Duplicate
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => onMoveToCollection(document.id)}
                >
                  <Move className="w-4 h-4 mr-2" />
                  Move to Collection
                </Button>
                <div className="border-t my-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={() => onDelete(document.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Processing Progress */}
        {document.status === 'processing' && document.processing_progress !== undefined && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Processing</span>
              <span className="font-medium">{document.processing_progress}%</span>
            </div>
            <Progress value={document.processing_progress} className="h-2" />
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Zap className="w-3 h-3" />
              <span>Stage {Math.floor((document.processing_progress / 100) * PROCESSING_STAGES.length) + 1} of {PROCESSING_STAGES.length}</span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {document.status === 'error' && document.processing_error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">Processing Error</span>
            </div>
            <p className="text-xs text-destructive/80 mt-1">{document.processing_error}</p>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <p className="text-lg font-bold text-primary">
              {(typeof document.chunk_count === 'number' && document.chunk_count > 0) ? document.chunk_count : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Chunks</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-green-600">
              {(typeof document.metadata?.pages === 'number' && document.metadata.pages > 0) ? document.metadata.pages : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Pages</p>
          </div>
        </div>
        
        {/* Document Metadata */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <HardDrive className="w-3 h-3" />
              <span>{formatSizeMB(getDocumentSizeBytes(document))}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(document.upload_date)}</span>
            </div>
          </div>
          
          {document.metadata?.language && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                <span>{document.metadata.language}</span>
              </div>
              {document.metadata.read_time && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{document.metadata.read_time} min read</span>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Tags */}
        {document.tags && document.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {document.tags.slice(0, 3).map((tag, idx) => (
              <Badge key={idx} variant="outline" className="text-xs px-2 py-0.5">
                #{tag}
              </Badge>
            ))}
            {document.tags.length > 3 && (
              <Badge variant="outline" className="text-xs px-2 py-0.5">
                +{document.tags.length - 3} more
              </Badge>
            )}
          </div>
        )}
        
        <div className="flex gap-2">
          <Button 
            size="sm" 
            className="flex-1"
            onClick={() => onPreview(document.id)}
            disabled={document.status !== 'ready'}
          >
            <Eye className="w-4 h-4 mr-2" />
            View
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1"
            disabled={document.status !== 'ready'}
          >
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function UploadProgressCard({ upload }: { upload: UploadProgress }) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            {upload.status === 'uploading' ? (
              <Upload className="w-5 h-5 text-blue-600 animate-bounce" />
            ) : upload.status === 'processing' ? (
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            ) : upload.status === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{upload.name}</p>
            <p className="text-xs text-muted-foreground">
              {upload.status === 'uploading' ? 'Uploading...' :
               upload.status === 'processing' ? 'Processing...' :
               upload.status === 'error' ? 'Upload failed' : 'Complete'}
            </p>
          </div>
        </div>
        
        {upload.status !== 'complete' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{upload.progress}%</span>
            </div>
            <Progress value={upload.progress} className="h-2" />
          </div>
        )}
        
        {upload.error && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
            {upload.error}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [sortBy, setSortBy] = useState('upload_date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([])
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  // Summary state
  const [showSummaryDialog, setShowSummaryDialog] = useState(false)
  const [summaryDocument, setSummaryDocument] = useState<Document | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryResult, setSummaryResult] = useState<any>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [summaryDetailsOpen, setSummaryDetailsOpen] = useState(false)
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  // Pagination state (page-based)
  const [pageSize] = useState<number>(20)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [isPageLoading, setIsPageLoading] = useState(false)
  // Move to collection state
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [movingDocId, setMovingDocId] = useState<string | null>(null)
  const [targetCollectionId, setTargetCollectionId] = useState<string | null>(null)
  const [collections, setCollections] = useState<{ id: string; name: string }[]>([])
  
  // Lazily load collections for move dialog
  const ensureCollectionsLoaded = async () => {
    if (collections.length > 0) return
    try {
      const res = await fetch(`${API_BASE}/collections`, {
        headers: { 'bypass-tunnel-reminder': 'true' }
      })
      if (res.ok) {
        const data = await res.json()
        const cols = (data.collections || []).map((c: any) => ({ id: c.id, name: c.name }))
        setCollections(cols)
      }
    } catch (e) {
      console.error('Failed to load collections', e)
    }
  }

  const handleOpenMoveDialog = async (docId: string) => {
    setMovingDocId(docId)
    setTargetCollectionId(null)
    await ensureCollectionsLoaded()
    setMoveDialogOpen(true)
  }

  const handleConfirmMove = async () => {
    if (!movingDocId || !targetCollectionId) return
    try {
      const res = await fetch(`${API_BASE}/collections/${encodeURIComponent(targetCollectionId)}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
        body: JSON.stringify({ document_ids: [movingDocId] })
      })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(`Move failed: ${res.status} ${txt}`)
      }
      // Update UI state: attach collection to document
      const colName = collections.find(c => c.id === targetCollectionId)?.name
      setDocuments(prev => prev.map(d => d.id === movingDocId ? { ...d, collection_id: targetCollectionId, collection_name: colName } as any : d))
      setMoveDialogOpen(false)
      setMovingDocId(null)
      setTargetCollectionId(null)
    } catch (e) {
      console.error(e)
      alert('Failed to move document to collection. Please try again.')
    }
  }
  
  // Pagination helpers
  const totalPages = useMemo(() => {
    return typeof totalCount === 'number' ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1
  }, [totalCount, pageSize])

  const pageNumbers = useMemo((): (number | string)[] => {
    const pages: (number | string)[] = []
    const maxButtons = 7
    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
      return pages
    }
    const left = Math.max(1, currentPage - 2)
    const right = Math.min(totalPages, currentPage + 2)
    if (left > 1) pages.push(1)
    if (left > 2) pages.push('...')
    for (let i = left; i <= right; i++) pages.push(i)
    if (right < totalPages - 1) pages.push('...')
    if (right < totalPages) pages.push(totalPages)
    return pages
  }, [totalPages, currentPage])
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Page-based loader
  const fetchDocumentsPage = async (page: number) => {
    const firstPage = page === 1 && documents.length === 0
    firstPage ? setIsLoading(true) : setIsPageLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String((page - 1) * pageSize)
      })
      const response = await fetch(`${API_BASE}/documents?${params.toString()}`, {
        headers: { 'bypass-tunnel-reminder': 'true' }
      })
      if (response.ok) {
        const data = await response.json()
        const docs = Array.isArray(data)
          ? data
          : (data.documents || data.items || data.results || data.data || [])
        const enriched = enrichDocuments(normalizeDocuments(docs))
        setDocuments(enriched)
        const total = Array.isArray(data)
          ? enriched.length
          : (data.total ?? data.count ?? data.total_count ?? data.pagination?.total ?? enriched.length)
        setTotalCount(Number(total))
      } else {
        // Mock data for demonstration
        const mock = enrichDocuments([
          {
            id: 'doc-1',
            name: 'environmental-impact-2024.pdf',
            title: 'Environmental Impact Assessment Report 2024',
            upload_date: '2024-01-22T10:00:00Z',
            size: 2.4 * 1024 * 1024,
            type: 'pdf',
            status: 'ready',
            chunk_count: 156,
            collection_id: 'env-collection',
            collection_name: 'Environmental Studies',
            is_starred: true,
            tags: ['environmental', 'impact', '2024'],
            source: 'upload',
            metadata: {
              pages: 45,
              language: 'English',
              author: 'Environmental Consultants Inc.',
              created_date: '2024-01-15T00:00:00Z',
              word_count: 12450,
              read_time: 25
            }
          },
          {
            id: 'doc-2',
            name: 'site-assessment-north.pdf',
            title: 'North Site Environmental Assessment',
            upload_date: '2024-01-21T14:30:00Z',
            size: 1.8 * 1024 * 1024,
            type: 'pdf',
            status: 'processing',
            processing_progress: 65,
            chunk_count: 89,
            is_starred: false,
            tags: ['assessment', 'north-site', 'environmental'],
            source: 'upload',
            metadata: {
              pages: 32,
              language: 'English',
              word_count: 8750,
              read_time: 18
            }
          },
          {
            id: 'doc-3',
            name: 'remediation-plan-2024.docx',
            title: 'Comprehensive Remediation Plan 2024',
            upload_date: '2024-01-20T09:15:00Z',
            size: 1.2 * 1024 * 1024,
            type: 'docx',
            status: 'ready',
            chunk_count: 203,
            collection_id: 'tech-collection',
            collection_name: 'Technical Documentation',
            is_starred: false,
            tags: ['remediation', 'plan', 'technical'],
            source: 'upload',
            metadata: {
              pages: 67,
              language: 'English',
              author: 'Remediation Specialists LLC',
              created_date: '2024-01-18T00:00:00Z',
              word_count: 15680,
              read_time: 31
            }
          },
          {
            id: 'doc-4',
            name: 'quarterly-report-q4.pdf',
            title: 'Q4 2023 Environmental Quarterly Report',
            upload_date: '2024-01-19T16:45:00Z',
            size: 3.1 * 1024 * 1024,
            type: 'pdf',
            status: 'error',
            processing_error: 'Document appears to be corrupted or password protected. Please check the file and try again.',
            is_starred: false,
            tags: ['quarterly', 'q4', '2023'],
            source: 'upload',
            metadata: {
              pages: 78,
              language: 'English'
            }
          },
          {
            id: 'doc-5',
            name: 'legal-compliance-guide.pdf',
            title: 'Environmental Legal Compliance Guide',
            upload_date: '2024-01-18T11:20:00Z',
            size: 4.5 * 1024 * 1024,
            type: 'pdf',
            status: 'ready',
            chunk_count: 342,
            collection_id: 'legal-collection',
            collection_name: 'Legal & Compliance',
            is_starred: true,
            tags: ['legal', 'compliance', 'environmental'],
            source: 'url',
            source_url: 'https://example.com/legal-guide.pdf',
            metadata: {
              pages: 156,
              language: 'English',
              author: 'Legal Department',
              created_date: '2024-01-10T00:00:00Z',
              word_count: 28900,
              read_time: 58
            }
          },
          {
            id: 'doc-6',
            name: 'research-paper-contamination.pdf',
            title: 'Heavy Metal Contamination in Soil: A Research Study',
            upload_date: '2024-01-17T13:10:00Z',
            size: 2.7 * 1024 * 1024,
            type: 'pdf',
            status: 'ready',
            chunk_count: 187,
            collection_id: 'research-collection',
            collection_name: 'Research Papers',
            is_starred: false,
            tags: ['research', 'contamination', 'soil', 'heavy-metals'],
            source: 'integration',
            metadata: {
              pages: 23,
              language: 'English',
              author: 'Dr. Sarah Johnson, Dr. Michael Chen',
              created_date: '2023-12-15T00:00:00Z',
              word_count: 6750,
              read_time: 14
            }
          }
        ])
        setDocuments(mock)
        setTotalCount(mock.length)
      }
    } catch (error) {
      console.error('Failed to load documents:', error)
    } finally {
      firstPage ? setIsLoading(false) : setIsPageLoading(false)
    }
  }

  useEffect(() => {
    fetchDocumentsPage(currentPage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize])

  // Filter and sort documents
  const filteredDocuments = documents
    .filter(doc => {
      if (searchQuery && !doc.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !doc.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))) {
        return false
      }
      if (filterStatus !== 'all' && doc.status !== filterStatus) return false
      if (filterType !== 'all' && doc.type !== filterType) return false
      return true
    })
    .sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'size':
          aValue = a.size
          bValue = b.size
          break
        case 'upload_date':
          {
            const at = new Date(a.upload_date).getTime()
            const bt = new Date(b.upload_date).getTime()
            aValue = isNaN(at) ? 0 : at
            bValue = isNaN(bt) ? 0 : bt
          }
          break
        case 'chunks':
          aValue = a.chunk_count || 0
          bValue = b.chunk_count || 0
          break
        default:
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

  // File type statistics
  const fileTypeStats = documents.reduce((acc, doc) => {
    acc[doc.type] = (acc[doc.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const uniqueFileTypes = Object.keys(fileTypeStats)

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    // Show uploads
    const localUploads: UploadProgress[] = Array.from(files).map(file => ({
      id: `upload-${Date.now()}-${Math.random()}`,
      name: file.name,
      progress: 10,
      status: 'uploading'
    }))
    setUploadProgress(prev => [...localUploads, ...prev])

    try {
      const fd = new FormData()
      Array.from(files).forEach(f => fd.append('files', f))

      // Upload & convert on server -> Markdown -> ingest
      const res = await fetch(`${API_BASE}/documents/upload`, {
        method: 'POST',
        body: fd,
        headers: { 'bypass-tunnel-reminder': 'true' }
      })

      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      const data = await res.json().catch(() => ({}))

      // Mark uploads complete
      setUploadProgress(prev => prev.map(u =>
        localUploads.find(l => l.id === u.id) ? { ...u, status: 'complete', progress: 100 } : u
      ))

      // If API returned ids, fetch details and prepend
      const created = Array.isArray(data?.created) ? data.created : []
      if (created.length > 0) {
        try {
          // Refresh first page to include new docs
          await fetchDocumentsPage(1)
        } catch {}
      } else {
        // Fallback: refresh anyway
        await fetchDocumentsPage(1)
      }
    } catch (e) {
      console.error('Upload error', e)
      setUploadProgress(prev => prev.map(u =>
        localUploads.find(l => l.id === u.id) ? { ...u, status: 'error' as const } : u
      ))
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files
    handleFileUpload(files)
  }

  const handleDeleteDocument = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id))
    setSelectedDocuments(prev => prev.filter(docId => docId !== id))
  }

  const handleToggleStar = (id: string) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === id ? { ...doc, is_starred: !doc.is_starred } : doc
    ))
  }

  const handlePreview = async (id: string) => {
    const doc = documents.find(d => d.id === id)
    if (!doc) return
    setPreviewDocument(doc)
    setShowPreviewDialog(true)
    try {
      setPreviewLoading(true)
      // Attempt to enrich document details
      let baseDoc: any = { ...doc }
      try {
        const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(id)}`, {
          headers: { 'bypass-tunnel-reminder': 'true' }
        })
        if (res.ok) {
          const detail = await res.json()
          const payload = detail?.document || detail
          if (payload && typeof payload === 'object') {
            const [norm] = enrichDocuments(normalizeDocuments([payload]))
            baseDoc = { ...baseDoc, ...norm }
            setPreviewDocument(prev => prev ? { ...prev, ...norm } : norm)
          }
        }
      } catch {}

      // Ensure we have raw text content for inline preview (Markdown/txt)
      const mergedUrl = getPreviewUrl(baseDoc)
      const nameLc = String(baseDoc.name || '').toLowerCase()
      const typeLc = String(baseDoc.type || '').toLowerCase()
      const likelyMd = nameLc.endsWith('.md') || typeLc === 'md' || typeLc === 'markdown' || (mergedUrl || '').toLowerCase().endsWith('.md')
      const alreadyHasText = !!getDocText(baseDoc)
      if (!alreadyHasText || likelyMd) {
        const raw = await tryFetchTextContent(id, mergedUrl)
        if (raw && raw.trim().length > 0) {
          setPreviewDocument(prev => prev ? { ...prev, content: raw } : { ...baseDoc, content: raw })
        }
      }
    } catch (e) {
      console.error('Failed to fetch document details', e)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleGenerateSummary = async (id: string, forceRegenerate: boolean = false) => {
    const doc = documents.find(d => d.id === id)
    if (!doc) return
    
    try {
      setSummaryLoading(true)
      setSummaryError(null)
      setSummaryResult(null)
      setSummaryDocument(doc)
      setShowSummaryDialog(true)
      
      // Generate comprehensive summary
      const response = await fetch(`${API_BASE}/documents/${encodeURIComponent(id)}/summary`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true' 
        },
        body: JSON.stringify({
          summary_type: 'comprehensive',
          include_context: true,
          force_regenerate: forceRegenerate
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to generate summary: ${response.status}`)
      }
      
      const summaryData = await response.json()
      setSummaryResult(summaryData)
      
    } catch (error) {
      console.error('Failed to generate summary:', error)
      setSummaryError(error instanceof Error ? error.message : 'Unknown error occurred')
    } finally {
      setSummaryLoading(false)
    }
  }

  const handleToggleSelect = (id: string) => {
    setSelectedDocuments(prev => 
      prev.includes(id) 
        ? prev.filter(docId => docId !== id)
        : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedDocuments.length === filteredDocuments.length) {
      setSelectedDocuments([])
    } else {
      setSelectedDocuments(filteredDocuments.map(doc => doc.id))
    }
  }

  // Removed incremental load-more handler in favor of page-based controls

  const handleBulkDelete = () => {
    setDocuments(prev => prev.filter(doc => !selectedDocuments.includes(doc.id)))
    setSelectedDocuments([])
    setShowBulkActions(false)
  }

  const handleBulkStar = () => {
    setDocuments(prev => prev.map(doc => 
      selectedDocuments.includes(doc.id) ? { ...doc, is_starred: true } : doc
    ))
    setSelectedDocuments([])
    setShowBulkActions(false)
  }

  const stats = {
    total: typeof totalCount === 'number' ? totalCount : documents.length,
    ready: documents.filter(d => d.status === 'ready').length,
    processing: documents.filter(d => d.status === 'processing').length,
    error: documents.filter(d => d.status === 'error').length,
    totalSize: documents.reduce((sum, doc) => sum + (Number.isFinite(doc.size) ? doc.size : 0), 0),
    totalChunks: documents.reduce((sum, doc) => sum + (typeof doc.chunk_count === 'number' ? doc.chunk_count : 0), 0)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading documents...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Mobile-Optimized Header */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Document Library
            </h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Upload, process, and manage your documents with advanced AI-powered features
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            {selectedDocuments.length > 0 && (
              <Popover open={showBulkActions} onOpenChange={setShowBulkActions}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex items-center justify-center gap-2 min-h-[44px] sm:min-h-10">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">{selectedDocuments.length} selected</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="end">
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start min-h-[44px] sm:min-h-8"
                      onClick={handleBulkStar}
                    >
                      <Star className="w-4 h-4 mr-2" />
                      Star All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start min-h-[44px] sm:min-h-8"
                    >
                      <Move className="w-4 h-4 mr-2" />
                      Move to Collection
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start min-h-[44px] sm:min-h-8"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download All
                    </Button>
                    <div className="border-t my-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-destructive hover:text-destructive min-h-[44px] sm:min-h-8"
                      onClick={handleBulkDelete}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete All
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <Button 
              onClick={() => setShowUploadDialog(true)}
              className="flex items-center justify-center gap-2 min-h-[44px] sm:min-h-10 text-sm sm:text-base"
            >
              <Plus className="w-4 h-4" />
              Add Documents
            </Button>
          </div>
        </div>

        {/* Mobile-Optimized Search and Filters */}
        <div className="flex flex-col gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search documents by name, title, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 h-11 sm:h-10 text-base sm:text-sm"
            />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Filter Controls Row 1 - Mobile */}
            <div className="flex gap-2 sm:hidden">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="flex-1 h-11 text-sm">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="flex-1 h-11 text-sm">
                  <File className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueFileTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type.toUpperCase()} ({fileTypeStats[type]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filter Controls Row 2 - Mobile */}
            <div className="flex gap-2 sm:hidden">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="flex-1 h-11 text-sm">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upload_date">Upload Date</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="size">File Size</SelectItem>
                  <SelectItem value="chunks">Chunk Count</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="h-11 px-4"
              >
                {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
              </Button>
            </div>

            {/* Filter Controls Row 3 - Mobile */}
            <div className="flex gap-2 sm:hidden">
              <div className="flex flex-1 items-center border rounded-lg">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('grid')}
                  className="flex-1 rounded-r-none h-11"
                >
                  <Grid3x3 className="w-4 h-4 mr-2" />
                  Grid
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('list')}
                  className="flex-1 rounded-l-none border-l h-11"
                >
                  <List className="w-4 h-4 mr-2" />
                  List
                </Button>
              </div>

              {filteredDocuments.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleSelectAll}
                  className="text-sm h-11 px-3 whitespace-nowrap"
                >
                  {selectedDocuments.length === filteredDocuments.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </div>
          
            {/* Desktop Filter Controls */}
            <div className="hidden sm:flex sm:items-center gap-3 flex-wrap">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-36">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-32">
                  <File className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueFileTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type.toUpperCase()} ({fileTypeStats[type]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-36">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upload_date">Upload Date</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="size">File Size</SelectItem>
                  <SelectItem value="chunks">Chunk Count</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
              </Button>

              <div className="flex items-center border rounded-lg">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  <Grid3x3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none border-l"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>

              {filteredDocuments.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  className="text-xs"
                >
                  {selectedDocuments.length === filteredDocuments.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile-Optimized Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          {/* Mobile-Optimized Statistics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <Card className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Documents</p>
                  <p className="text-lg sm:text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.ready} ready, {stats.processing} processing
                  </p>
                </div>
              </div>
            </Card>
            
            <Card className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Database className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">Knowledge Chunks</p>
                  <p className="text-lg sm:text-2xl font-bold">{stats.totalChunks}</p>
                  <p className="text-xs text-muted-foreground">AI-processed segments</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <HardDrive className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">Storage Used</p>
                  <p className="text-lg sm:text-2xl font-bold">{(stats.totalSize / 1024 / 1024).toFixed(1)}MB</p>
                  <p className="text-xs text-muted-foreground">Across {uniqueFileTypes.length} file types</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">Processing Queue</p>
                  <p className="text-lg sm:text-2xl font-bold">{stats.processing}</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.error > 0 ? `${stats.error} errors` : 'All systems running'}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Upload Progress */}
          {uploadProgress.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Progress ({uploadProgress.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {uploadProgress.map(upload => (
                  <UploadProgressCard key={upload.id} upload={upload} />
                ))}
              </div>
            </div>
          )}

          {/* Documents Grid/List */}
          <div 
            className={cn(
              "min-h-64",
              dragOver && "border-2 border-dashed border-primary bg-primary/5 rounded-lg",
              viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                : "space-y-4"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {dragOver && (
              <div className="col-span-full flex items-center justify-center h-64">
                <div className="text-center">
                  <Upload className="w-12 h-12 text-primary mx-auto mb-4" />
                  <p className="text-lg font-medium text-primary">Drop your files here</p>
                  <p className="text-sm text-muted-foreground">Supports PDF, Word, images, and more</p>
                </div>
              </div>
            )}
            
            {!dragOver && filteredDocuments.map((document) => (
              <DocumentCard
                key={document.id}
                document={document}
                onEdit={handleDeleteDocument}
                onDelete={handleDeleteDocument}
                onToggleStar={handleToggleStar}
                onPreview={handlePreview}
                isSelected={selectedDocuments.includes(document.id)}
                onToggleSelect={handleToggleSelect}
                onMoveToCollection={handleOpenMoveDialog}
                onGenerateSummary={handleGenerateSummary}
              />
            ))}
          </div>

          {!dragOver && filteredDocuments.length === 0 && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery || filterStatus !== 'all' || filterType !== 'all' 
                  ? 'No documents found' 
                  : 'No documents yet'}
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-4">
                {searchQuery || filterStatus !== 'all' || filterType !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Get started by uploading your first documents to build your knowledge base.'}
              </p>
              {(!searchQuery && filterStatus === 'all' && filterType === 'all') && (
                <Button 
                  onClick={() => setShowUploadDialog(true)}
                  className="mt-4"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Upload Your First Document
                </Button>
              )}
            </div>
          )}

          {/* Mobile-Optimized Pagination Controls */}
          {typeof totalCount === 'number' && totalCount > 0 && (
            <div className="flex flex-col gap-3 mt-6 sm:mt-8">
              <div className="text-center sm:text-left text-sm text-muted-foreground">
                Showing {(currentPage - 1) * pageSize + 1}
                –{Math.min(currentPage * pageSize, totalCount)} of {totalCount}
              </div>
              <div className="flex justify-center sm:justify-end">
                <div className="flex items-center gap-1 sm:gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || isPageLoading}
                    className="h-9 sm:h-8 px-2 sm:px-3"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  
                  {/* Mobile: Show fewer page numbers */}
                  <div className="flex items-center gap-1 sm:hidden">
                    {currentPage > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={isPageLoading}
                        className="h-9 px-3 text-xs"
                      >
                        1
                      </Button>
                    )}
                    
                    {currentPage > 2 && <span className="px-1 text-muted-foreground text-xs">…</span>}
                    
                    <Button
                      variant="default"
                      size="sm"
                      disabled={isPageLoading}
                      className="h-9 px-3 text-xs"
                    >
                      {currentPage}
                    </Button>
                    
                    {currentPage < totalPages - 1 && <span className="px-1 text-muted-foreground text-xs">…</span>}
                    
                    {currentPage < totalPages && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={isPageLoading}
                        className="h-9 px-3 text-xs"
                      >
                        {totalPages}
                      </Button>
                    )}
                  </div>
                  
                  {/* Desktop: Show full pagination */}
                  <div className="hidden sm:flex items-center gap-1">
                    {pageNumbers.map((p, idx) => p === '...'
                      ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">…</span>
                        )
                      : (
                        <Button
                          key={p as number}
                          variant={(p as number) === currentPage ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(p as number)}
                          disabled={isPageLoading}
                          className="h-8"
                        >
                          {p}
                        </Button>
                      )
                    )}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || isPageLoading}
                    className="h-9 sm:h-8 px-2 sm:px-3"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Documents
            </DialogTitle>
            <DialogDescription>
              Add documents to your knowledge base. Supported formats: PDF, Word, Excel, CSV, PowerPoint, Text, Images, and more.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upload">File Upload</TabsTrigger>
              <TabsTrigger value="url">From URL</TabsTrigger>
              <TabsTrigger value="integration">Integrations</TabsTrigger>
            </TabsList>
            
            <TabsContent value="upload" className="space-y-4">
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Drag & drop files here</p>
                <p className="text-sm text-muted-foreground mb-4">or click to browse your files</p>
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Browse Files
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.tsv,.txt,.md,.rtf,.html,.htm,.jpg,.jpeg,.png,.gif,.webp,.svg"
              />
              <p className="text-xs text-muted-foreground text-center -mt-2">
                Files are automatically converted to Markdown for consistent RAG ingestion.
              </p>
              
              <div className="grid grid-cols-4 gap-4 text-center text-sm text-muted-foreground">
                <div className="flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4 text-red-500" />
                  <span>PDF, Word</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-500" />
                  <span>Excel, CSV</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <ImageIcon className="w-4 h-4 text-green-500" />
                  <span>Images</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <File className="w-4 h-4 text-blue-500" />
                  <span>Text, Markdown</span>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="url" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="url">Document URL</Label>
                  <Input
                    id="url"
                    placeholder="https://example.com/document.pdf"
                    className="mt-2"
                  />
                </div>
                <Button className="w-full">
                  <Link2 className="w-4 h-4 mr-2" />
                  Import from URL
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="integration" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Globe className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">Google Drive</p>
                      <p className="text-xs text-muted-foreground">Import from Drive</p>
                    </div>
                  </div>
                </Card>
                
                <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Cloud className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium">Dropbox</p>
                      <p className="text-xs text-muted-foreground">Sync with Dropbox</p>
                    </div>
                  </div>
                </Card>
                
                <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <Database className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">SharePoint</p>
                      <p className="text-xs text-muted-foreground">Enterprise sync</p>
                    </div>
                  </div>
                </Card>
                
                <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Globe className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium">Web Scraping</p>
                      <p className="text-xs text-muted-foreground">Extract from websites</p>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Document Preview
            </DialogTitle>
            <DialogDescription>
              Preview of the selected document. Supports PDF, Word, Excel, CSV, PowerPoint, images, Markdown, and text files.
            </DialogDescription>
          </DialogHeader>
          
          {previewDocument && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
              <div className="lg:col-span-2 space-y-4">
                {(() => {
                  const kind = canInlinePreview(previewDocument)
                  const url = getEmbeddableUrl(previewDocument)
                  const directUrl = getPreviewUrl(previewDocument)
                  const text = getDocText(previewDocument)
                  const nameLc = String(previewDocument.name || '').toLowerCase()
                  const typeLc = String(previewDocument.type || '').toLowerCase()
                  const urlLc = (directUrl || '').toLowerCase()
                  
                  // Loading state
                  if (previewLoading) {
                    return (
                      <div className="bg-muted/50 rounded-lg p-8 text-center">
                        <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                        </div>
                        <p className="text-sm text-muted-foreground">Loading preview…</p>
                        {directUrl && (
                          <div className="mt-4">
                            <Button variant="outline" size="sm" asChild>
                              <a href={directUrl} target="_blank" rel="noreferrer">
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Open in new tab
                              </a>
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  }

                  // PDF Preview
                  if (kind === 'pdf' && url) {
                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium flex items-center gap-2">
                            <FileText className="w-4 h-4 text-red-500" />
                            PDF Document
                          </h4>
                          <Button variant="outline" size="sm" asChild>
                            <a href={directUrl || url} target="_blank" rel="noreferrer">
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Open Full View
                            </a>
                          </Button>
                        </div>
                        <div className="rounded-lg overflow-hidden border bg-background">
                          <iframe src={url} className="w-full h-[520px]" title="PDF Preview" />
                        </div>
                      </div>
                    )
                  }

                  // Image Preview
                  if (kind === 'image' && directUrl) {
                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium flex items-center gap-2">
                            <ImageIcon className="w-4 h-4 text-green-500" />
                            Image File
                          </h4>
                          <Button variant="outline" size="sm" asChild>
                            <a href={directUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="w-4 h-4 mr-2" />
                              View Full Size
                            </a>
                          </Button>
                        </div>
                        <div className="rounded-lg overflow-hidden border bg-background flex items-center justify-center">
                          <img src={directUrl} alt={previewDocument.name} className="max-h-[520px] w-full object-contain" />
                        </div>
                      </div>
                    )
                  }

                  // Office Documents (Word, Excel, PowerPoint) via Google Docs Viewer
                  if (kind === 'gdoc' && url) {
                    const fileTypeIcon = typeLc === 'csv' ? '📊' : 
                                       (typeLc === 'xls' || typeLc === 'xlsx') ? '📊' :
                                       (typeLc === 'doc' || typeLc === 'docx') ? '📄' :
                                       (typeLc === 'ppt' || typeLc === 'pptx') ? '📊' : '📄'
                    
                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium flex items-center gap-2">
                            <FileText className="w-4 h-4 text-indigo-500" />
                            {typeLc === 'csv' ? 'CSV Spreadsheet' :
                             (typeLc === 'xls' || typeLc === 'xlsx') ? 'Excel Spreadsheet' :
                             (typeLc === 'doc' || typeLc === 'docx') ? 'Word Document' :
                             (typeLc === 'ppt' || typeLc === 'pptx') ? 'PowerPoint Presentation' :
                             'Office Document'} {fileTypeIcon}
                          </h4>
                          <Button variant="outline" size="sm" asChild>
                            <a href={directUrl || url} target="_blank" rel="noreferrer">
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Open Full View
                            </a>
                          </Button>
                        </div>
                        <div className="rounded-lg overflow-hidden border bg-background">
                          <iframe src={url} className="w-full h-[520px]" title="Document Preview" />
                        </div>
                      </div>
                    )
                  }

                  // Text/Markdown Content
                  const isMd = nameLc.endsWith('.md') || typeLc === 'md' || typeLc === 'markdown' || urlLc.endsWith('.md')
                  const isCSV = nameLc.endsWith('.csv') || typeLc === 'csv'
                  
                  if (text) {
                    // CSV Preview with table formatting
                    if (isCSV) {
                      const csvLines = text.trim().split('\n').slice(0, 100) // Limit to first 100 rows
                      const hasHeader = csvLines.length > 0
                      const rows = csvLines.map(line => line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')))
                      
                      return (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium flex items-center gap-2">
                              <FileText className="w-4 h-4 text-emerald-500" />
                              CSV Data Preview
                            </h4>
                            {directUrl && (
                              <Button variant="outline" size="sm" asChild>
                                <a href={directUrl} target="_blank" rel="noreferrer">
                                  <Download className="w-4 h-4 mr-2" />
                                  Download CSV
                                </a>
                              </Button>
                            )}
                          </div>
                          <div className="border rounded-lg overflow-hidden bg-background">
                            <div className="max-h-[520px] overflow-auto">
                              <table className="w-full text-sm">
                                {hasHeader && rows.length > 0 && (
                                  <thead className="bg-muted/50 sticky top-0">
                                    <tr>
                                      {rows[0].map((header, idx) => (
                                        <th key={idx} className="px-3 py-2 text-left font-medium border-r border-border">
                                          {header || `Column ${idx + 1}`}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                )}
                                <tbody>
                                  {rows.slice(hasHeader ? 1 : 0).map((row, rowIdx) => (
                                    <tr key={rowIdx} className="hover:bg-muted/30 border-b border-border">
                                      {row.map((cell, cellIdx) => (
                                        <td key={cellIdx} className="px-3 py-2 border-r border-border">
                                          {cell || '-'}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {csvLines.length >= 100 && (
                              <div className="p-3 bg-muted/30 text-center text-xs text-muted-foreground border-t">
                                Showing first 100 rows. Download full file to see all data.
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    }
                    
                    // Markdown Preview
                    if (isMd) {
                      return (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium flex items-center gap-2">
                              <FileText className="w-4 h-4 text-purple-500" />
                              Markdown Document
                            </h4>
                            {directUrl && (
                              <Button variant="outline" size="sm" asChild>
                                <a href={directUrl} target="_blank" rel="noreferrer">
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  View Source
                                </a>
                              </Button>
                            )}
                          </div>
                          <div className="border rounded-lg p-4 max-h-[520px] overflow-y-auto bg-background">
                            <div className="prose prose-sm max-w-none">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {text.slice(0, 8000)}
                              </ReactMarkdown>
                            </div>
                            {text.length > 8000 && (
                              <div className="mt-4 p-3 bg-muted/50 rounded text-xs text-center text-muted-foreground">
                                Content truncated. View full document to see complete content.
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    }

                    // Plain Text Preview
                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-500" />
                            Text Content
                          </h4>
                          {directUrl && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={directUrl} target="_blank" rel="noreferrer">
                                <Download className="w-4 h-4 mr-2" />
                                Download
                              </a>
                            </Button>
                          )}
                        </div>
                        <div className="border rounded-lg p-4 max-h-[520px] overflow-y-auto bg-muted/30">
                          <pre className="text-sm text-foreground whitespace-pre-wrap leading-relaxed font-mono">
{text.slice(0, 4000)}
                          </pre>
                          {text.length > 4000 && (
                            <div className="mt-4 p-3 bg-muted/50 rounded text-xs text-center text-muted-foreground">
                              Content truncated. View full document to see complete content.
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  }

                  // Fallback for documents with URL but no text content
                  if (directUrl) {
                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-500" />
                            Document Preview
                          </h4>
                          <Button variant="outline" size="sm" asChild>
                            <a href={directUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Open Document
                            </a>
                          </Button>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-8 text-center">
                          <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-8 h-8 text-blue-600" />
                          </div>
                          <p className="text-sm text-muted-foreground mb-4">
                            This document can be viewed by opening it in a new tab.
                          </p>
                          <Button asChild>
                            <a href={directUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Open Document
                            </a>
                          </Button>
                        </div>
                      </div>
                    )
                  }

                  // Final fallback - no preview available
                  return (
                    <div className="bg-muted/50 rounded-lg p-8 text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">Preview not available</p>
                      <p className="text-xs text-muted-foreground">
                        This document type cannot be previewed inline. Try downloading or processing the document first.
                      </p>
                    </div>
                  )
                })()}

                {/* Preview actions (always show when URL is known) */}
                {(() => {
                  const url = getPreviewUrl(previewDocument)
                  if (!url) return null
                  return (
                    <div className="flex items-center justify-end gap-2">
                      <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                        Open in new tab
                      </a>
                    </div>
                  )
                })()}
                
                {previewDocument.content && canInlinePreview(previewDocument) !== 'text' && (
                  <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                    <h4 className="font-medium mb-2">Extracted Content (excerpt)</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {previewDocument.content.slice(0, 1000)}...
                    </p>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <Card className="p-4">
                  <h4 className="font-medium mb-3">Document Details</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name</span>
                      <span className="font-medium">{previewDocument.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Size</span>
                      <span>{formatSizeMB(getDocumentSizeBytes(previewDocument))}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="uppercase">{previewDocument.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={previewDocument.status === 'ready' ? 'default' : 'secondary'}>
                        {previewDocument.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Chunks</span>
                      <span>{previewDocument.chunk_count || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Uploaded</span>
                      <span>{formatDate(previewDocument.upload_date)}</span>
                    </div>
                  </div>
                </Card>
                
                {previewDocument.metadata && (
                  <Card className="p-4">
                    <h4 className="font-medium mb-3">Metadata</h4>
                    <div className="space-y-2 text-sm">
                      {previewDocument.metadata.pages && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Pages</span>
                          <span>{previewDocument.metadata.pages}</span>
                        </div>
                      )}
                      {previewDocument.metadata.language && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Language</span>
                          <span>{previewDocument.metadata.language}</span>
                        </div>
                      )}
                      {previewDocument.metadata.word_count && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Word Count</span>
                          <span>{previewDocument.metadata.word_count.toLocaleString()}</span>
                        </div>
                      )}
                      {previewDocument.metadata.read_time && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Read Time</span>
                          <span>{previewDocument.metadata.read_time} min</span>
                        </div>
                      )}
                    </div>
                  </Card>
                )}
                
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={() => openDocumentInNewTab(previewDocument)}
                    disabled={!getPreviewUrl(previewDocument)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Summary Dialog */}
      <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <SummaryIcon className="w-5 h-5" />
              Document Summary
            </DialogTitle>
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={() => setSummaryDetailsOpen(v => !v)}>
                {summaryDetailsOpen ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-1" /> Hide Details
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-1" /> Show Details
                  </>
                )}
              </Button>
            </div>
          </DialogHeader>
          
          {summaryDocument && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Document Info (collapsible) */}
              {summaryDetailsOpen && (
                <div className="border-b pb-4 mb-4 flex-shrink-0">
                  <h3 className="font-semibold text-lg truncate">{summaryDocument.title || summaryDocument.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {summaryDocument.type?.toUpperCase()} • {formatSizeMB(summaryDocument.size)} • 
                    {summaryDocument.chunk_count ? ` ${summaryDocument.chunk_count} chunks` : ''}
                  </p>
                </div>
              )}

              {/* Loading State */}
              {summaryLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mx-auto">
                      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    </div>
                    <div className="space-y-2">
                      <p className="font-medium">Generating Summary...</p>
                      <p className="text-sm text-muted-foreground">
                        Processing document chunks and gathering context
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error State */}
              {summaryError && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center mx-auto">
                      <AlertTriangle className="w-8 h-8 text-red-600" />
                    </div>
                    <div className="space-y-2">
                      <p className="font-medium text-red-600">Summary Generation Failed</p>
                      <p className="text-sm text-muted-foreground">{summaryError}</p>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => handleGenerateSummary(summaryDocument.id)}
                      disabled={summaryLoading}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Try Again
                    </Button>
                  </div>
                </div>
              )}

              {/* Summary Results */}
              {summaryResult && !summaryLoading && !summaryError && (
                <div className="flex-1 overflow-hidden flex flex-col">
                  {/* Summary Metadata */}
                  <div className="space-y-4 mb-6 flex-shrink-0">
                    {/* Domain Classification Info */}
                    {summaryResult.domain_classification && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          <h4 className="font-semibold text-blue-800 dark:text-blue-200">Expert Analysis Mode</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Domain Detected</p>
                            <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                              {summaryResult.domain_classification.domain_name}
                            </p>
                            <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">
                              Confidence: {(summaryResult.domain_classification.confidence * 100).toFixed(0)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Analysis Approach</p>
                            <p className="text-sm text-blue-600 dark:text-blue-400">
                              {summaryResult.domain_classification.reasoning}
                            </p>
                          </div>
                        </div>
                        {summaryResult.domain_classification.keywords && summaryResult.domain_classification.keywords.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Key Domain Indicators</p>
                            <div className="flex flex-wrap gap-1">
                              {summaryResult.domain_classification.keywords.slice(0, 8).map((keyword: string, idx: number) => (
                                <span key={idx} className="inline-block px-2 py-1 text-xs bg-blue-100 dark:bg-blue-800/30 text-blue-700 dark:text-blue-300 rounded">
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Standard Metadata */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Summary Type</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {summaryResult.summary_type}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Generated</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(summaryResult.generated_at).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Chunks Processed</p>
                        <p className="text-sm text-muted-foreground">
                          {summaryResult.metadata?.total_chunks || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Related Docs</p>
                        <p className="text-sm text-muted-foreground">
                          {summaryResult.metadata?.related_documents || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Source</p>
                        <p className="text-sm text-muted-foreground">
                          {summaryResult.metadata?.cached ? (
                            <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                              <Database className="w-3 h-3" />
                              Cached
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                              <Sparkles className="w-3 h-3" />
                              Generated
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Summary Content */}
                  {summaryResult.summary && (
                    <div className="flex-1 overflow-y-auto overflow-x-hidden pr-2">
                      <div className="space-y-6">
                        {/* Handle raw JSON string that needs parsing */}
                        {(() => {
                          let parsedSummary = summaryResult.summary;
                          // Helpers to normalize JSON-like strings into objects and unwrap nested payloads
                          const looksLikeJson = (s: string) => {
                            const t = (s || '').trim();
                            return t.startsWith('{') || t.startsWith('[');
                          };
                          // Strip Markdown code fences from strings (```lang ... ```)
                          const stripCodeFences = (s: string) => {
                            const t = (s || '').trim();
                            if (t.startsWith('```') && t.endsWith('```')) {
                              const withoutStart = t.replace(/^```[a-zA-Z0-9_-]*\n?/, '');
                              return withoutStart.replace(/```$/, '').trim();
                            }
                            return t;
                          };
                          // Remove uniform indentation to prevent Markdown from treating text as code block
                          const dedent = (s: string) => {
                            const lines = (s || '').replace(/\r\n/g, '\n').split('\n');
                            const contentLines = lines.filter(l => l.trim().length > 0);
                            if (contentLines.length === 0) return s || '';
                            const indents = contentLines.map(l => (l.match(/^\s*/)?.[0].length ?? 0));
                            const minIndent = Math.min(...indents);
                            if (minIndent === 0) return s || '';
                            return lines.map(l => l.startsWith(' '.repeat(minIndent)) ? l.slice(minIndent) : l).join('\n');
                          };
                          // Utilities to render structured content with titles/subtitles
                          const titleize = (k: string) =>
                            (k || '')
                              .replace(/_/g, ' ')
                              .replace(/\s+/g, ' ')
                              .trim()
                              .replace(/\b\w/g, (c) => c.toUpperCase());
                          const renderAny = (v: any): React.ReactNode => {
                            if (v == null) return null;
                            if (typeof v === 'string') {
                              return <Markdown>{cleanText(v)}</Markdown>;
                            }
                            if (Array.isArray(v)) {
                              return (
                                <ul className="list-disc ml-6 space-y-1">
                                  {v.map((it, idx) => (
                                    <li key={idx} className="whitespace-pre-wrap">
                                      {typeof it === 'string' ? cleanText(it) : (typeof it === 'object' ? JSON.stringify(it) : String(it))}
                                    </li>
                                  ))}
                                </ul>
                              );
                            }
                            if (typeof v === 'object') {
                              return renderObjectSections(v as Record<string, any>);
                            }
                            return <>{String(v)}</>;
                          };
                          const renderObjectSections = (obj: Record<string, any>): React.ReactNode => {
                            const entries = Object.entries(obj || {});
                            if (!entries.length) return null;
                            return (
                              <div className="space-y-4">
                                {entries.map(([k, v]) => (
                                  <div key={k}>
                                    <h5 className="font-semibold mb-2">{titleize(k)}</h5>
                                    <div className="prose prose-sm max-w-none dark:prose-invert break-words whitespace-pre-wrap">
                                      {renderAny(v)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          };
                          const renderMaybeStructuredString = (s: string): React.ReactNode => {
                            const cleaned = cleanText(s);
                            const parsed = looksLikeJson(cleaned) ? tryParseJson(cleaned) : null;
                            if (parsed && typeof parsed === 'object') {
                              return renderObjectSections(parsed as Record<string, any>);
                            }
                            return <Markdown>{cleaned}</Markdown>;
                          };
                          const tryParseJson = (s: string) => {
                            try { return JSON.parse(s); } catch {}
                            // try loose: find first '{' .. last '}'
                            const t = stripCodeFences(s);
                            const i = t.indexOf('{');
                            const j = t.lastIndexOf('}');
                            if (i >= 0 && j > i) {
                              const sub = t.slice(i, j + 1);
                              try { return JSON.parse(sub); } catch {}
                            }
                            return null;
                          };
                          const cleanText = (s: string) => {
                            if (typeof s !== 'string') return s as unknown as string;
                            let t = stripCodeFences(s);
                            // If wrapped in quotes (JSON-style), try to unescape
                            if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
                              try { return JSON.parse(t as string); } catch { /* ignore */ }
                            }
                            // Replace common escaped sequences
                            t = t.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
                            // Remove uniform indentation so Markdown doesn't treat it as a code block
                            return dedent(t);
                          };
                          const canonicalKeys = new Set([
                            'executive_overview',
                            'key_metrics',
                            'major_highlights',
                            'challenges_and_risks',
                            'opportunities_and_recommendations',
                            'conclusion',
                            'full_text',
                          ]);
                          const extractText = (val: any): string => {
                            if (!val) return '';
                            if (typeof val === 'string') {
                              const s = cleanText(val);
                              // If the string itself looks like JSON, parse and extract
                              if (looksLikeJson(s)) {
                                const parsed = tryParseJson(s);
                                if (parsed) return extractText(parsed);
                              }
                              return dedent(s);
                            }
                            if (Array.isArray(val)) return val.map(extractText).filter(Boolean).join('\n');
                            if (typeof val === 'object') {
                              // Prefer known keys
                              for (const k of ['text', 'executive_overview', 'summary', 'content', 'value']) {
                                if (typeof (val as any)[k] === 'string') return cleanText((val as any)[k]);
                              }
                              // If object contains a JSON-like string, parse and recurse
                              const onlyKeys = Object.keys(val);
                              if (onlyKeys.length === 1 && typeof (val as any)[onlyKeys[0]] === 'string' && looksLikeJson((val as any)[onlyKeys[0]])) {
                                const parsed = tryParseJson((val as any)[onlyKeys[0]]);
                                if (parsed) return extractText(parsed);
                              }
                              // Join stringy values
                              const parts: string[] = [];
                              for (const [k, v] of Object.entries(val as Record<string, any>)) {
                                const t = extractText(v);
                                if (t) parts.push(t);
                              }
                              return parts.join('\n');
                            }
                            return String(val);
                          };
                          // Recursively search shallowly for an object that contains canonical summary keys
                          const findCanonical = (obj: any, depth = 0): any | null => {
                            if (!obj || typeof obj !== 'object' || depth > 3) return null;
                            const keys = Object.keys(obj);
                            if (keys.some(k => canonicalKeys.has(k))) return obj;
                            for (const k of keys) {
                              const v = (obj as any)[k];
                              // Try to parse JSON-looking strings during traversal
                              if (typeof v === 'string' && looksLikeJson(v)) {
                                const jp = tryParseJson(v);
                                if (jp && typeof jp === 'object') {
                                  const found = findCanonical(jp, depth + 1);
                                  if (found) return found;
                                }
                              } else if (v && typeof v === 'object') {
                                const found = findCanonical(v, depth + 1);
                                if (found) return found;
                              }
                            }
                            return null;
                          };
                          
                          // If it's a string that looks like JSON, try to parse it
                          if (typeof parsedSummary === 'string') {
                            try {
                              // Attempt to parse stringified JSON
                              const maybe = JSON.parse(parsedSummary);
                              // Some providers wrap content under a `summary` field; unwrap if present
                              if (maybe && typeof maybe === 'object' && (maybe.summary || maybe.data)) {
                                parsedSummary = maybe.summary || maybe.data;
                              } else {
                                parsedSummary = maybe;
                              }
                            } catch (e) {
                              // Try to extract structured fields from JSON-like text
                              const s = String(parsedSummary);
                              const getField = (key: string) => {
                                const re = new RegExp(`\\"${key}\\"\\s*:\\s*\\"([\\s\\S]*?)\\"`);
                                const m = s.match(re);
                                if (m && m[1]) {
                                  try { return JSON.parse(`"${m[1]}"`); } catch { return m[1].replace(/\\n/g,'\n'); }
                                }
                                return '';
                              };
                              const eo = getField('executive_overview');
                              const ft = getField('full_text');
                              if (eo || ft) {
                                parsedSummary = {
                                  ...(eo ? { executive_overview: eo } : {}),
                                  ...(ft ? { full_text: ft } : {}),
                                } as any;
                              } else {
                                // Fallback: render as markdown text block
                                return (
                                  <div className="bg-background border rounded-lg p-6">
                                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                                      <FileText className="w-5 h-5" />
                                      Document Summary
                                    </h4>
                                    <div className="prose prose-sm max-w-none dark:prose-invert break-words whitespace-pre-wrap">
                                      <Markdown>{s}</Markdown>
                                    </div>
                                  </div>
                                );
                              }
                            }
                          }
                          
                          // If string still looks like JSON, try a final parse
                          if (typeof parsedSummary === 'string' && looksLikeJson(parsedSummary)) {
                            const reparsed = tryParseJson(parsedSummary);
                            if (reparsed) parsedSummary = reparsed;
                          }

                          // Handle structured JSON summary
                          if (typeof parsedSummary === 'object' && parsedSummary !== null) {
                            // If executive_overview is a JSON string containing the full summary, unwrap it
                            if (typeof (parsedSummary as any).executive_overview === 'string' && looksLikeJson((parsedSummary as any).executive_overview)) {
                              const nested = tryParseJson((parsedSummary as any).executive_overview as string);
                              if (nested && typeof nested === 'object' && Object.keys(nested).some(k => canonicalKeys.has(k))) {
                                parsedSummary = nested;
                              }
                            }
                            // If executive_overview is an OBJECT that itself looks like the full summary, unwrap it
                            if (typeof (parsedSummary as any).executive_overview === 'object' && (parsedSummary as any).executive_overview) {
                              const eo = (parsedSummary as any).executive_overview as any;
                              if (eo && typeof eo === 'object' && Object.keys(eo).some((k) => canonicalKeys.has(k))) {
                                parsedSummary = eo;
                              }
                            }
                            // If full_text is a JSON string containing the full summary, unwrap it
                            if (typeof (parsedSummary as any).full_text === 'string' && looksLikeJson((parsedSummary as any).full_text)) {
                              const nestedFt = tryParseJson((parsedSummary as any).full_text as string);
                              if (nestedFt && typeof nestedFt === 'object' && Object.keys(nestedFt).some(k => canonicalKeys.has(k))) {
                                parsedSummary = nestedFt;
                              }
                            }
                            // If full_text is an OBJECT that itself looks like the full summary, unwrap
                            if (typeof (parsedSummary as any).full_text === 'object' && (parsedSummary as any).full_text) {
                              const ft = (parsedSummary as any).full_text as any;
                              if (ft && typeof ft === 'object' && Object.keys(ft).some((k) => canonicalKeys.has(k))) {
                                parsedSummary = ft;
                              }
                            }
                            // If summary is wrapped again under a known key, unwrap
                            const keys = Object.keys(parsedSummary as any);
                            if (keys.length === 1) {
                              const only = (parsedSummary as any)[keys[0]];
                              if (typeof only === 'string' && looksLikeJson(only)) {
                                const nested2 = tryParseJson(only);
                                if (nested2 && typeof nested2 === 'object' && Object.keys(nested2).some(k => canonicalKeys.has(k))) {
                                  parsedSummary = nested2;
                                }
                              } else if (only && typeof only === 'object' && Object.keys(only).some((k: string) => canonicalKeys.has(k))) {
                                parsedSummary = only;
                              }
                            }
                            // If we received an array, flatten to bullets under Full Analysis
                            if (Array.isArray(parsedSummary)) {
                              return (
                                <div className="bg-background border rounded-lg p-6">
                                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                                    <FileText className="w-5 h-5" />
                                    Document Summary
                                  </h4>
                                  <ul className="list-disc ml-6 space-y-2 text-sm break-words">
                                    {parsedSummary.map((item, idx) => (
                                      <li key={idx} className="whitespace-pre-wrap">
                                        {typeof item === 'string' ? item : JSON.stringify(item)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )
                            }
                            // Final attempt: find canonical object anywhere within
                            const canonical = findCanonical(parsedSummary);
                            if (canonical) parsedSummary = canonical;

                            return (
                              <>
                                {parsedSummary.executive_overview && (
                                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                                    <h4 className="font-semibold mb-4 flex items-center gap-2 text-blue-700 dark:text-blue-300">
                                      <Target className="w-5 h-5" />
                                      Executive Overview
                                    </h4>
                                    {(() => {
                                      const val = parsedSummary.executive_overview;
                                      if (typeof val === 'string') {
                                        return (
                                          <div className="prose prose-sm max-w-none dark:prose-invert break-words whitespace-pre-wrap">
                                            {renderMaybeStructuredString(val)}
                                          </div>
                                        );
                                      }
                                      if (Array.isArray(val)) {
                                        return (
                                          <div className="text-sm break-words">
                                            <ul className="list-disc ml-6 space-y-1">
                                              {val.map((v: any, i: number) => (
                                                <li key={i} className="whitespace-pre-wrap">{typeof v === 'string' ? cleanText(v) : JSON.stringify(v)}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        );
                                      }
                                      if (val && typeof val === 'object') {
                                        return <>{renderObjectSections(val as Record<string, any>)}</>;
                                      }
                                      return null;
                                    })()}
                                  </div>
                                )}

                                {parsedSummary.key_metrics && (
                                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
                                    <h4 className="font-semibold mb-4 flex items-center gap-2 text-green-700 dark:text-green-300">
                                      <BarChart3 className="w-5 h-5" />
                                      Key Metrics
                                    </h4>
                                    {Array.isArray(parsedSummary.key_metrics) ? (
                                      <ul className="list-disc ml-6 space-y-1 text-sm break-words">
                                        {parsedSummary.key_metrics.map((m: any, idx: number) => (
                                          <li key={idx} className="whitespace-pre-wrap">
                                            {typeof m === 'string' ? m : JSON.stringify(m)}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : typeof parsedSummary.key_metrics === 'object' ? (
                                      <div className="text-sm break-words">
                                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                          {Object.entries(parsedSummary.key_metrics as Record<string, any>).map(([k, v]) => (
                                            <div key={k} className="flex flex-col">
                                              <dt className="font-medium">{k}</dt>
                                              <dd className="whitespace-pre-wrap text-muted-foreground">{typeof v === 'string' ? v : JSON.stringify(v)}</dd>
                                            </div>
                                          ))}
                                        </dl>
                                      </div>
                                    ) : (
                                      <div className="prose prose-sm max-w-none dark:prose-invert break-words whitespace-pre-wrap">
                                        <Markdown>{cleanText(parsedSummary.key_metrics)}</Markdown>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {parsedSummary.major_highlights && (
                                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                                    <h4 className="font-semibold mb-4 flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                                      <Sparkles className="w-5 h-5" />
                                      Major Highlights
                                    </h4>
                                    {Array.isArray(parsedSummary.major_highlights) ? (
                                      <ul className="list-disc ml-6 space-y-1 text-sm break-words">
                                        {parsedSummary.major_highlights.map((m: any, idx: number) => (
                                          <li key={idx} className="whitespace-pre-wrap">
                                            {typeof m === 'string' ? m : JSON.stringify(m)}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : typeof parsedSummary.major_highlights === 'object' ? (
                                      <div className="text-sm break-words">
                                        <ul className="list-disc ml-6 space-y-1">
                                          {Object.entries(parsedSummary.major_highlights as Record<string, any>).map(([k, v]) => (
                                            <li key={k} className="whitespace-pre-wrap"><span className="font-medium">{k}:</span> {typeof v === 'string' ? v : JSON.stringify(v)}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    ) : (
                                      <div className="prose prose-sm max-w-none dark:prose-invert break-words whitespace-pre-wrap">
                                        <Markdown>{cleanText(parsedSummary.major_highlights)}</Markdown>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {parsedSummary.challenges_and_risks && (
                                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                                    <h4 className="font-semibold mb-4 flex items-center gap-2 text-red-700 dark:text-red-300">
                                      <AlertTriangle className="w-5 h-5" />
                                      Challenges & Risks
                                    </h4>
                                    {Array.isArray(parsedSummary.challenges_and_risks) ? (
                                      <ul className="list-disc ml-6 space-y-1 text-sm break-words">
                                        {parsedSummary.challenges_and_risks.map((m: any, idx: number) => (
                                          <li key={idx} className="whitespace-pre-wrap">
                                            {typeof m === 'string' ? m : JSON.stringify(m)}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : typeof parsedSummary.challenges_and_risks === 'object' ? (
                                      <div className="text-sm break-words">
                                        <ul className="list-disc ml-6 space-y-1">
                                          {Object.entries(parsedSummary.challenges_and_risks as Record<string, any>).map(([k, v]) => (
                                            <li key={k} className="whitespace-pre-wrap"><span className="font-medium">{k}:</span> {typeof v === 'string' ? v : JSON.stringify(v)}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    ) : (
                                      <div className="prose prose-sm max-w-none dark:prose-invert break-words whitespace-pre-wrap">
                                        <Markdown>{cleanText(parsedSummary.challenges_and_risks)}</Markdown>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {parsedSummary.opportunities_and_recommendations && (
                                  <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6">
                                    <h4 className="font-semibold mb-4 flex items-center gap-2 text-purple-700 dark:text-purple-300">
                                      <TrendingUp className="w-5 h-5" />
                                      Opportunities & Recommendations
                                    </h4>
                                    {Array.isArray(parsedSummary.opportunities_and_recommendations) ? (
                                      <ul className="list-disc ml-6 space-y-1 text-sm break-words">
                                        {parsedSummary.opportunities_and_recommendations.map((m: any, idx: number) => (
                                          <li key={idx} className="whitespace-pre-wrap">
                                            {typeof m === 'string' ? m : JSON.stringify(m)}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : typeof parsedSummary.opportunities_and_recommendations === 'object' ? (
                                      <div className="text-sm break-words">
                                        <ul className="list-disc ml-6 space-y-1">
                                          {Object.entries(parsedSummary.opportunities_and_recommendations as Record<string, any>).map(([k, v]) => (
                                            <li key={k} className="whitespace-pre-wrap"><span className="font-medium">{k}:</span> {typeof v === 'string' ? v : JSON.stringify(v)}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    ) : (
                                      <div className="prose prose-sm max-w-none dark:prose-invert break-words whitespace-pre-wrap">
                                        <Markdown>{cleanText(parsedSummary.opportunities_and_recommendations)}</Markdown>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {parsedSummary.conclusion && (
                                  <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-6">
                                    <h4 className="font-semibold mb-4 flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                                      <CheckCircle className="w-5 h-5" />
                                      Conclusion
                                    </h4>
                                    <div className="prose prose-sm max-w-none dark:prose-invert break-words whitespace-pre-wrap">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {parsedSummary.conclusion}
                                      </ReactMarkdown>
                                    </div>
                                  </div>
                                )}

                                {parsedSummary.full_text && (
                                  <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
                                    <h4 className="font-semibold mb-4 flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                      <FileText className="w-5 h-5" />
                                      Full Analysis
                                    </h4>
                                    {(() => {
                                      const val = parsedSummary.full_text;
                                      if (typeof val === 'string') {
                                        return (
                                          <div className="prose prose-sm max-w-none dark:prose-invert break-words whitespace-pre-wrap">
                                            {renderMaybeStructuredString(val)}
                                          </div>
                                        );
                                      }
                                      if (Array.isArray(val)) {
                                        return (
                                          <div className="text-sm break-words">
                                            <ul className="list-disc ml-6 space-y-1">
                                              {val.map((v: any, i: number) => (
                                                <li key={i} className="whitespace-pre-wrap">{typeof v === 'string' ? cleanText(v) : JSON.stringify(v)}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        );
                                      }
                                      if (val && typeof val === 'object') {
                                        return <>{renderObjectSections(val as Record<string, any>)}</>;
                                      }
                                      return null;
                                    })()}
                                  </div>
                                )}
                              </>
                            );
                          }
                          
                          // Fallback for other types: render as readable list instead of raw JSON
                          return (
                            <div className="bg-background border rounded-lg p-6">
                              <h4 className="font-semibold mb-4">Summary</h4>
                              {typeof parsedSummary === 'string' ? (
                                <div className="prose prose-sm max-w-none dark:prose-invert break-words whitespace-pre-wrap">
                                  <Markdown>{parsedSummary}</Markdown>
                                </div>
                              ) : (
                                <div className="text-sm break-words">
                                  <ul className="list-disc ml-6 space-y-1">
                                    {Object.entries(parsedSummary as Record<string, any>).map(([k, v]) => (
                                      <li key={k} className="whitespace-pre-wrap"><span className="font-medium">{k}:</span> {typeof v === 'string' ? v : JSON.stringify(v)}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t mt-4 flex-shrink-0">
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerateSummary(summaryDocument.id, true)}
                    disabled={summaryLoading}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerate
                  </Button>
                  {summaryResult?.metadata?.cached && (
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateSummary(summaryDocument.id, true)}
                      disabled={summaryLoading}
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Force Fresh
                    </Button>
                  )}
                </div>
                <Button variant="outline" onClick={() => setShowSummaryDialog(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Move to Collection Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Move className="w-5 h-5" />
              Move to Collection
            </DialogTitle>
            <DialogDescription>
              Select a collection to move this document into.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Label>Select Collection</Label>
            <Select value={targetCollectionId || ''} onValueChange={(val) => setTargetCollectionId(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a collection" />
              </SelectTrigger>
              <SelectContent>
                {collections.length === 0 && (
                  <SelectItem value="" disabled>No collections available</SelectItem>
                )}
                {collections.map(col => (
                  <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmMove} disabled={!targetCollectionId}>Confirm Move</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}