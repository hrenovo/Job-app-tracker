import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { api, type AISettings } from '@/lib/api'
import { useAuth } from '@/lib/auth'

export const Route = createFileRoute('/_app/settings')({
  component: SettingsPage,
})

const PROVIDERS = [
  { value: 'ollama', label: 'Ollama (Local)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'anthropic', label: 'Anthropic' },
]

const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo']
const GEMINI_MODELS = ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro']
const ANTHROPIC_MODELS = ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']

function MaskedInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex gap-2">
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 font-mono"
      />
      <Button type="button" variant="outline" size="sm" onClick={() => setShow((p) => !p)}>
        {show ? 'Hide' : 'Show'}
      </Button>
    </div>
  )
}

function AIProviderSection() {
  const queryClient = useQueryClient()
  const { data: settings, isPending } = useQuery<AISettings>({
    queryKey: ['ai-settings'],
    queryFn: () => api.get('/ai-settings/'),
  })

  const [local, setLocal] = useState<Partial<AISettings>>({})
  const current = { ...settings, ...local } as Partial<AISettings>

  const saveMutation = useMutation({
    mutationFn: (data: Partial<AISettings>) => api.patch<AISettings>('/ai-settings/', data),
    onSuccess: (data) => {
      queryClient.setQueryData(['ai-settings'], data)
      setLocal({})
      toast.success('AI settings saved')
    },
    onError: () => toast.error('Failed to save settings'),
  })

  const testMutation = useMutation({
    mutationFn: () => api.post<{ success: boolean; message: string }>('/ai-settings/test-connection/', {}),
    onSuccess: (data) => {
      if (data.success) toast.success(data.message || 'Connection successful!')
      else toast.error(data.message || 'Connection failed')
    },
    onError: () => toast.error('Connection test failed'),
  })

  const update = (patch: Partial<AISettings>) => setLocal((p) => ({ ...p, ...patch }))

  if (isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  const provider = current.provider ?? 'ollama'

  return (
    <div className="space-y-6">
      {/* Provider selector */}
      <div className="space-y-2">
        <Label>Provider</Label>
        <div className="flex flex-wrap gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => update({ provider: p.value })}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                provider === p.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-accent border-border'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ollama config */}
      {provider === 'ollama' && (
        <div className="space-y-4 rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">
            Ollama runs AI models locally on your machine. Start Ollama and pull a model to use it.
          </p>
          <div className="space-y-2">
            <Label>Base URL</Label>
            <Input
              value={current.ollama_base_url ?? 'http://localhost:11434'}
              onChange={(e) => update({ ollama_base_url: e.target.value })}
              placeholder="http://localhost:11434"
            />
          </div>
          <div className="space-y-2">
            <Label>Model</Label>
            <Input
              value={current.ollama_model ?? 'llama3'}
              onChange={(e) => update({ ollama_model: e.target.value })}
              placeholder="llama3"
            />
            <p className="text-xs text-muted-foreground">Popular models: llama3, mistral, codellama, phi3</p>
          </div>
        </div>
      )}

      {/* OpenAI config */}
      {provider === 'openai' && (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="space-y-2">
            <Label>API Key</Label>
            <MaskedInput
              value={current.openai_api_key ?? ''}
              onChange={(v) => update({ openai_api_key: v })}
              placeholder="sk-…"
            />
          </div>
          <div className="space-y-2">
            <Label>Model</Label>
            <Select name="openai_model" value={current.openai_model ?? 'gpt-4o'} onValueChange={(v) => update({ openai_model: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OPENAI_MODELS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Gemini config */}
      {provider === 'gemini' && (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="space-y-2">
            <Label>API Key</Label>
            <MaskedInput
              value={current.gemini_api_key ?? ''}
              onChange={(v) => update({ gemini_api_key: v })}
              placeholder="AIza…"
            />
          </div>
          <div className="space-y-2">
            <Label>Model</Label>
            <Select name="gemini_model" value={current.gemini_model ?? 'gemini-1.5-pro'} onValueChange={(v) => update({ gemini_model: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GEMINI_MODELS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Anthropic config */}
      {provider === 'anthropic' && (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="space-y-2">
            <Label>API Key</Label>
            <MaskedInput
              value={current.anthropic_api_key ?? ''}
              onChange={(v) => update({ anthropic_api_key: v })}
              placeholder="sk-ant-…"
            />
          </div>
          <div className="space-y-2">
            <Label>Model</Label>
            <Select name="anthropic_model" value={current.anthropic_model ?? 'claude-opus-4-5'} onValueChange={(v) => update({ anthropic_model: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ANTHROPIC_MODELS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          onClick={() => saveMutation.mutate(local)}
          disabled={saveMutation.isPending || Object.keys(local).length === 0}
        >
          {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
        </Button>
        <Button
          variant="outline"
          onClick={() => testMutation.mutate()}
          disabled={testMutation.isPending}
        >
          {testMutation.isPending ? 'Testing…' : 'Test Connection'}
        </Button>
      </div>
    </div>
  )
}

function SettingsPage() {
  const { user } = useAuth()

  return (
    <div className="flex flex-col min-w-0 flex-1">
      <header className="sticky top-0 z-10 flex items-center border-b bg-background/95 backdrop-blur-sm px-4 lg:px-6 h-14 shrink-0">
        <SidebarTrigger className="-ml-1 mr-2" />
        <Separator orientation="vertical" className="h-4 mr-3" />
        <h1 className="font-semibold text-lg">Settings</h1>
      </header>

      <div className="flex flex-col gap-6 py-6 px-4 lg:px-6 max-w-2xl">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={user?.username ?? ''} readOnly className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email ?? ''} readOnly className="bg-muted" />
            </div>
          </CardContent>
        </Card>

        {/* AI Provider */}
        <Card>
          <CardHeader>
            <CardTitle>AI Provider</CardTitle>
            <CardDescription>
              Configure the AI model used for interview coaching, prep suggestions, and insights.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AIProviderSection />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
