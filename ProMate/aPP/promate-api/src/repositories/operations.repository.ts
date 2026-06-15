import { getDb, sql } from '../config/database'

export interface Operation {
  id:                number
  name:              string
  hour_cost:         number | null
  number_of_workers: number | null
  barcode:           string | null
}

class OperationsRepository {
  async getAll(): Promise<Operation[]> {
    const db = await getDb()
    const result = await db.request().query('SELECT * FROM [operation]')
    return result.recordset as Operation[]
  }
}

export const operationsRepository = new OperationsRepository()
