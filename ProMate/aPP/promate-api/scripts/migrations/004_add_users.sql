IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='position' AND xtype='U')
CREATE TABLE [position] (
  id   INT IDENTITY(1,1) PRIMARY KEY,
  name NVARCHAR(100) NOT NULL
)

GO

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user' AND xtype='U')
CREATE TABLE [user] (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  name        NVARCHAR(100) NOT NULL,
  surname     NVARCHAR(100) NOT NULL,
  email       NVARCHAR(255) NULL,
  position_id INT           NULL REFERENCES [position](id),
  is_active   BIT           NOT NULL DEFAULT 1,
  created_at  DATETIME2     NOT NULL DEFAULT GETDATE()
)

GO

IF NOT EXISTS (SELECT 1 FROM [position])
INSERT INTO [position] (name) VALUES
  ('Operator CNC'),
  ('Technolog'),
  ('Kierownik produkcji'),
  ('Administrator')
