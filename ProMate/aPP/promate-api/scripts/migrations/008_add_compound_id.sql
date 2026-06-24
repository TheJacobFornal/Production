IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[part]') AND name = 'compound_id')
  ALTER TABLE [part] ADD compound_id INT NULL REFERENCES [part](id)
