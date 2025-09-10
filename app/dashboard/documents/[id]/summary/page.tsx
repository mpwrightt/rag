'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, FileText, Loader2, RefreshCw, Download, PlayCircle, Clock } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8058'

// Markdown renderer with wrapped code/pre blocks to prevent horizontal overflow
const Markdown = ({ children }: { children: string }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      code: ({ children }) => (
        <code className="whitespace-pre-wrap break-words rounded bg-muted px-1.5 py-0.5 text-[0.9em]">{String(children)}</code>
      ),
      pre: ({ children }) => (
        <pre className="whitespace-pre-wrap break-words overflow-x-auto rounded-md bg-muted p-3">{children as any}</pre>
      ),
    }}
  >
    {children}
  </ReactMarkdown>
)

// Helpers copied/adapted from Documents page
const normalizeSummaryResult = (val: any) => {
  try {
    if (val && typeof val === 'string') {
      const parsed = JSON.parse(val)
      if (parsed && typeof parsed === 'object') return parsed
      return { summary: val }
    }
    if (val && typeof val === 'object') return val
    return { summary: String(val ?? '') }
  } catch {
    return { summary: typeof val === 'string' ? val : JSON.stringify(val ?? '') }
  }
}

const hasSummaryContent = (data: any): boolean => {
  if (!data) return false
  const v: any = (data as any)?.summary ?? data
  if (typeof v === 'string') return v.trim().length > 0
  return !!v && Object.keys(v || {}).length > 0
}

export default function DocumentSummaryPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const documentId = params?.id

  const [docTitle, setDocTitle] = useState<string>('Document Summary')
  const [loadingDoc, setLoadingDoc] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<string | null>(null)
  const [jobPercent, setJobPercent] = useState<number | null>(null)
  const [jobETA, setJobETA] = useState<string | null>(null)
  const startedAtRef = useRef<number | null>(null)

  const [summary, setSummary] = useState<any | null>(null)
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false)

  // Fetch basic document info for header
  useEffect(() => {
    let active = true
    const run = async () => {
      if (!documentId) return
      setLoadingDoc(true)
      try {
        const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(documentId)}`)
        if (res.ok) {
          const data = await res.json()
          const title = data?.title || data?.name || data?.document?.title || data?.document?.name || documentId
          if (active) setDocTitle(title)
        }
      } catch (e) {
        // soft-fail
      } finally {
        if (active) setLoadingDoc(false)
      }
    }
    run()
    return () => { active = false }
  }, [documentId])

  // Poll a running job for progress and result
  useEffect(() => {
    if (!jobId) return
    let cancelled = false

    const calcETA = (progress: number, total: number) => {
      try {
        const started = startedAtRef.current
        if (!started || !progress || !total || total <= 0) return null
        const elapsedMs = Date.now() - started
        const avgPerUnit = elapsedMs / Math.max(1, progress)
        const remainingUnits = Math.max(0, total - progress)
        const etaMs = remainingUnits * avgPerUnit
        // Simple minutes rounding
        const mins = Math.max(1, Math.round(etaMs / 1000 / 60))
        return `${mins}m`
      } catch {
        return null
      }
    }

    const poll = async () => {
      try {
        const sRes = await fetch(`${API_BASE}/jobs/${encodeURIComponent(jobId)}/status`)
        if (!sRes.ok) {
          setJobStatus(`error`)
          return
        }
        const st = await sRes.json()
        setJobStatus(st?.status || 'running')
        if (typeof st?.progress === 'number' && typeof st?.total === 'number' && st.total > 0) {
          const pct = Math.max(0, Math.min(100, Math.floor((st.progress / st.total) * 100)))
          setJobPercent(pct)
          setJobETA(calcETA(st.progress, st.total))
        }
        if (st?.status === 'done') {
          const rRes = await fetch(`${API_BASE}/jobs/${encodeURIComponent(jobId)}/result`)
          if (rRes.ok) {
            const payload = await rRes.json()
            const value = payload?.result ?? payload
            setSummary(normalizeSummaryResult(value))
          }
          setJobStatus('done')
          setJobPercent(100)
          setJobETA(null)
          return
        }
      } catch (e) {
        // swallow intermittent errors during polling
      }
      if (!cancelled) setTimeout(poll, 2000)
    }

    poll()
    return () => { cancelled = true }
  }, [jobId])

  const startGeneration = useCallback(async () => {
    if (!documentId) return
    setError(null)
    setSummary(null)
    setLoadingSummary(true)
    try {
      const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(documentId)}/summary_async`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary_type: 'comprehensive', include_context: true })
      })
      if (res.status !== 202) {
        const txt = await res.text().catch(() => '')
        throw new Error(`Failed to start summary job: ${res.status} ${txt}`)
      }
      const { job_id } = await res.json()
      startedAtRef.current = Date.now()
      setJobId(job_id)
      setJobStatus('queued')
      setJobPercent(0)
      setJobETA(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to start summary')
    } finally {
      setLoadingSummary(false)
    }
  }, [documentId])

  const loadCached = useCallback(async () => {
    if (!documentId) return
    setError(null)
    setLoadingSummary(true)
    try {
      const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(documentId)}/summary/comprehensive`)
      if (!res.ok) throw new Error(`Failed to load summary: ${res.status}`)
      const payload = await res.json()
      const value = payload?.result ?? payload
      setSummary(normalizeSummaryResult(value))
      setJobStatus('done')
      setJobPercent(100)
      setJobETA(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to load summary')
    } finally {
      setLoadingSummary(false)
    }
  }, [documentId])

  const summaryAsMarkdown = useMemo(() => {
    const raw = (summary as any)?.summary ?? summary
    if (!raw) return ''
    if (typeof raw === 'string') return raw
    const titleize = (k: string) => (k || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase())
    const renderVal = (v: any): string => {
      if (v == null) return ''
      if (typeof v === 'string') return v
      if (Array.isArray(v)) return v.map(x => `- ${typeof x === 'string' ? x : JSON.stringify(x)}`).join('\n')
      if (typeof v === 'object') {
        return Object.entries(v).map(([k2, v2]) => `### ${titleize(k2)}\n\n${renderVal(v2)}`).join('\n\n')
      }
      return String(v)
    }
    const SECTION_ORDER = [
      'executive_overview','key_metrics','major_highlights','challenges_and_risks','opportunities_and_recommendations','conclusion','full_text'
    ]
    const parts: string[] = []
    for (const key of SECTION_ORDER) {
      if (key in raw) parts.push(`## ${titleize(key)}\n\n${renderVal(raw[key])}`)
    }
    for (const [k, v] of Object.entries(raw)) {
      if (!SECTION_ORDER.includes(k)) parts.push(`## ${titleize(k)}\n\n${renderVal(v)}`)
    }
    return parts.join('\n\n')
  }, [summary])

  const downloadMarkdown = useCallback(() => {
    if (!hasSummaryContent(summary)) return
    const headerTitle = docTitle || 'Document Summary'
    const md = `# ${headerTitle}\n\n${summaryAsMarkdown}`
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(headerTitle || 'document-summary').replace(/[^a-z0-9-_]+/ig, '_')}.md`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, [summary, summaryAsMarkdown, docTitle])

  return (
    <div className="flex flex-col min-h-screen p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/documents')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <span className="text-sm text-muted-foreground">Document</span>
      </div>

      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight line-clamp-2" title={docTitle}>
            <span className="inline-flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> {docTitle}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Comprehensive summary</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <Button onClick={loadCached} variant="outline" disabled={loadingSummary}>
            <RefreshCw className="w-4 h-4 mr-2" /> Load Cached
          </Button>
          <Button onClick={startGeneration} disabled={loadingSummary}>
            {loadingSummary ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />} Generate Summary
          </Button>
          <Button onClick={downloadMarkdown} variant="secondary" disabled={!hasSummaryContent(summary)}>
            <Download className="w-4 h-4 mr-2" /> Download
          </Button>
        </div>
      </div>

      {(jobStatus && jobStatus !== 'done') && (
        <Card className="mb-4">
          <CardHeader className="pb-2 px-4 sm:px-6">
            <CardTitle className="text-sm">Summary Generation</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4">
            <div className="flex items-center justify-between mb-2 text-sm">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="capitalize">{jobStatus}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{jobETA ? `ETA ${jobETA}` : 'In progress'}</span>
              </div>
            </div>
            <Progress value={jobPercent ?? 10} className="h-2" />
          </CardContent>
        </Card>
      )}

      <Card className="flex-1 min-h-[50vh]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="p-3 mb-4 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
          )}

          {!hasSummaryContent(summary) && !jobStatus && (
            <div className="text-sm text-muted-foreground">
              No summary loaded yet. Click <strong>Generate Summary</strong> to start, or <strong>Load Cached</strong> if you previously generated one.
            </div>
          )}

          {hasSummaryContent(summary) && (
            <div className="max-h-[calc(100vh-280px)] overflow-y-auto pr-1 sm:pr-2 pb-24 sm:pb-6">
              <div className="prose prose-sm sm:prose-base md:prose-lg dark:prose-invert max-w-none leading-relaxed tracking-[0.01em] break-words hyphens-auto prose-headings:scroll-mt-24 prose-p:my-3 prose-li:my-1 prose-ol:my-2 prose-ul:my-2 prose-img:rounded-md">
                <Markdown>{summaryAsMarkdown}</Markdown>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile sticky action bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-2">
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" size="sm" onClick={loadCached} disabled={loadingSummary} className="truncate">
            <RefreshCw className="w-4 h-4 mr-1" /> Cached
          </Button>
          <Button size="sm" onClick={startGeneration} disabled={loadingSummary} className="truncate">
            {loadingSummary ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-1" />} Generate
          </Button>
          <Button variant="secondary" size="sm" onClick={downloadMarkdown} disabled={!hasSummaryContent(summary)} className="truncate">
            <Download className="w-4 h-4 mr-1" /> Download
          </Button>
        </div>
      </div>
    </div>
  )
}
