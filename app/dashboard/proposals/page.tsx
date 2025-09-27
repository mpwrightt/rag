'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Plus, FileText, Loader2 } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8058'

type Proposal = {
  id: string
  title: string
  status?: string
  metadata?: Record<string, any>
  created_at?: string
  updated_at?: string
}

export default function ProposalsListPage() {
  const router = useRouter()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const loadProposals = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/proposals`, { headers: { 'bypass-tunnel-reminder': 'true' } })
      if (res.ok) {
        const data = await res.json()
        const items: Proposal[] = Array.isArray(data) ? data : (data.proposals || [])
        setProposals(items)
      }
    } catch (e) {
      console.warn('Failed to load proposals', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProposals()
  }, [])

  const createProposal = async () => {
    setCreating(true)
    try {
      const title = (newTitle || '').trim() || `Untitled Proposal ${new Date().toLocaleString()}`
      const res = await fetch(`${API_BASE}/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
        body: JSON.stringify({ title, client_fields: {}, project_fields: {}, metadata: {} })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      router.push(`/dashboard/proposals/${data.id}`)
    } catch (e) {
      console.error('Create proposal failed', e)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold">Proposals</h1>
        <div className="flex items-center gap-2">
          <Input
            placeholder="New proposal title (optional)"
            className="w-60 hidden sm:block"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <Button onClick={createProposal} disabled={creating}>
            {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Plus className="w-4 h-4 mr-2"/>}
            New Proposal
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : proposals.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No proposals yet. Create your first one.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {proposals.map((p) => (
            <Card key={p.id} className="hover:shadow-md transition cursor-pointer" onClick={() => router.push(`/dashboard/proposals/${p.id}`)}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4"/>
                  <span className="truncate">{p.title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground flex items-center justify-between">
                <span>Status: {p.status || 'draft'}</span>
                <span>{p.updated_at ? new Date(p.updated_at).toLocaleString() : ''}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
