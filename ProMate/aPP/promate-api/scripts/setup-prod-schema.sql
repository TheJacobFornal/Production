-- ============================================================
-- ProMate - schemat bazy produkcyjnej
-- Uruchom na bazie: worksheets_prod
-- Bezpieczny: nie usuwa istniejacych tabel ani danych
-- ============================================================

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='location' AND xtype='U')
CREATE TABLE [location] (
  id      INT IDENTITY(1,1) PRIMARY KEY,
  name    NVARCHAR(100) NOT NULL,
  place   NVARCHAR(100) NULL,
  barcode NVARCHAR(100) NULL
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='phase' AND xtype='U')
CREATE TABLE [phase] (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  name        NVARCHAR(100) NOT NULL,
  location_id INT NULL REFERENCES [location](id),
  type        NVARCHAR(50)  NULL,
  description NVARCHAR(255) NULL
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='order' AND xtype='U')
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
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='part' AND xtype='U')
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
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='paths' AND xtype='U')
CREATE TABLE [paths] (
  id           INT IDENTITY(1,1) PRIMARY KEY,
  part_id      INT            NOT NULL REFERENCES [part](id),
  PDF_path     NVARCHAR(500)  NULL,
  DWG_path     NVARCHAR(500)  NULL,
  STP_path     NVARCHAR(500)  NULL,
  CAM_path     NVARCHAR(500)  NULL,
  card_path    NVARCHAR(500)  NULL,
  all_drawings BIT            NULL DEFAULT 0
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='material' AND xtype='U')
CREATE TABLE [material] (
  id      INT IDENTITY(1,1) PRIMARY KEY,
  name    NVARCHAR(100) NOT NULL,
  density DECIMAL(10,4) NULL,
  cost    DECIMAL(10,2) NULL,
  unit    NVARCHAR(20)  NULL
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='cooperation' AND xtype='U')
CREATE TABLE [cooperation] (
  id    INT IDENTITY(1,1) PRIMARY KEY,
  name  NVARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NULL,
  unit  NVARCHAR(20)  NULL
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='operation' AND xtype='U')
CREATE TABLE [operation] (
  id                INT IDENTITY(1,1) PRIMARY KEY,
  name              NVARCHAR(100) NOT NULL,
  hour_cost         DECIMAL(10,2) NULL,
  number_of_workers INT           NULL DEFAULT 1,
  barcode           NVARCHAR(100) NULL
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='operation_logs' AND xtype='U')
CREATE TABLE [operation_logs] (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  part_id         INT            NOT NULL REFERENCES [part](id),
  operation_id    INT            NOT NULL REFERENCES [operation](id),
  phase_id        INT            NULL REFERENCES [phase](id) DEFAULT 16,
  time_estimated  DECIMAL(10,2)  NULL,
  time_real       DECIMAL(10,2)  NULL,
  operation_order INT            NULL,
  barcode         NVARCHAR(100)  NULL,
  cost            DECIMAL(10,2)  NULL,
  notes           NVARCHAR(1000) NULL
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='cooperation_log' AND xtype='U')
CREATE TABLE [cooperation_log] (
  id             INT IDENTITY(1,1) PRIMARY KEY,
  part_id        INT NOT NULL REFERENCES [part](id),
  cooperation_id INT NOT NULL REFERENCES [cooperation](id),
  slot           INT NOT NULL,
  phase_id       INT NULL REFERENCES [phase](id) DEFAULT 16,
  cost           DECIMAL(10,2) NULL,
  CONSTRAINT UQ_cooperation_log_part_slot UNIQUE (part_id, slot)
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='form_log' AND xtype='U')
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
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='price' AND xtype='U')
CREATE TABLE [price] (
  id                  INT IDENTITY(1,1) PRIMARY KEY,
  part_id             INT            NOT NULL REFERENCES [part](id),
  cost_commercial_kit DECIMAL(10,2)  NULL,
  cost_labor_hour     DECIMAL(10,2)  NULL,
  cost_cooperation    DECIMAL(10,2)  NULL,
  cost_machining      DECIMAL(10,2)  NULL,
  price_kit           DECIMAL(10,2)  NULL,
  price_piece         DECIMAL(10,2)  NULL
);

-- Migracja: usun stare kolumny z form_log jesli istnieja
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('form_log') AND name='cost_labor_hour')     ALTER TABLE form_log DROP COLUMN cost_labor_hour;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('form_log') AND name='cost_cooperation')    ALTER TABLE form_log DROP COLUMN cost_cooperation;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('form_log') AND name='cost_machining')      ALTER TABLE form_log DROP COLUMN cost_machining;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('form_log') AND name='price_kit')           ALTER TABLE form_log DROP COLUMN price_kit;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('form_log') AND name='price_piece')         ALTER TABLE form_log DROP COLUMN price_piece;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('form_log') AND name='cost_commercial_kit') ALTER TABLE form_log DROP COLUMN cost_commercial_kit;

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='commercial' AND xtype='U')
CREATE TABLE [commercial] (
  id         INT IDENTITY(1,1) PRIMARY KEY,
  form_id    INT            NOT NULL REFERENCES [form_log](id),
  cost       DECIMAL(10,2)  NULL,
  ordered_at DATETIME       NULL,
  arrived_at DATETIME       NULL,
  phase_id   INT            NULL REFERENCES [phase](id)
);

-- ============================================================
-- Dane konfiguracyjne - tylko jesli tabele sa puste
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM [location])
BEGIN
  SET IDENTITY_INSERT [location] ON
  INSERT INTO [location] (id, name, place, barcode) VALUES
    (1, N'Hala A',                 N'Sekcja CNC', N'LOC001'),
    (2, N'Magazyn',                N'Budynek B',  N'LOC002'),
    (3, N'Kooperacja zewnetrzna',  NULL,           NULL)
  SET IDENTITY_INSERT [location] OFF
END

IF NOT EXISTS (SELECT 1 FROM [phase])
BEGIN
  SET IDENTITY_INSERT [phase] ON
  INSERT INTO [phase] (id, name, type, location_id, description) VALUES
    (1,  N'Z1', N'order',     NULL, N'Nowe zamowienie z SoftLab'),
    (2,  N'Z2', N'order',     NULL, N'Zalozono folder i przekopiowano rysunki'),
    (3,  N'Z3', N'order',     NULL, N'Skonczone przez technologow'),
    (4,  N'Z4', N'order',     NULL, N'Gotowe do produkcji'),
    (5,  N'Z5', N'order',     NULL, N'Zaczeto produkcje'),
    (6,  N'Z6', N'order',     NULL, N'Skonczone produkcje'),
    (7,  N'Z7', N'order',     NULL, N'Komplet danych poprodukcyjnych'),
    (8,  N'Z8', N'order',     NULL, N'Wpisano dane do SoftLab'),
    (9,  N'D1', N'part',      NULL, N'Nowy Detal'),
    (10, N'D2', N'part',      NULL, N'Gotowy dla Technologow'),
    (11, N'D3', N'part',      NULL, N'Przypisane czasy operacji, wymiary i kooperacje'),
    (12, N'D4', N'part',      NULL, N'Dopisanie do karty detali (ilosc, numer zlecenia, termin realizacji)'),
    (13, N'D5', N'part',      NULL, N'Wydrukowanie Karty Detalu'),
    (14, N'D6', N'part',      NULL, N'Gotowe do Produkcji'),
    (15, N'D7', N'part',      NULL, N'W trakcie produkcji'),
    (16, N'Oczekuje',     N'operation', NULL, N'Operacja nie zaczeta'),
    (17, N'W realizacji', N'operation', NULL, N'Operacja w trakcie'),
    (18, N'Wykonana',     N'operation', NULL, N'Operacja zakonczona'),
    (21, N'D8', N'part',      NULL, N'Detal skończony'),
    (22, N'D9', N'part',      NULL, N'Komplet danych poprodukcyjnych')
  SET IDENTITY_INSERT [phase] OFF
END

IF NOT EXISTS (SELECT 1 FROM [operation])
BEGIN
  SET IDENTITY_INSERT [operation] ON
  INSERT INTO [operation] (id, name, hour_cost, number_of_workers, barcode) VALUES
    (1,  N'PLOTER',    150, 1, NULL),
    (2,  N'FKG',       120, 1, NULL),
    (3,  N'FKO',       120, 1, NULL),
    (4,  N'TOK',       120, 1, NULL),
    (5,  N'TOKCNC',    180, 1, NULL),
    (6,  N'FCNC',      180, 4, NULL),
    (7,  N'FCNC_ROBO', 180, 1, NULL),
    (8,  N'PIŁA',      100, 1, NULL),
    (9,  N'ŚLUSARNIA', 100, 1, NULL),
    (10, N'SZLIF',     120, 1, NULL),
    (11, N'SPAW',      100, 1, NULL)
  SET IDENTITY_INSERT [operation] OFF
END

IF NOT EXISTS (SELECT 1 FROM [cooperation])
BEGIN
  SET IDENTITY_INSERT [cooperation] ON
  INSERT INTO [cooperation] (id, name, price, unit) VALUES
    (1,  N'Czernić',          15,  N'kg'),
    (2,  N'Czernić TŚ',       15,  N'kg'),
    (3,  N'Czernić MS',        9,  N'kg'),
    (4,  N'Czernić na zimno',  5,  N'kg'),
    (5,  N'Hartować',         10,  N'kg'),
    (6,  N'Cynkować',          3,  N'dm2'),
    (7,  N'Anodować',          3,  N'dm2'),
    (8,  N'Drut',             50,  N'szt'),
    (9,  N'Chrom',           200,  N'szt'),
    (10, N'Chromian',         12,  N'dm2'),
    (11, N'Azotować',        100,  N'szt'),
    (12, N'Frezowanie',      100,  N'szt'),
    (13, N'KTL',              50,  N'szt'),
    (14, N'Proszek',          50,  N'kg'),
    (15, N'Wolframować',      50,  N'szt'),
    (16, N'Szlifować',        50,  NULL),
    (17, N'Polerować',        50,  NULL),
    (18, N'Malować na mokro', 50,  NULL),
    (19, N'Spawać',           50,  NULL)
  SET IDENTITY_INSERT [cooperation] OFF
END

IF NOT EXISTS (SELECT 1 FROM [material])
BEGIN
  SET IDENTITY_INSERT [material] ON
  INSERT INTO [material] (id, name, density, cost, unit) VALUES
    (1,  N'S355',           8,    9,      N'kg'),
    (2,  N'ST37',           8,    7,      N'kg'),
    (3,  N'1.2311',         8,    13.5,   N'kg'),
    (4,  N'C75S',           NULL, NULL,   N'kg'),
    (5,  N'Sp400',          8,    18.5,   N'kg'),
    (6,  N'40H',            8,    9.9,    N'kg'),
    (7,  N'C45',            8,    8.5,    N'kg'),
    (8,  N'nc11lv',         8,    24.9,   N'kg'),
    (9,  N'NC6',            8,    14.5,   N'kg'),
    (10, N'1.2316',         8,    28.5,   N'kg'),
    (11, N'toolox33',       8,    10,     N'kg'),
    (12, N'toolox44',       8,    22.5,   N'kg'),
    (13, N'hardox400',      8,    11,     N'kg'),
    (14, N'ina6',           8,    8,      N'kg'),
    (15, N'ina10',          8,    8,      N'kg'),
    (16, N'ina12',          8,    8,      N'kg'),
    (17, N'ina16',          8,    7.88,   N'kg'),
    (18, N'ina20',          8,    7.88,   N'kg'),
    (19, N'ina25',          8,    7.88,   N'kg'),
    (20, N'ina30',          8,    NULL,   N'kg'),
    (21, N'304',            8,    22,     N'kg'),
    (22, N'1',              8,    0,      N'kg'),
    (23, N'303',            8,    24,     N'kg'),
    (24, N'4H13',           8,    25.5,   N'kg'),
    (25, N'316L',           8,    32,     N'kg'),
    (26, N'poliwęglan #4',  1.2,  19,     N'kg'),
    (27, N'POM-C biały',    1.6,  43.5,   N'kg'),
    (28, N'pom-c',          1.6,  43.5,   N'kg'),
    (29, N'poliamid',       1,    24,     N'kg'),
    (30, N'PE1000',         1,    25,     N'kg'),
    (31, N'corroplast',     8,    19,     N'kg'),
    (32, N'1.2085',         8,    18,     N'kg'),
    (33, N'PTFE',           2.2,  72,     N'kg'),
    (34, N'PEEK',           1.3,  600,    N'kg'),
    (35, N'C250-4',         2.66, 56.24,  N'kg'),
    (36, N'C250-5',         2.66, 35.95,  N'kg'),
    (37, N'C250-6',         2.66, 32.69,  N'kg'),
    (38, N'C250-8',         2.66, 29.14,  N'kg'),
    (39, N'C250-10',        2.66, 28.29,  N'kg'),
    (40, N'C250-12',        2.66, 25.29,  N'kg'),
    (41, N'C250-15',        2.66, 23.93,  N'kg'),
    (42, N'C250-18',        2.66, 23.93,  N'kg'),
    (43, N'C250-20',        2.66, 18.18,  N'kg'),
    (44, N'C250-25',        2.66, 21.94,  N'kg'),
    (45, N'C250-30',        2.66, 17.7,   N'kg'),
    (46, N'C250-35',        2.66, 21.94,  N'kg'),
    (47, N'C250-40',        2.66, 21.94,  N'kg'),
    (48, N'C250-50',        2.66, 21.94,  N'kg'),
    (49, N'C330',           2.76, 37.8,   N'kg'),
    (50, N'BA101(CuSn10P)', 8.9,  105,    N'kg'),
    (51, N'C250-60',        2.66, 21.94,  N'kg'),
    (52, N'PA6',            2.79, 37.8,   N'kg'),
    (53, N'PA9',            2.79, 50,     N'kg')
  SET IDENTITY_INSERT [material] OFF
END

PRINT 'Gotowe! Schemat i dane konfiguracyjne zaladowane.'
