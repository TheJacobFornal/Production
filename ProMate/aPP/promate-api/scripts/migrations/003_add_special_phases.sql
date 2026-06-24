-- Migracja 003: Dodanie specjalnych faz detali (D100-D102)

INSERT INTO [phase] (name, type, location_id, description)
VALUES ('D100', 'part', NULL, N'Detal Anulowany')

GO

INSERT INTO [phase] (name, type, location_id, description)
VALUES ('D101', 'part', NULL, N'Detal wycofany')

GO

INSERT INTO [phase] (name, type, location_id, description)
VALUES ('D102', 'part', NULL, N'Detal wstrzymany')

GO

-- Weryfikacja
SELECT id, name, description FROM [phase]
WHERE type = 'part'
ORDER BY
  CASE WHEN name LIKE 'D%' THEN CAST(SUBSTRING(name, 2, 10) AS INT) ELSE 99 END
