import { getDb, sql } from '../config/database'

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

class UsersRepository {
  async getAll(): Promise<UserRow[]> {
    const db = await getDb()
    const res = await db.request().query(`
      SELECT u.id, u.name, u.surname, u.email,
             u.position_id, pos.name AS position_name,
             u.is_active,
             u.surname + LEFT(u.name, 1) AS login
      FROM [user] u
      LEFT JOIN [position] pos ON pos.id = u.position_id
      ORDER BY u.surname, u.name
    `)
    return res.recordset
  }

  async getPositions(): Promise<PositionRow[]> {
    const db = await getDb()
    const res = await db.request().query('SELECT id, name FROM [position] ORDER BY id')
    return res.recordset
  }

  async create(data: { name: string; surname: string; email?: string | null; position_id?: number | null }): Promise<UserRow> {
    const db = await getDb()
    const res = await db.request()
      .input('name',        sql.NVarChar(100), data.name)
      .input('surname',     sql.NVarChar(100), data.surname)
      .input('email',       sql.NVarChar(255), data.email       ?? null)
      .input('position_id', sql.Int,           data.position_id ?? null)
      .query(`
        INSERT INTO [user] (name, surname, email, position_id)
        OUTPUT INSERTED.id
        VALUES (@name, @surname, @email, @position_id)
      `)
    const id: number = res.recordset[0].id
    const [user] = await this.getAll().then(rows => rows.filter(r => r.id === id))
    return user
  }

  async getSettings(id: number): Promise<{ printer: string | null; print_karta: boolean }> {
    const db = await getDb()
    const res = await db.request()
      .input('id', sql.Int, id)
      .query('SELECT printer, print_karta FROM [user] WHERE id = @id')
    const row = res.recordset[0]
    return { printer: row?.printer ?? null, print_karta: row?.print_karta ?? true }
  }

  async saveSettings(id: number, data: { printer?: string | null; print_karta?: boolean }): Promise<void> {
    const db  = await getDb()
    const req = db.request().input('id', sql.Int, id)
    const sets: string[] = []
    if (data.printer     !== undefined) { req.input('printer',     sql.NVarChar(255), data.printer);     sets.push('printer = @printer') }
    if (data.print_karta !== undefined) { req.input('print_karta', sql.Bit,           data.print_karta); sets.push('print_karta = @print_karta') }
    if (!sets.length) return
    await req.query(`UPDATE [user] SET ${sets.join(', ')} WHERE id = @id`)
  }

  async update(id: number, data: { name?: string; surname?: string; email?: string | null; position_id?: number | null; is_active?: boolean }): Promise<void> {
    const db = await getDb()
    const req = db.request().input('id', sql.Int, id)
    const sets: string[] = []

    if (data.name        !== undefined) { req.input('name',        sql.NVarChar(100), data.name);        sets.push('name = @name') }
    if (data.surname     !== undefined) { req.input('surname',     sql.NVarChar(100), data.surname);     sets.push('surname = @surname') }
    if (data.email       !== undefined) { req.input('email',       sql.NVarChar(255), data.email);       sets.push('email = @email') }
    if (data.position_id !== undefined) { req.input('position_id', sql.Int,           data.position_id); sets.push('position_id = @position_id') }
    if (data.is_active   !== undefined) { req.input('is_active',   sql.Bit,           data.is_active);   sets.push('is_active = @is_active') }

    if (!sets.length) return
    await req.query(`UPDATE [user] SET ${sets.join(', ')} WHERE id = @id`)
  }
}

export const usersRepository = new UsersRepository()
