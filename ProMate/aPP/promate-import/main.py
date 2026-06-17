import pyodbc
from datetime import date, timedelta, datetime

# ── SoftLab (SLPROD) ──────────────────────────────────────────────────────────
conn = pyodbc.connect(
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=10.69.13.11\\SLPROD;"
    "DATABASE=SL_PEMES_PROD;"
    "UID=sprawdzenielic;"
    "PWD=Pemes1234;" 
    "TrustServerCertificate=yes;"
)

cursor = conn.cursor()

# ── ProMate (Docker localhost:1433) ───────────────────────────────────────────
pm_conn = pyodbc.connect(
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=localhost,1433;"
    "DATABASE=promate_test;"
    "UID=sa;"
    "PWD=ProMate_Test123!;"
    "TrustServerCertificate=yes;"
)
pm_cursor = pm_conn.cursor()


def query(sql, params=None):
    cursor.execute(sql, params or [])
    cols = [d[0] for d in cursor.description]
    rows = cursor.fetchall()
    print(" | ".join(cols))
    print("-" * 80)
    for row in rows:
        print(" | ".join(str(v) for v in row))
    print(f"\n{len(rows)} rows\n")



# order
order_number = ""
MOS_number = ""

# detal
symbol = ""
name = ""
quantity_left = 0
quantity_right = 0
part_number = ""
pdf_path = ""
dwg_path = ""
stp_path = ""
deadline = ""
material = ""
kop1 = ""
kop2 = ""
NagId = ""
LinId = ""




def check_softlab_orders(date):
    cursor.execute("""
    select nag.NagId, nag.Numer, nag.NumerDok, nag.Opis, nag.Data, nag.Projekt, z.StatusStr, z.Data
    from wusr_mg_VV_PrzegZamWew_MOS_ZB z
    left join mg_nag nag on nag.NagId = z.NagId
    where z.Data = ?
    order by z.Data desc
""", (date))
    
    rows = cursor.fetchall()
    for row in rows:
        print(row.Numer, row.NumerDok, row.Opis, row.Data)
        check_existence_in_promate(row.Opis, row.Numer, row.NagId)                    # check and add oreder to ProMate if it doesn't exist



def check_existence_in_promate(order_number, MOS_number, NagId):
    pm_cursor.execute(
        """SELECT TOP (1000) [id]
        ,[order_number]
        ,[MOS_number]
        FROM [promate_test].[dbo].[order]
        where [order_number] = ?""",
        (order_number),
    )
    rows = pm_cursor.fetchall()
    if len(rows) > 0:
        print("Order already exists in ProMate.")
        return True
    else:
        print("Order does not exist in ProMate.")
        add_order_to_promate(order_number, MOS_number, NagId)
        return False


def add_order_to_promate(order_number, MOS_number, NagId):
    pm_cursor.execute("""
        INSERT INTO [order] (order_number, MOS_number, created_at, all_drawings, NagId)
        VALUES (?, ?, ?, 0, ?)
    """, (str(order_number), str(MOS_number), datetime.now().replace(second=0, microsecond=0), str(NagId)))
    pm_conn.commit()
    
    
    print(f"Order {order_number} added to ProMate.")

order_parts = []




#==#   Parts details from Order  #==#

def get_left_parts(NagId):
    cursor.execute(
        """select distinct w.NagId, w.LinId, w.NrKat from mg_lin m
            left join wusr_vv_mg_Lin_ZamW_E w on w.SymKar = m.SymKar


            where m.NagId = ? and w.NrKat like '%L'
            order by NrKat desc""",
                    (NagId),
    )
    rows = cursor.fetchall()
    return rows


def get_right_parts(NagId):
    cursor.execute(
        """select distinct w.NagId, w.NrKat, w.LinId from mg_lin m
            left join wusr_vv_mg_Lin_ZamW_E w on w.SymKar = m.SymKar


            where m.NagId = ? and not w.NrKat like '%L'
            order by NrKat desc""",
                    (NagId),
    )
    rows = cursor.fetchall()
    return rows


def add_part_details(row, parts):
        symbol, name, quantity, deadline = get_part_details(row.NagId, row.LinId)
        PDF_path, DWG_path, STP_path = get_part_paths(row.NagId, row.LinId)
        material, kop1, kop2, part_number = get_part_material_kooperation(row.NagId, row.LinId) 
        
        parts[part_number] = {
            'symbol': symbol,
            'name': name,
            'quantity_right': quantity,
            'quantity_left': 0,
            'deadline': deadline,
            'PDF_path': PDF_path,
            'DWG_path': DWG_path,
            'STP_path': STP_path,
            'material': material,
            'kop1': kop1,
            'kop2': kop2,
            'NagId': row.NagId,
            'LinId': row.LinId
        }
        print(f"  {part_number} | {name} | R:{quantity} L:0 | {deadline} | {material} | {PDF_path}")
    
    

def process_order_parts(NagId):
    parts = {}

    right_parts = get_right_parts(NagId)
    left_parts = get_left_parts(NagId)
    
    for row in right_parts:
        add_part_details(row, parts)  # add right part details to parts dictionary
    
    for row in left_parts:
        part_number = get_part_material_kooperation(row.NagId, row.LinId)[3]  # get part number
        right_part_number = part_number[:-1]
        
        if right_part_number in parts:
            parts[right_part_number]['quantity_left'] = get_part_details(row.NagId, row.LinId)[2]  # update left quantity
        else:
            add_part_details(row, parts)  # add left part if right part doesn't exist
            
    return parts
            
def add_parts_to_promate(parts, NagId):
    pm_cursor.execute("SELECT id FROM [order] WHERE NagId = ?", (NagId,))
    order_row = pm_cursor.fetchone()
    if not order_row:
        print(f"Order with NagId={NagId} not found in ProMate. Add order first.")
        return
    order_id = order_row[0]

    for part_number, part in parts.items():
        pm_cursor.execute("""
            INSERT INTO part (order_id, part_number, name, symbol, quantity_right, quantity_left, deadline_at, LinId, card_printed, sticker_printed)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
        """, (order_id, part_number, part['name'], part['symbol'], part['quantity_right'], part['quantity_left'], part['deadline'], part['LinId']))

        part_id = pm_cursor.fetchone()[0]

        pm_cursor.execute("""
            INSERT INTO paths (part_id, PDF_path, DWG_path, STP_path)
            VALUES (?, ?, ?, ?)
        """, (part_id, part['PDF_path'], part['DWG_path'], part['STP_path']))

        pm_cursor.execute("""
            INSERT INTO form_log (part_id, material_est_id)
            VALUES (?, (SELECT id FROM material WHERE name = ?))
        """, (part_id, part['material']))
        
        #print(part['material'])

        pm_conn.commit()
        #print(f"  Part {part_number} added.")



def get_part_details(NagId, LinId):
    cursor.execute(
        """ 
        select m.LinId, m.SymKar, m.Opis, m.Ilosc, m.DataStopLin from mg_lin m
    where m.NagId = ? and LinId = ?
        """,
        (NagId, LinId),
    )
    rows = cursor.fetchall()
    return (
        rows[0].SymKar,
        rows[0].Opis,
        rows[0].Ilosc,
        rows[0].DataStopLin,
    )  # symbol, nazwa, quantity, deadline


def get_part_paths(NagId, LinId):
    cursor.execute(
        """ 
        SELECT distinct *
        FROM dbo.wusr_vv_mg_LokalizacjaDokumentacji wl
        where wl.NagId = ? and LinId = ?
        order by LokDokTyp asc
        """,
        (NagId, LinId),
    )
    rows = cursor.fetchall()
    return (
        rows[0].LokDok,
        rows[1].LokDok,
        rows[2].LokDok,
    )  # PDF, DWG, STP paths


def get_part_material_kooperation(NagId, LinId):
    cursor.execute(
        """ 
        select s.[NagId], s.[LinId], s.[NrKat], s.[Materiał], s.[Obróbka cieplna], s.[Obróbka powierzchni] 
        from dbo.wusr_vv_mg_Lin_ZamW_E s
        where s.NagId = ? and s.LinId = ?

        """,
        (NagId, LinId),
    )
    rows = cursor.fetchall()
    return (
    getattr(rows[0], 'Materiał'),
    getattr(rows[0], 'Obróbka cieplna'),
    getattr(rows[0], 'Obróbka powierzchni'),
    rows[0].NrKat
) # symbol, nazwa, quantity, deadline, part_number  # symbol, nazwa, quantity, deadline, part_number




for part in order_parts:
    print(part[1], part[2], part[3])



def main():
    #check_softlab_orders(today)
    

    add_order_to_promate("2026/ZB_WEW/MOS/000267", "W261010-IB052-01/1", "29666")  # Replace with actual order number for testing
    add_parts_to_promate(process_order_parts(29666), "29666")  # Replace with actual order number for testing



if __name__ == "__main__":
    main()
    
    
    
cursor.close()
conn.close()

    