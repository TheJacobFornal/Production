-- Migracja 010: Dodanie fazy zamówienia Z100 Anulowane

IF NOT EXISTS (SELECT 1 FROM [phase] WHERE name = 'Z100' AND type = 'order')
BEGIN
  INSERT INTO [phase] (name, type, location_id, description)
  VALUES ('Z100', 'order', NULL, N'Zamówienie anulowane')
END
