IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[order]') AND name = 'typ_zamowienia')
  ALTER TABLE [order] ADD typ_zamowienia NVARCHAR(3) NULL
