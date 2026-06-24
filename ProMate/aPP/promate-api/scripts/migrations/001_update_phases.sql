-- ============================================================
-- Migracja 001: Aktualizacja faz detali (D1-D11)
-- ============================================================
-- Uruchom na testowej, sprawdź, potem na produkcyjnej:
--   node scripts/migrate.js migrations/001_update_[phase].sql --env test
--   node scripts/migrate.js migrations/001_update_[phase].sql --env prod
-- ============================================================

-- KROK 1: Zmień stare D8 → D10 i D9 → D11 (zanim zajmiesz ich nazwy)
UPDATE [phase]
SET name = 'D10', description = N'Detal skończony'
WHERE name = 'D8' AND type = 'part'

GO

UPDATE [phase]
SET name = 'D11', description = N'Komplet danych poprodukcyjnych'
WHERE name = 'D9' AND type = 'part'

GO

-- KROK 2: Detale na D5 przesuń na D6 (D5 jest wchłaniane przez D6)
UPDATE [part]
SET phase_id = (SELECT id FROM [phase] WHERE name = 'D6' AND type = 'part')
WHERE phase_id = (SELECT id FROM [phase] WHERE name = 'D5' AND type = 'part')

GO

-- KROK 3: Zaktualizuj opis D6 i usuń D5
UPDATE [phase]
SET description = N'Gotowe do Produkcji – wydrukowano kartę detalu'
WHERE name = 'D6' AND type = 'part'

GO

DELETE FROM [phase] WHERE name = 'D5' AND type = 'part'

GO

-- KROK 4: Wstaw nowe D8 i D9
INSERT INTO [phase] (name, type, location_id, description)
VALUES ('D8', 'part', NULL, N'Operacje skończone – czeka na kooperacje')

GO

INSERT INTO [phase] (name, type, location_id, description)
VALUES ('D9', 'part', NULL, N'W trakcie kooperacji')

GO

-- KROK 5: Weryfikacja – powinno być D1-D4, D6-D11
SELECT id, name, description FROM [phase] WHERE type = 'part' ORDER BY name
