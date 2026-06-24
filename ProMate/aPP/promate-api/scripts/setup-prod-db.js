require('ts-node').register({ transpileOnly: true })
const { seed } = require('../src/mocks/seed')
const sql = require('mssql')

const config = {
  server: '10.1.69.13',
  port: 50461,
  user: 'ws',
  password: "64>z*9zK@e$2H4CXX@W2\\h.n&j(0b~yh",
  database: 'worksheets_prod',
  options: { encrypt: false, trustServerCertificate: true },
}

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
       id           INT IDENTITY(1,1) PRIMARY KEY,
       part_id      INT            NOT NULL REFERENCES [part](id),
       PDF_path     NVARCHAR(500)  NULL,
       DWG_path     NVARCHAR(500)  NULL,
       STP_path     NVARCHAR(500)  NULL,
       CAM_path     NVARCHAR(500)  NULL,
       card_path    NVARCHAR(500)  NULL,
       all_drawings BIT            NULL DEFAULT 0
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
       id              INT IDENTITY(1,1) PRIMARY KEY,
       part_id         INT            NOT NULL REFERENCES [part](id),
       operation_id    INT            NOT NULL REFERENCES [operation](id),
       phase_id        INT            NULL     REFERENCES [phase](id) DEFAULT 16,
       time_estimated  DECIMAL(10,2)  NULL,
       time_real       DECIMAL(10,2)  NULL,
       operation_order INT            NULL,
       barcode         NVARCHAR(100)  NULL,
       cost            DECIMAL(10,2)  NULL,
       notes           NVARCHAR(1000) NULL
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
       id              INT IDENTITY(1,1) PRIMARY KEY,
       part_id         INT            NOT NULL REFERENCES [part](id),
       commercial_id   INT            NULL,
       dim_a_est       DECIMAL(10,4)  NULL,
       dim_b_est       DECIMAL(10,4)  NULL,
       dim_c_est       DECIMAL(10,4)  NULL,
       material_est_id INT            NULL REFERENCES [material](id),
       dim_a_real      DECIMAL(10,4)  NULL,
       dim_b_real      DECIMAL(10,4)  NULL,
       dim_c_real      DECIMAL(10,4)  NULL,
       area_one        DECIMAL(10,4)  NULL,
       weight_one      DECIMAL(10,4)  NULL,
       weight_real_set DECIMAL(10,4)  NULL,
       material_id     INT            NULL REFERENCES [material](id),
       cost_kit        DECIMAL(10,2)  NULL
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

const str = v => v != null ? `N'${String(v).replace(/'/g, "''")}'` : 'NULL'

async function seedConfig(pool) {
  // Lokalizacje — tylko jeśli tabela pusta
  const locCount = await pool.request().query('SELECT COUNT(*) AS cnt FROM [location]')
  if (locCount.recordset[0].cnt === 0) {
    const locVals = seed.locations.map(l =>
      `(${l.id}, ${str(l.name)}, ${str(l.place)}, ${str(l.barcode)})`
    ).join(',\n      ')
    await pool.request().query(`
      SET IDENTITY_INSERT [location] ON
      INSERT INTO [location] (id, name, place, barcode) VALUES ${locVals}
      SET IDENTITY_INSERT [location] OFF
    `)
    console.log(`✅ Lokalizacje: ${seed.locations.length}`)
  } else {
    console.log('⏭  Lokalizacje: już istnieją, pomijam')
  }

  // Fazy — tylko jeśli tabela pusta
  const phCount = await pool.request().query('SELECT COUNT(*) AS cnt FROM [phase]')
  if (phCount.recordset[0].cnt === 0) {
    const phaseVals = seed.phases.map(p =>
      `(${p.id}, ${str(p.name)}, ${str(p.type)}, ${p.location_id ?? 'NULL'}, ${str(p.description)})`
    ).join(',\n      ')
    await pool.request().query(`
      SET IDENTITY_INSERT [phase] ON
      INSERT INTO [phase] (id, name, type, location_id, description) VALUES ${phaseVals}
      SET IDENTITY_INSERT [phase] OFF
    `)
    console.log(`✅ Fazy: ${seed.phases.length}`)
  } else {
    console.log('⏭  Fazy: już istnieją, pomijam')
  }

  // Operacje — tylko jeśli tabela pusta
  const opCount = await pool.request().query('SELECT COUNT(*) AS cnt FROM [operation]')
  if (opCount.recordset[0].cnt === 0) {
    const opVals = seed.operations.map(o =>
      `(${o.id}, ${str(o.name)}, ${o.hour_cost ?? 'NULL'}, ${o.number_of_workers ?? 'NULL'}, ${str(o.barcode)})`
    ).join(',\n      ')
    await pool.request().query(`
      SET IDENTITY_INSERT [operation] ON
      INSERT INTO [operation] (id, name, hour_cost, number_of_workers, barcode) VALUES ${opVals}
      SET IDENTITY_INSERT [operation] OFF
    `)
    console.log(`✅ Operacje: ${seed.operations.length}`)
  } else {
    console.log('⏭  Operacje: już istnieją, pomijam')
  }
}

async function setup() {
  console.log('Łączenie z bazą produkcyjną...')
  const pool = await sql.connect(config)
  console.log('✅ Połączono z worksheets_prod')

  await createSchema(pool)
  await seedConfig(pool)
  await sql.close()

  console.log('\n🎉 Baza produkcyjna gotowa!\n')
}

setup().catch(err => {
  console.error('❌', err.message)
  process.exit(1)
})
