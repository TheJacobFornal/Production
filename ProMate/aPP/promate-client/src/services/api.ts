import { Order, Part, OrderListItem, OrderSummary } from '../types'

const BASE_URL = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export const ordersApi = {
  getSummaryList: () =>
    request<OrderListItem[]>('/orders/summary'),

  getAll: () =>
    request<Order[]>('/orders'),

  getParts: (orderId: number, minPhase?: string) =>
    request<Part[]>(`/orders/${orderId}/parts${minPhase ? `?minPhase=${minPhase}` : ''}`),

  searchByNumber: (orderNumber: string) =>
    request<OrderSummary>(`/orders/search/${encodeURIComponent(orderNumber)}`),

  readyForProduction: (orderId: number) =>
    request<{ ok: boolean }>(`/orders/${orderId}/ready-for-production`, { method: 'POST' }),
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
  cost:           number | null
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
}

export interface PartSearchResult {
  id:           number
  part_number:  string
  name:         string
  order_number: string
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
}

export const partsApi = {
  getById: (partId: number) =>
    request<PartWithOrder>(`/parts/${partId}`),

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
