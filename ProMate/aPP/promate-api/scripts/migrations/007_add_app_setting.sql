IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='app_setting' AND xtype='U')
CREATE TABLE [app_setting] (
  [key]   NVARCHAR(100) PRIMARY KEY,
  value   NVARCHAR(500) NULL
)
