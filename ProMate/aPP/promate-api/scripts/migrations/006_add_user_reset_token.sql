IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[user]') AND name = 'reset_token')
  ALTER TABLE [user] ADD reset_token NVARCHAR(255) NULL

GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[user]') AND name = 'reset_token_expires')
  ALTER TABLE [user] ADD reset_token_expires DATETIME2 NULL
