IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[user]') AND name = 'password_hash')
  ALTER TABLE [user] ADD password_hash NVARCHAR(255) NULL

GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[user]') AND name = 'is_admin')
  ALTER TABLE [user] ADD is_admin BIT NOT NULL DEFAULT 0

GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[user]') AND name = 'printer')
  ALTER TABLE [user] ADD printer NVARCHAR(255) NULL

GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[user]') AND name = 'print_karta')
  ALTER TABLE [user] ADD print_karta BIT NOT NULL DEFAULT 1

GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[user]') AND name = 'reset_token')
  ALTER TABLE [user] ADD reset_token NVARCHAR(255) NULL

GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[user]') AND name = 'reset_token_expires')
  ALTER TABLE [user] ADD reset_token_expires DATETIME2 NULL
