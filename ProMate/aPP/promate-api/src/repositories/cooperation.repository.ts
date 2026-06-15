import { getDb } from '../config/database'

export interface Cooperation {
  id:    number
  name:  string
  price: number | null
  unit:  string | null
}

class CooperationRepository {
  async getAll(): Promise<Cooperation[]> {
    const db = await getDb()
    const result = await db.request().query(
      'SELECT id, name, price, unit FROM cooperation ORDER BY name'
    )
    return result.recordset as Cooperation[]
  }
}

export const cooperationRepository = new CooperationRepository()
