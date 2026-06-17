import pyodbc
conn = pyodbc.connect(
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=localhost,1433;"
    "DATABASE=promate_test;"
    "UID=sa;"
    "PWD=ProMate_Test123!;"
    "TrustServerCertificate=yes;"
)
cur = conn.cursor()
cur.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME")
tables = [r[0] for r in cur.fetchall()]
print("TABLES:", tables)
for table in tables:
    cur.execute(f"SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='{table}' ORDER BY ORDINAL_POSITION")
    cols = cur.fetchall()
    print(f"\n-- {table}")
    for c in cols:
        print(f"  {c[0]} {c[1]} {'NULL' if c[2]=='YES' else 'NOT NULL'}")
conn.close()
