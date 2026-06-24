-- Migracja 002: Poprawka opisów faz z polskimi znakami (prefix N dla Unicode)

UPDATE [phase] SET description = N'Gotowe do Produkcji – wydrukowano kartę detalu'
WHERE name = 'D6' AND type = 'part'

GO

UPDATE [phase] SET description = N'Operacje skończone – czeka na kooperacje'
WHERE name = 'D8' AND type = 'part'

GO

UPDATE [phase] SET description = N'W trakcie kooperacji'
WHERE name = 'D9' AND type = 'part'

GO

UPDATE [phase] SET description = N'Detal skończony'
WHERE name = 'D10' AND type = 'part'

GO

UPDATE [phase] SET description = N'Komplet danych poprodukcyjnych'
WHERE name = 'D11' AND type = 'part'

GO

-- Weryfikacja (sortowanie numeryczne po cyfrze za D)
SELECT id, name, description FROM [phase]
WHERE type = 'part'
ORDER BY
  CASE WHEN name LIKE 'D%' THEN CAST(SUBSTRING(name, 2, 10) AS INT) ELSE 99 END
