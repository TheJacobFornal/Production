import { getDb, sql } from '../config/database'

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

  async upsert(id: number | null, name: string, density: number | null, cost: number | null): Promise<number> {
    const db = await getDb()
    if (id) {
      await db.request()
        .input('id',      sql.Int,         id)
        .input('name',    sql.NVarChar(255), name)
        .input('density', sql.Float,        density)
        .input('cost',    sql.Decimal(10,2), cost)
        .query('UPDATE [material] SET name=@name, density=@density, cost=@cost WHERE id=@id')
      return id
    }
    const r = await db.request()
      .input('name',    sql.NVarChar(255), name)
      .input('density', sql.Float,        density)
      .input('cost',    sql.Decimal(10,2), cost)
      .query('INSERT INTO [material] (name, density, cost) OUTPUT INSERTED.id VALUES (@name, @density, @cost)')
    return r.recordset[0].id
  }
}

export const materialsRepository = new MaterialsRepository()
