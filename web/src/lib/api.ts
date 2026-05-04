// Token management
export function getAccessToken(): string | null {
  return localStorage.getItem('access_token')
}
export function getRefreshToken(): string | null {
  return localStorage.getItem('refresh_token')
}
export function setTokens(access: string, refresh: string): void {
  localStorage.setItem('access_token', access)
  localStorage.setItem('refresh_token', refresh)
}
export function clearTokens(): void {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('user_data')
}

// Structured API error
export class ApiError extends Error {
  constructor(
    public status: number,
    public data: unknown
  ) {
    super(`Request failed with status ${status}`)
    this.name = 'ApiError'
  }
}

// Refresh lock to prevent concurrent refresh races
let isRefreshing = false
let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) return refreshPromise
  isRefreshing = true
  refreshPromise = (async () => {
    try {
      const refresh = getRefreshToken()
      if (!refresh) return null
      const res = await fetch('/api/auth/refresh/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      })
      if (!res.ok) {
        clearTokens()
        window.dispatchEvent(new CustomEvent('auth:session-expired'))
        return null
      }
      const data = await res.json()
      setTokens(data.access, data.refresh)
      return data.access
    } catch {
      clearTokens()
      window.dispatchEvent(new CustomEvent('auth:session-expired'))
      return null
    } finally {
      isRefreshing = false
      refreshPromise = null
    }
  })()
  return refreshPromise
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const buildHeaders = (token: string | null): Record<string, string> => {
    const h: Record<string, string> = { 'Accept': 'application/json' }
    if (!(options.body instanceof FormData)) {
      h['Content-Type'] = 'application/json'
    }
    if (token) h['Authorization'] = `Bearer ${token}`
    return { ...h, ...(options.headers as Record<string, string>) }
  }

  let token = getAccessToken()
  let res = await fetch(`/api${endpoint}`, { ...options, headers: buildHeaders(token) })

  if (res.status === 401 && getRefreshToken()) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      token = newToken
      res = await fetch(`/api${endpoint}`, { ...options, headers: buildHeaders(token) })
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new ApiError(res.status, data)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// File download helper
export async function apiDownload(endpoint: string, filename: string, options: RequestInit = {}): Promise<void> {
  const token = getAccessToken()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`/api${endpoint}`, { ...options, headers })
  if (!res.ok) throw new ApiError(res.status, null)

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// API helper methods
export const api = {
  get: <T>(endpoint: string) => apiFetch<T>(endpoint),
  post: <T>(endpoint: string, data: unknown) =>
    apiFetch<T>(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(endpoint: string, data: unknown) =>
    apiFetch<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  patch: <T>(endpoint: string, data: unknown) =>
    apiFetch<T>(endpoint, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T>(endpoint: string) =>
    apiFetch<T>(endpoint, { method: 'DELETE' }),
}

// Health check endpoint
export function fetchHealth() {
  return api.get<{ status: string; message: string; oauth_enabled: boolean }>('/health/')
}

// Paginated response type
export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// Domain types
export interface User {
  id: number
  username: string
  email: string
}

export interface Application {
  id: number
  company: string
  role: string
  location?: string
  salary_range?: string
  stage: string
  priority: string
  date_applied: string
  source?: string
  next_step?: string
  next_interview_date?: string
  contact_name?: string
  contact_email?: string
  resume_version?: string
  job_url?: string
  last_activity: string
  notes?: string
  is_archived: boolean
  created_at: string
  interview_count: number
  next_interview?: string
}

export interface InterviewNotes {
  id: number
  interview: number
  quick_notes?: string
  went_well?: string
  improve?: string
  dont_repeat?: string
  key_learnings?: string
  self_rating?: number
  difficulty_rating?: number
  would_prepare_differently?: boolean
  prepare_differently_note?: string
  company_impression?: string
  salary_discussed: boolean
  salary_amount?: string
  created_at: string
  updated_at: string
}

export interface InterviewPrep {
  id: number
  interview: number
  topics_to_study: string[]
  questions_to_ask?: string
  questions_expected?: string
  checklist: { text: string; checked: boolean }[]
  useful_links: { label: string; url: string }[]
  free_notes?: string
  created_at: string
  updated_at: string
}

export interface Interview {
  id: number
  application: number
  application_company: string
  application_role: string
  interview_type: string
  round_number: number
  scheduled_at: string
  duration_minutes?: number
  format?: string
  platform?: string
  interviewer_name?: string
  interviewer_role?: string
  status: string
  outcome: string
  follow_up_sent: boolean
  prep_status: string
  notes?: InterviewNotes
  prep?: InterviewPrep
  created_at: string
}

export interface CalendarEvent {
  id: number
  title: string
  description?: string
  event_type: string
  start_at: string
  end_at: string
  all_day: boolean
  location?: string
  application?: number
  interview?: number
  color?: string
  created_at: string
}

export interface AISettings {
  id: number
  provider: string
  ollama_base_url: string
  ollama_model: string
  openai_api_key?: string
  openai_model: string
  gemini_api_key?: string
  gemini_model: string
  anthropic_api_key?: string
  anthropic_model: string
  created_at: string
  updated_at: string
}

export interface DashboardStats {
  total_applications: number
  in_pipeline: number
  upcoming_interviews: number
  offers: number
  response_rate: number
  pipeline_breakdown: Record<string, number>
  upcoming_interviews_list: {
    id: number
    company: string
    role: string
    interview_type: string
    scheduled_at: string
    application_id: number
  }[]
  recent_activity: {
    id: number
    company: string
    role: string
    stage: string
    last_activity: string
  }[]
}

export interface InsightsData {
  total_applications: number
  by_stage: Record<string, number>
  response_rate: number
  interview_pass_rate: number
  avg_days_to_first_interview: number
  applications_by_source: Record<string, number>
  applications_by_month: { month: string; count: number }[]
  outcomes_by_month: { month: string; passed: number; failed: number; pending: number }[]
  avg_self_rating: number
  self_rating_by_month: { month: string; avg_rating: number }[]
  top_weak_areas: string[]
}
