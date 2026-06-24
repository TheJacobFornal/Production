import { getDb, sql } from '../config/database'

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

  async upsert(id: number | null, name: string, price: number | null, unit: string | null): Promise<number> {
    const db = await getDb()
    if (id) {
      await db.request()
        .input('id',    sql.Int,          id)
        .input('name',  sql.NVarChar(255), name)
        .input('price', sql.Decimal(10,2), price)
        .input('unit',  sql.NVarChar(50),  unit)
        .query('UPDATE [cooperation] SET name=@name, price=@price, unit=@unit WHERE id=@id')
      return id
    }
    const r = await db.request()
      .input('name',  sql.NVarChar(255), name)
      .input('price', sql.Decimal(10,2), price)
      .input('unit',  sql.NVarChar(50),  unit)
      .query('INSERT INTO [cooperation] (name, price, unit) OUTPUT INSERTED.id VALUES (@name, @price, @unit)')
    return r.recordset[0].id
  }
}

export const cooperationRepository = new CooperationRepository()
