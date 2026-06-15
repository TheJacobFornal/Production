import { mockOrders, mockParts } from './orders'
import { mockUsers, mockPositions } from './users'
import { mockPhases, mockLocations, mockMachines, mockOperations, mockMaterials, mockCooperations, mockOperationLogs, mockCooperationLogs } from './production'

export const seed = {
  orders:          mockOrders,
  parts:           mockParts,
  users:           mockUsers,
  positions:       mockPositions,
  phases:          mockPhases,
  locations:       mockLocations,
  machines:        mockMachines,
  operations:      mockOperations,
  materials:       mockMaterials,
  cooperations:    mockCooperations,
  operationLogs:   mockOperationLogs,
  cooperationLogs: mockCooperationLogs,
}

export function loadSeed() {
  console.log('🌱 Dev mode — dane mockowe załadowane:')
  Object.entries(seed).forEach(([key, val]) =>
    console.log(`   ${key}: ${(val as unknown[]).length} rekordów`)
  )
}
