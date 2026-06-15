import { getDb } from '../config/database'

export interface Material {
  id:      number
  name:    string
  density: number | null
  cost:    number | null
  unit:    string | null
}

class MaterialsRepository {
  async getAll(): Promise<Material[]> {
    const db = await getDb()
    const result = await db.request().query('SELECT * FROM [material] ORDER BY name')
    return result.recordset as Material[]
  }
}

export const materialsRepository = new MaterialsRepository()
