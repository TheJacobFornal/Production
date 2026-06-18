require('ts-node').register({ transpileOnly: true })
const { seed } = require('../src/mocks/seed')
const sql = require('mssql')

const config = {
  server: 'localhost',
  port: 1433,
  user: 'sa',
  password: 'ProMate_Test123!',
  options: { encrypt: false, trustServerCertificate: true },
}

// ─── Schemat tabel ────────────────────────────────────────────────────────────

async function createSchema(pool) {
  const tables = [
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='location' AND xtype='U')
     CREATE TABLE [location] (
       id      INT IDENTITY(1,1) PRIMARY KEY,
       name    NVARCHAR(100) NOT NULL,
       place   NVARCHAR(100) NULL,
       barcode NVARCHAR(100) NULL
     )`,

    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='phase' AND xtype='U')
     CREATE TABLE [phase] (
       id          INT IDENTITY(1,1) PRIMARY KEY,
       name        NVARCHAR(100) NOT NULL,
       location_id INT NULL REFERENCES [location](id),
       type        NVARCHAR(50) NULL,
       description NVARCHAR(255) NULL
     )`,

    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='order' AND xtype='U')
     CREATE TABLE [order] (
       id           INT IDENTITY(1,1) PRIMARY KEY,
       order_number NVARCHAR(100) NOT NULL,
       MOS_number   NVARCHAR(100) NULL,
       created_at   DATETIME2     NOT NULL DEFAULT GETDATE(),
       closed_at    DATETIME2     NULL,
       folder_path  NVARCHAR(500) NULL,
       all_drawings BIT           NOT NULL DEFAULT 0,
       barcode      NVARCHAR(100) NULL,
       phase_id     INT           NULL REFERENCES [phase](id),
       NagId        NVARCHAR(50)  NULL
     )`,

    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='part' AND xtype='U')
     CREATE TABLE [part] (
       id                    INT IDENTITY(1,1) PRIMARY KEY,
       order_id              INT           NOT NULL REFERENCES [order](id),
       symbol                NVARCHAR(50)  NULL,
       part_number           NVARCHAR(50)  NOT NULL,
       name                  NVARCHAR(255) NOT NULL,
       quantity_right        INT           NOT NULL DEFAULT 0,
       quantity_left         INT           NOT NULL DEFAULT 0,
       deadline_at           DATETIME2     NULL,
       paths_id              INT           NULL,
       price_id              INT           NULL,
       phase_id              INT           NULL REFERENCES [phase](id),
       rework_parent_part_id INT           NULL,
       location_id           INT           NULL REFERENCES [location](id),
       card_printed          BIT           NOT NULL DEFAULT 0,
       sticker_printed       BIT           NOT NULL DEFAULT 0,
       sticker_printed_at    DATETIME2     NULL,
       barcode               NVARCHAR(100) NULL,
       finished_at           DATETIME2     NULL,
       LinId                 INT           NULL
     )`,

    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='paths' AND xtype='U')
     CREATE TABLE [paths] (
       id          INT IDENTITY(1,1) PRIMARY KEY,
       part_id     INT            NOT NULL REFERENCES [part](id),
       PDF_path    NVARCHAR(500)  NULL,
       DWG_path    NVARCHAR(500)  NULL,
       STP_path    NVARCHAR(500)  NULL,
       CAM_path    NVARCHAR(500)  NULL,
       card_path   NVARCHAR(500)  NULL,
       all_drawings BIT           NULL DEFAULT 0
     )`,

    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='material' AND xtype='U')
     CREATE TABLE [material] (
       id      INT IDENTITY(1,1) PRIMARY KEY,
       name    NVARCHAR(100) NOT NULL,
       density DECIMAL(10,4) NULL,
       cost    DECIMAL(10,2) NULL,
       unit    NVARCHAR(20)  NULL
     )`,

    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='cooperation' AND xtype='U')
     CREATE TABLE [cooperation] (
       id    INT IDENTITY(1,1) PRIMARY KEY,
       name  NVARCHAR(100) NOT NULL,
       price DECIMAL(10,2) NULL,
       unit  NVARCHAR(20)  NULL
     )`,

    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='operation' AND xtype='U')
     CREATE TABLE [operation] (
       id                INT IDENTITY(1,1) PRIMARY KEY,
       name              NVARCHAR(100) NOT NULL,
       hour_cost         DECIMAL(10,2) NULL,
       number_of_workers INT           NULL DEFAULT 1,
       barcode           NVARCHAR(100) NULL
     )`,

    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='operation_logs' AND xtype='U')
     CREATE TABLE [operation_logs] (
       id               INT IDENTITY(1,1) PRIMARY KEY,
       part_id          INT            NOT NULL REFERENCES [part](id),
       operation_id     INT            NOT NULL REFERENCES [operation](id),
       phase_id         INT            NULL     REFERENCES [phase](id) DEFAULT 16,
       time_estimated   DECIMAL(10,2)  NULL,
       time_real        DECIMAL(10,2)  NULL,
       operation_order  INT            NULL,
       barcode          NVARCHAR(100)  NULL,
       cost             DECIMAL(10,2)  NULL,
       notes            NVARCHAR(1000) NULL
     )`,

    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='cooperation_log' AND xtype='U')
     CREATE TABLE [cooperation_log] (
       id             INT IDENTITY(1,1) PRIMARY KEY,
       part_id        INT NOT NULL REFERENCES [part](id),
       cooperation_id INT NOT NULL REFERENCES [cooperation](id),
       slot           INT NOT NULL,
       phase_id       INT NULL REFERENCES [phase](id) DEFAULT 16,
       cost           DECIMAL(10,2) NULL,
       CONSTRAINT UQ_cooperation_log_part_slot UNIQUE (part_id, slot)
     )`,

    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='form_log' AND xtype='U')
     CREATE TABLE [form_log] (
       id                INT IDENTITY(1,1) PRIMARY KEY,
       part_id           INT            NOT NULL REFERENCES [part](id),
       commercial_id     INT            NULL,
       dim_a_est         DECIMAL(10,4)  NULL,
       dim_b_est         DECIMAL(10,4)  NULL,
       dim_c_est         DECIMAL(10,4)  NULL,
       material_est_id   INT            NULL REFERENCES [material](id),
       dim_a_real        DECIMAL(10,4)  NULL,
       dim_b_real        DECIMAL(10,4)  NULL,
       dim_c_real        DECIMAL(10,4)  NULL,
       area_one          DECIMAL(10,4)  NULL,
       weight_one        DECIMAL(10,4)  NULL,
       weight_real_set   DECIMAL(10,4)  NULL,
       material_id       INT            NULL REFERENCES [material](id),
       cost_kit          DECIMAL(10,2)  NULL
     )`,

    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='price' AND xtype='U')
     CREATE TABLE [price] (
       id                  INT IDENTITY(1,1) PRIMARY KEY,
       part_id             INT            NOT NULL REFERENCES [part](id),
       cost_commercial_kit DECIMAL(10,2)  NULL,
       cost_labor_hour     DECIMAL(10,2)  NULL,
       cost_cooperation    DECIMAL(10,2)  NULL,
       cost_machining      DECIMAL(10,2)  NULL,
       price_kit           DECIMAL(10,2)  NULL,
       price_piece         DECIMAL(10,2)  NULL
     )`,

    // Migracja: usuń kolumny kosztów z form_log (przeniesione do tabeli price)
    `IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('form_log') AND name='cost_labor_hour')      ALTER TABLE form_log DROP COLUMN cost_labor_hour`,
    `IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('form_log') AND name='cost_cooperation')     ALTER TABLE form_log DROP COLUMN cost_cooperation`,
    `IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('form_log') AND name='cost_machining')       ALTER TABLE form_log DROP COLUMN cost_machining`,
    `IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('form_log') AND name='price_kit')            ALTER TABLE form_log DROP COLUMN price_kit`,
    `IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('form_log') AND name='price_piece')          ALTER TABLE form_log DROP COLUMN price_piece`,
    `IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('form_log') AND name='cost_commercial_kit')  ALTER TABLE form_log DROP COLUMN cost_commercial_kit`,

    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='commercial' AND xtype='U')
     CREATE TABLE [commercial] (
       id         INT IDENTITY(1,1) PRIMARY KEY,
       form_id    INT            NOT NULL REFERENCES [form_log](id),
       cost       DECIMAL(10,2)  NULL,
       ordered_at DATETIME       NULL,
       arrived_at DATETIME       NULL,
       phase_id   INT            NULL REFERENCES [phase](id)
     )`,
  ]

  for (const stmt of tables) {
    await pool.request().query(stmt)
  }
  console.log('✅ Schemat tabel gotowy')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const str  = v => v != null ? `N'${String(v).replace(/'/g, "''")}'` : 'NULL'
const date = v => v != null ? `'${new Date(v).toISOString().split('T')[0]}'` : 'NULL'
const bit  = v => v ? 1 : 0

// ─── Dane testowe (z seed) ────────────────────────────────────────────────────

async function seedData(pool) {
  // ── Lokalizacje ─────────────────────────────────────────────────────────────
  const locVals = seed.locations.map(l =>
    `(${l.id}, ${str(l.name)}, ${str(l.place)}, ${str(l.barcode)})`
  ).join(',\n      ')
  await pool.request().query(`
    SET IDENTITY_INSERT [location] ON
    INSERT INTO [location] (id, name, place, barcode) VALUES
      ${locVals}
    SET IDENTITY_INSERT [location] OFF
  `)

  // ── Fazy ────────────────────────────────────────────────────────────────────
  const phaseVals = seed.phases.map(p =>
    `(${p.id}, ${str(p.name)}, ${str(p.type)}, ${p.location_id ?? 'NULL'}, ${str(p.description)})`
  ).join(',\n      ')
  await pool.request().query(`
    SET IDENTITY_INSERT [phase] ON
    INSERT INTO [phase] (id, name, type, location_id, description) VALUES
      ${phaseVals}
    SET IDENTITY_INSERT [phase] OFF
  `)

  // ── Zamówienia ──────────────────────────────────────────────────────────────
  const orderVals = seed.orders.map(o =>
    `(${o.id}, ${str(o.order_number)}, ${str(o.MOS_number)}, ${date(o.created_at)}, ${date(o.closed_at)}, ${str(o.folder_path)}, ${bit(o.all_drawings)}, ${str(o.barcode)}, ${o.phase_id})`
  ).join(',\n      ')
  await pool.request().query(`
    SET IDENTITY_INSERT [order] ON
    INSERT INTO [order] (id, order_number, MOS_number, created_at, closed_at, folder_path, all_drawings, barcode, phase_id) VALUES
      ${orderVals}
    SET IDENTITY_INSERT [order] OFF
  `)

  // ── Detale ──────────────────────────────────────────────────────────────────
  const partVals = seed.parts.map(p =>
    `(${p.id}, ${p.order_id}, ${str(p.symbol)}, ${str(p.part_number)}, ${str(p.name)}, ${p.quantity_right}, ${p.quantity_left}, ${date(p.deadline_at)}, ${p.phase_id}, ${p.location_id ?? 'NULL'}, ${bit(p.card_printed)}, ${bit(p.sticker_printed)}, ${str(p.barcode)}, ${date(p.finished_at)})`
  ).join(',\n      ')
  await pool.request().query(`
    SET IDENTITY_INSERT [part] ON
    INSERT INTO [part] (id, order_id, symbol, part_number, name, quantity_right, quantity_left, deadline_at, phase_id, location_id, card_printed, sticker_printed, barcode, finished_at) VALUES
      ${partVals}
    SET IDENTITY_INSERT [part] OFF
  `)

  // ── Materiały ───────────────────────────────────────────────────────────────
  const matVals = seed.materials.map(m =>
    `(${m.id}, ${str(m.name)}, ${m.density ?? 'NULL'}, ${m.cost ?? 'NULL'}, ${str(m.unit)})`
  ).join(',\n      ')
  await pool.request().query(`
    SET IDENTITY_INSERT [material] ON
    INSERT INTO [material] (id, name, density, cost, unit) VALUES
      ${matVals}
    SET IDENTITY_INSERT [material] OFF
  `)

  // ── Kooperacje ──────────────────────────────────────────────────────────────
  const coopVals = seed.cooperations.map(c =>
    `(${c.id}, ${str(c.name)}, ${c.price ?? 'NULL'}, ${str(c.unit)})`
  ).join(',\n      ')
  await pool.request().query(`
    SET IDENTITY_INSERT [cooperation] ON
    INSERT INTO [cooperation] (id, name, price, unit) VALUES
      ${coopVals}
    SET IDENTITY_INSERT [cooperation] OFF
  `)

  // ── Operacje ────────────────────────────────────────────────────────────────
  const opVals = seed.operations.map(o =>
    `(${o.id}, ${str(o.name)}, ${o.hour_cost ?? 'NULL'}, ${o.number_of_workers ?? 'NULL'}, ${str(o.barcode)})`
  ).join(',\n      ')
  await pool.request().query(`
    SET IDENTITY_INSERT [operation] ON
    INSERT INTO [operation] (id, name, hour_cost, number_of_workers, barcode) VALUES
      ${opVals}
    SET IDENTITY_INSERT [operation] OFF
  `)

  // ── Logi operacji ────────────────────────────────────────────────────────────
  if (seed.operationLogs.length > 0) {
    const opLogVals = seed.operationLogs.map(l =>
      `(${l.id}, ${l.part_id}, ${l.operation_id}, ${l.phase_id ?? 'NULL'}, ${l.time_estimated ?? 'NULL'}, ${l.time_real ?? 'NULL'}, ${l.operation_order ?? 'NULL'}, ${str(l.barcode)}, ${l.cost ?? 'NULL'})`
    ).join(',\n      ')
    await pool.request().query(`
      SET IDENTITY_INSERT [operation_logs] ON
      INSERT INTO [operation_logs] (id, part_id, operation_id, phase_id, time_estimated, time_real, operation_order, barcode, cost) VALUES
        ${opLogVals}
      SET IDENTITY_INSERT [operation_logs] OFF
    `)
  }

  // ── Logi kooperacji ──────────────────────────────────────────────────────────
  if (seed.cooperationLogs.length > 0) {
    const coopLogVals = seed.cooperationLogs.map(l =>
      `(${l.id}, ${l.part_id}, ${l.cooperation_id}, ${l.slot}, ${l.phase_id ?? 'NULL'}, ${l.cost ?? 'NULL'})`
    ).join(',\n      ')
    await pool.request().query(`
      SET IDENTITY_INSERT [cooperation_log] ON
      INSERT INTO [cooperation_log] (id, part_id, cooperation_id, slot, phase_id, cost) VALUES
        ${coopLogVals}
      SET IDENTITY_INSERT [cooperation_log] OFF
    `)
  }

  console.log(`✅ Dane z seed: ${seed.orders.length} zamówień, ${seed.parts.length} detali, ${seed.phases.length} faz, ${seed.locations.length} lokalizacji, ${seed.operations.length} operacji, ${seed.cooperations.length} kooperacji, ${seed.materials.length} materiałów, ${seed.operationLogs.length} logów operacji, ${seed.cooperationLogs.length} logów kooperacji`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function setup() {
  // 1. Usuń bazę jeśli istnieje i utwórz od nowa (czysty stan)
  let pool = await sql.connect({ ...config, database: 'master' })
  await pool.request().query(`
    IF EXISTS (SELECT name FROM sys.databases WHERE name = 'promate_test')
    BEGIN
      ALTER DATABASE promate_test SET SINGLE_USER WITH ROLLBACK IMMEDIATE
      DROP DATABASE promate_test
    END
    CREATE DATABASE promate_test
  `)
  console.log('✅ Baza promate_test gotowa (świeża)')
  await sql.close()

  // 2. Utwórz schemat i dodaj dane
  pool = await sql.connect({ ...config, database: 'promate_test' })
  await createSchema(pool)
  await seedData(pool)
  await sql.close()

  console.log('\n🎉 Baza testowa gotowa do pracy!\n')
}

setup().catch(err => {
  console.error('❌', err.message)
  process.exit(1)
})
