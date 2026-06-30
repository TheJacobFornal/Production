import { Order, Part, OrderListItem, OrderSummary } from '../types'
import type { AuthUser } from '../context/AuthContext'

const BASE_URL = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export const authApi = {
  login: (login: string, password?: string) =>
    request<AuthUser>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    }),
  requestReset: (userId: number) =>
    request<{ url: string }>('/auth/request-reset', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
  resetInfo: (token: string) =>
    request<{ name: string; surname: string }>(`/auth/reset-info?token=${encodeURIComponent(token)}`),
  resetPassword: (token: string, password: string) =>
    request<{ ok: boolean }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
}

export interface UserRow {
  id:            number
  name:          string
  surname:       string
  email:         string | null
  position_id:   number | null
  position_name: string | null
  is_active:     boolean
  login:         string
}

export interface PositionRow {
  id:   number
  name: string
}

export const usersApi = {
  getAll:       () => request<UserRow[]>('/users'),
  getPositions: () => request<PositionRow[]>('/users/positions'),
  create: (data: { name: string; surname: string; email?: string | null; position_id?: number | null }) =>
    request<UserRow>('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<{ name: string; surname: string; email: string | null; position_id: number | null; is_active: boolean }>) =>
    request<{ ok: boolean }>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
}

export const ordersApi = {
  getSummaryList: () =>
    request<OrderListItem[]>('/orders/summary'),

  getAll: () =>
    request<Order[]>('/orders'),

  getParts: (orderId: number, minPhase?: string, maxPhase?: string) => {
    const params = new URLSearchParams()
    if (minPhase) params.set('minPhase', minPhase)
    if (maxPhase) params.set('maxPhase', maxPhase)
    const qs = params.toString()
    return request<Part[]>(`/orders/${orderId}/parts${qs ? `?${qs}` : ''}`)
  },

  searchByNumber: (orderNumber: string) =>
    request<OrderSummary>(`/orders/search/${encodeURIComponent(orderNumber)}`),

  readyForProduction: (orderId: number, printer?: string) =>
    request<{ ok: boolean; pdfErrors?: string[] }>(`/orders/${orderId}/ready-for-production`, {
      method: 'POST',
      body: JSON.stringify({ printer }),
    }),

  cancelOrder: (orderId: number) =>
    request<{ ok: boolean }>(`/orders/${orderId}/cancel`, { method: 'POST' }),

  deleteOrder: (orderId: number) =>
    request<{ ok: boolean }>(`/orders/${orderId}`, { method: 'DELETE' }),

  createOrder: (orderNumber: string, typZamowienia?: string) =>
    request<{ id: number }>('/orders', { method: 'POST', body: JSON.stringify({ order_number: orderNumber, typ_zamowienia: typZamowienia }) }),

  createFullOrder: (data: {
    order_number:   string
    typ_zamowienia: string | null
    parts: Array<{
      part_number:    string
      name:           string
      quantity_right: number
      deadline_at:    string | null
      pdf_path:       string | null
      dwg_path:       string | null
      stp_path:       string | null
      material_id:    number | null
      kop1_id:        number | null
      kop2_id:        number | null
      kop3_id:        number | null
    }>
  }) =>
    request<{ id: number }>('/orders/full', { method: 'POST', body: JSON.stringify(data) }),
}

export interface OperationLog {
  id:              number
  part_id:         number
  operation_id:    number
  phase_id:        number | null
  time_estimated:  number | null
  time_real:       number | null
  operation_order: number | null
  barcode:         string | null
  cost:            number | null
  notes:           string | null
}

export const operationLogsApi = {
  save: (payload: {
    part_id:         number
    operation_id:    number
    time_estimated:  number | null
    operation_order: number | null
    phase_id:        number | null
  }) =>
    request<{ ok: boolean }>('/operation-logs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getByPartIds: (partIds: number[]) =>
    request<OperationLog[]>(`/operation-logs?partIds=${partIds.join(',')}`),

  updatePhase: (partId: number, operationId: number, phaseId: number) =>
    request<{ ok: boolean }>('/operation-logs/phase', {
      method: 'PATCH',
      body: JSON.stringify({ part_id: partId, operation_id: operationId, phase_id: phaseId }),
    }),

  saveNotes: (partId: number, operationId: number, notes: string | null) =>
    request<{ ok: boolean }>('/operation-logs/notes', {
      method: 'PATCH',
      body: JSON.stringify({ part_id: partId, operation_id: operationId, notes }),
    }),

  saveReal: (partId: number, operationId: number, timeReal: number | null) =>
    request<{ ok: boolean }>('/operation-logs/real', {
      method: 'PATCH',
      body: JSON.stringify({ part_id: partId, operation_id: operationId, time_real: timeReal }),
    }),
}

export interface FormLogDims {
  part_id:         number
  dim_a_est:       number | null
  dim_b_est:       number | null
  dim_c_est:       number | null
  dim_a_real:      number | null
  dim_b_real:      number | null
  dim_c_real:      number | null
  material_id:     number | null
  material_est_id: number | null
  weight_one:      number | null
  area_one:        number | null
  cost_kit:        number | null
}

export interface Price {
  id:                  number
  part_id:             number
  cost_commercial_kit: number | null
  cost_labor_hour:     number | null
  cost_cooperation:    number | null
  cost_machining:      number | null
  price_kit:           number | null
  price_piece:         number | null
}

export const priceApi = {
  upsert: (payload: {
    part_id:             number
    cost_commercial_kit: number | null
    cost_labor_hour:     number | null
    cost_cooperation:    number | null
    cost_machining:      number | null
    price_kit:           number | null
    price_piece:         number | null
  }) =>
    request<{ ok: boolean }>('/price', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getByPartIds: (partIds: number[]) =>
    request<Price[]>(`/price?partIds=${partIds.join(',')}`),
}

export interface Cooperation {
  id:    number
  name:  string
  price: number | null
  unit:  string | null
}

export const cooperationsApi = {
  getAll: () => request<Cooperation[]>('/cooperations'),
  upsert: (id: number | null, data: { name: string; price: number | null; unit: string | null }) =>
    request<{ id: number }>(id ? `/cooperations/${id}` : '/cooperations', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(data),
    }),
}

export interface Material {
  id:      number
  name:    string
  density: number | null
  cost:    number | null
  unit:    string | null
}

export const materialsApi = {
  getAll: () => request<Material[]>('/materials'),
  upsert: (id: number | null, data: { name: string; density: number | null; cost: number | null }) =>
    request<{ id: number }>( id ? `/materials/${id}` : '/materials', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(data),
    }),
}

export interface Operation {
  id:                number
  name:              string
  hour_cost:         number | null
  number_of_workers: number | null
  barcode:           string | null
}

export const operationsApi = {
  getAll: () => request<Operation[]>('/operations'),
}

export interface CooperationLog {
  part_id:        number
  cooperation_id: number
  slot:           number
  phase_id:       number | null
  phase_name:     string | null
  cost:           number | null
  sent_at:        string | null
  received_at:    string | null
}

export interface KoopPanelRow {
  part_id:          number
  slot:             number
  cooperation_id:   number
  phase_id:         number | null
  phase_name:       string | null
  cost:             number | null
  sent_at:          string | null
  received_at:      string | null
  part_number:      string
  part_name:        string
  quantity:         number
  quantity_right:   number
  quantity_left:    number
  order_number:     string
  cooperation_name: string
}

export const cooperationLogApi = {
  save: (payload: { part_id: number; cooperation_id: number | null; slot: number }) =>
    request<{ ok: boolean }>('/cooperation-log', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getByPartIds: (partIds: number[]) =>
    request<CooperationLog[]>(`/cooperation-log?partIds=${partIds.join(',')}`),

  updatePhase: (partId: number, slot: number, phaseId: number) =>
    request<{ ok: boolean }>('/cooperation-log/phase', {
      method: 'PATCH',
      body: JSON.stringify({ part_id: partId, slot, phase_id: phaseId }),
    }),

  updateCost: (partId: number, slot: number, cost: number | null) =>
    request<{ ok: boolean }>('/cooperation-log/cost', {
      method: 'PATCH',
      body: JSON.stringify({ part_id: partId, slot, cost }),
    }),

  getPanel: () =>
    request<KoopPanelRow[]>('/cooperation-log/panel'),

  cyclePhase: (partId: number, slot: number) =>
    request<{ phase_id: number | null; phase_name: string | null; sent_at: string | null; received_at: string | null }>(
      '/cooperation-log/cycle',
      { method: 'PATCH', body: JSON.stringify({ part_id: partId, slot }) },
    ),

  updateDates: (partId: number, slot: number, sentAt: string | null, receivedAt: string | null) =>
    request<{ ok: boolean }>('/cooperation-log/dates', {
      method: 'PATCH',
      body: JSON.stringify({ part_id: partId, slot, sent_at: sentAt, received_at: receivedAt }),
    }),
}

export interface PartSearchResult {
  id:           number
  part_number:  string
  name:         string
  order_number: string
}

export interface PartPaths {
  part_id:  number
  PDF_path: string | null
  DWG_path: string | null
  STP_path: string | null
}

export interface PartWithOrder {
  id:                    number
  order_id:              number
  symbol:                string | null
  part_number:           string
  name:                  string
  quantity_right:        number
  quantity_left:         number
  phase_id:              number | null
  location_id:           number | null
  card_printed:          boolean
  sticker_printed:       boolean
  barcode:               string | null
  finished_at:           string | null
  rework_parent_part_id: number | null
  deadline_at:           string | null
  order_number:          string
  phase_name:            string | null
}

export const partsApi = {
  create: (data: { order_id: number; part_number: string; name: string; quantity_right: number; deadline_at: string | null; compound_id?: number | null }) =>
    request<{ id: number }>('/parts', { method: 'POST', body: JSON.stringify(data) }),

  loadFromFolder: (folderPath: string, orderId: number, parts: { id: number; part_number: string; needsPDF: boolean; needsDWG: boolean; needsSTP: boolean }[]) =>
    request<{ updated: number }>('/parts/load-from-folder', {
      method: 'POST',
      body: JSON.stringify({ folderPath, orderId, parts }),
    }),

  getAllInPhase: (minPhase: string, maxPhase?: string) => {
    const params = new URLSearchParams({ minPhase })
    if (maxPhase) params.set('maxPhase', maxPhase)
    return request<PartWithOrder[]>(`/parts/all-in-phase?${params}`)
  },

  getById: (partId: number) =>
    request<PartWithOrder>(`/parts/${partId}`),

  getPaths: (partIds: number[]) =>
    request<PartPaths[]>(`/parts/paths?partIds=${partIds.join(',')}`),

  search: (q: string) =>
    request<PartSearchResult[]>(`/parts/search?q=${encodeURIComponent(q)}`),

  setRework: (partId: number, parentPartId: number | null) =>
    request<{ ok: boolean }>(`/parts/${partId}/rework`, {
      method: 'PATCH',
      body: JSON.stringify({ rework_parent_part_id: parentPartId }),
    }),

  updatePhase: (partId: number, phaseId: number) =>
    request<{ ok: boolean }>(`/parts/${partId}/phase`, {
      method: 'PATCH',
      body: JSON.stringify({ phase_id: phaseId }),
    }),

  updateProgram: (partId: number, value: boolean) =>
    request<{ ok: boolean }>(`/parts/${partId}/program`, {
      method: 'PATCH',
      body: JSON.stringify({ value }),
    }),

  updatePaths: (partId: number, paths: { PDF_path?: string | null; DWG_path?: string | null; STP_path?: string | null }) =>
    request<{ ok: boolean }>(`/parts/${partId}/paths`, {
      method: 'PATCH',
      body: JSON.stringify(paths),
    }),

  updateBasic: (partId: number, data: { part_number: string; name: string; quantity_right: number; deadline_at: string | null }) =>
    request<{ ok: boolean }>(`/parts/${partId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateField: (partId: number, key: 'producer' | 'comment', value: string) =>
    request<{ ok: boolean }>(`/parts/${partId}/field`, {
      method: 'PATCH',
      body: JSON.stringify({ key, value }),
    }),

  syncSoftlab: (orderId: number, nagId: string) =>
    request<{ updated: number }>('/parts/sync-softlab', {
      method: 'POST',
      body: JSON.stringify({ orderId, nagId }),
    }),
}

export interface CommercialPart {
  commercial_id:   number
  part_id:         number
  numer_zlecenia:  string
  nr_detalu:       string
  nazwa_detalu:    string
  ilosc:           number
  quantity_left:   number
  data_zamowienia: string | null
  data_dostawy:    string | null
  status_num:      0 | 1 | 2
}

export const commercialApi = {
  create: (partId: number) =>
    request<{ ok: boolean }>('/commercial', {
      method: 'POST',
      body: JSON.stringify({ part_id: partId }),
    }),

  delete: (partId: number) =>
    request<{ ok: boolean }>(`/commercial?partId=${partId}`, { method: 'DELETE' }),

  getCheckedPartIds: (partIds: number[]) =>
    request<number[]>(`/commercial?partIds=${partIds.join(',')}`),

  getParts: () =>
    request<CommercialPart[]>('/commercial/parts'),

  updateStatus: (commercialId: number, status: 'Do zamówienia' | 'Zamówione' | 'Dotarło') =>
    request<{ ok: boolean }>(`/commercial/${commercialId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  updateDates: (commercialId: number, ordered_at: string | null, arrived_at: string | null) =>
    request<{ ok: boolean }>(`/commercial/${commercialId}/dates`, {
      method: 'PATCH',
      body: JSON.stringify({ ordered_at, arrived_at }),
    }),
}

export const formLogApi = {
  saveDims: (payload: {
    part_id:   number
    dim_a_est: number | null
    dim_b_est: number | null
    dim_c_est: number | null
  }) =>
    request<{ ok: boolean }>('/form-log/dims', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateCostKit: (partId: number, costKit: number | null) =>
    request<{ ok: boolean }>('/form-log/cost-kit', {
      method: 'PATCH',
      body: JSON.stringify({ part_id: partId, cost_kit: costKit }),
    }),

  saveReal: (payload: {
    part_id:    number
    dim_a_real: number | null
    dim_b_real: number | null
    dim_c_real: number | null
    material_id: number | null
    weight_one: number | null
    area_one:   number | null
  }) =>
    request<{ ok: boolean }>('/form-log/real', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  saveMaterialEst: (partId: number, materialEstId: number | null) =>
    request<{ ok: boolean }>('/form-log/material-est', {
      method: 'PATCH',
      body: JSON.stringify({ part_id: partId, material_est_id: materialEstId }),
    }),

  getByPartIds: (partIds: number[]) =>
    request<FormLogDims[]>(`/form-log?partIds=${partIds.join(',')}`),
}

export interface PhaseInfo {
  id:          number
  name:        string
  description: string | null
}

export const phasesApi = {
  getByType: (type: string) =>
    request<PhaseInfo[]>(`/phases?type=${encodeURIComponent(type)}`),
}

export const printersApi = {
  getAll: () => request<string[]>('/printers'),
}

export const appSettingsApi = {
  get:  () =>
    request<{ printer: string | null; print_karta: boolean }>('/settings'),
  save: (data: { printer?: string | null; print_karta?: boolean }) =>
    request<{ ok: boolean }>('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
}

export const dialogApi = {
  selectFolder: () => request<{ path: string | null }>('/dialog/select-folder'),
  selectFile:   (ext: '.pdf' | '.dwg' | '.stp', initialDir?: string | null) =>
    request<{ path: string | null }>(`/dialog/select-file?ext=${ext}${initialDir ? `&initialDir=${encodeURIComponent(initialDir)}` : ''}`),
  openFolder:   (folderPath: string) =>
    request<{ ok: boolean }>('/dialog/open-folder', { method: 'POST', body: JSON.stringify({ path: folderPath }) }),

  listPdfs: (folder: string) =>
    request<{ files: Array<{ name: string; pdf_path: string; dwg_path: string | null; stp_path: string | null; compound_key: string | null }> }>(
      `/dialog/list-pdfs?folder=${encodeURIComponent(folder)}`
    ),

  readExcel: (filePath: string) =>
    request<{ rows: Array<{ numer_detalu: string; material: string; kop1: string; kop2: string }> }>(
      `/dialog/read-excel?path=${encodeURIComponent(filePath)}`
    ),
}

export const importApi = {
  run: () => request<{ added: number; exitCode?: number; error?: string; output?: string }>('/import/run', { method: 'POST' }),
}
