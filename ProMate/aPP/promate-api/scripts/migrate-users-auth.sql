-- ============================================================
-- ProMate - migracja: haslo i flaga admin w tabeli [user]
-- Uruchom jednorazowo na bazie produkcyjnej
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[user]') AND name = 'password_hash')
  ALTER TABLE [user] ADD password_hash NVARCHAR(255) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[user]') AND name = 'is_admin')
  ALTER TABLE [user] ADD is_admin BIT NOT NULL DEFAULT 0;
