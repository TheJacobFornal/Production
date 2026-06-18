import os
import shutil
import unicodedata

import pyodbc
from datetime import date, timedelta, datetime
from pathlib import Path

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
    left join mg_vv_NagLog NLog on NLog.NagId = z.NagId
    where NLog.OprType = 'STAT\\NAD\\DZIENNIK' and z.Data = ?
    order by z.Data desc
    """, (date))
    
    rows = cursor.fetchall()
    for row in rows:
        print(row.Numer, row.NumerDok, row.Opis, row.Data)
        if not check_existence_in_promate(row.Opis, row.Numer, row.NagId):                    # check and add oreder to ProMate if it doesn't exist
            parts = process_order_parts(row.NagId)
            add_parts_to_promate(parts, row.NagId)                     # get parts details and add to ProMate if order was added 
            files_main(row.NumerDok, parts)


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
        INSERT INTO [order] (order_number, MOS_number, created_at, all_drawings, NagId, phase_id)
        VALUES (?, ?, ?, 0, ?, (Select top 1 id from phase where name = 'Z2'))
    """, (str(order_number), str(MOS_number), datetime.now().replace(second=0, microsecond=0), str(NagId)))
    pm_conn.commit()
    
    
    print(f"Order {order_number} added to ProMate.")
    
order_parts = []


#==#   Parts details from Order  #==#

def get_left_parts(NagId):
    cursor.execute(
        """select distinct m.NagId, m.LinId, w.NrKat from mg_lin m
            left join wusr_vv_mg_Lin_ZamW_E w on w.SymKar = m.SymKar


            where m.NagId = ? and w.NrKat like '%L'
            order by NrKat desc""",
                    (NagId),
    )
    rows = cursor.fetchall()
    return rows


def get_right_parts(NagId):
    cursor.execute(
        """select distinct m.NagId, w.NrKat, m.LinId from mg_lin m
            left join wusr_vv_mg_Lin_ZamW_E w on w.SymKar = m.SymKar


            where m.NagId = ? and not w.NrKat like '%L'
            order by NrKat desc""",
                    (NagId),
    )
    rows = cursor.fetchall()
    return rows


def find_actual_path(erp_path):
    if not erp_path:
        return None
    erp_path = unicodedata.normalize('NFC', str(erp_path))
    p = Path(erp_path)
    folder = p.parent
    filename = p.name.lower()
    try:
        entries = list(os.scandir(folder))
        for entry in entries:
            if entry.name.lower() == filename:
                print(f"  [ZNALEZIONO] {entry.path}")
                return entry.path
        print(f"  [BRAK] '{filename}' nie znaleziono w {folder}")
    except Exception as e:
        print(f"  [BŁĄD] scandir({folder}): {e}")
    return None


def add_part_details(row, parts):
        symbol, name, quantity, deadline = get_part_details(row.NagId, row.LinId)
        PDF_path, DWG_path, STP_path = get_part_paths(row.NagId, row.LinId)
        print(f"  PDF: {repr(PDF_path)}")
        print(f"  DWG: {repr(DWG_path)}")
        print(f"  STP: {repr(STP_path)}")
        material, kop1, kop2, part_number = get_part_material_kooperation(row.NagId, row.LinId)

        if kop1 and 'Brak' in kop1:
            kop1 = None
        elif "/" in kop1:
            kop1 = kop1.split("/")[0].strip()
        
        
        if kop2 and 'Brak' in kop2:
            kop2 = None
        elif "/" in kop2:
            kop2 = kop2.split("/")[0].strip()


        parts[part_number] = {
            'symbol': symbol,
            'name': name,
            'quantity_right': quantity,
            'quantity_left': 0,
            'deadline': deadline,
            'PDF_path': find_actual_path(PDF_path),
            'DWG_path': find_actual_path(DWG_path),
            'STP_path': find_actual_path(STP_path),
            'material': material,
            'kop1': kop1,
            'kop2': kop2,
            'NagId': row.NagId,
            'LinId': row.LinId
        }
        
        """
        
        print(f"  part_number : {part_number}")
        print(f"  symbol      : {symbol}")
        print(f"  name        : {name}")
        print(f"  quantity_R  : {quantity}")
        print(f"  deadline    : {deadline}")
        print(f"  material    : {material}")
        print(f"  kop1        : {kop1}")
        print(f"  kop2        : {kop2}")
        print(f"  PDF_path    : {PDF_path}")
        print(f"  DWG_path    : {DWG_path}")
        print(f"  STP_path    : {STP_path}")
        print(f"  NagId       : {row.NagId}")
        print(f"  LinId       : {row.LinId}")
        print()
        print(f"  {part_number} | {name} | R:{quantity} L:0 | {deadline} | {material} | {PDF_path}")
        """

def process_order_parts(NagId):
    parts = {}

    right_parts = get_right_parts(NagId)
    left_parts = get_left_parts(NagId)


    print(f"Right parts: {len(right_parts)}")
    for r in right_parts: print(f"  {r.NrKat}")

    print(f"Left parts: {len(left_parts)}")
    for r in left_parts: print(f"  {r.NrKat}")
        
    
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
        
        
def check_material_existence(material_name): 
    pm_cursor.execute("SELECT id FROM material WHERE name = ?", (material_name,))
    print(f"Sprawdzam materiał: {material_name}")
    row = pm_cursor.fetchone()
    if row is None:
        print(f"nie ma materiału , {material_name}")
        pm_cursor.execute("INSERT INTO material (name) VALUES (?)", (material_name,))
        pm_conn.commit()
        return True
    
def check_cooperation_existence(cooperation_name):
    cooperation_name = str(cooperation_name).strip()
    pm_cursor.execute("SELECT id FROM cooperation WHERE name = ?", (cooperation_name,))
    row = pm_cursor.fetchone()
    if row is None:
        print(f"Dodaję kooperację: {cooperation_name}")
        pm_cursor.execute("INSERT INTO cooperation (name) OUTPUT INSERTED.id VALUES (?)", (cooperation_name,))
        coop_id = pm_cursor.fetchone()[0]
        pm_conn.commit()
        return coop_id
    return row[0]
  
       
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

        check_material_existence(part['material'])
        
        pm_cursor.execute("""
            INSERT INTO form_log (part_id, material_est_id)
            VALUES (?, (SELECT TOP 1 id FROM material WHERE name = ?))
        """, (part_id, part['material']))
        
        
        check_cooperation_existence(part['kop1'])
        check_cooperation_existence(part['kop2'])
        #print(part['material'])
        
        
        slot = 1
        if part['kop1']:
            pm_cursor.execute("""
                INSERT INTO cooperation_log (part_id, cooperation_id, slot)
                VALUES (?, (SELECT TOP 1 id FROM cooperation WHERE name = ?), ?)
            """, (part_id, part['kop1'], slot))
            slot = 2

        if part['kop2']:
            pm_cursor.execute("""
                INSERT INTO cooperation_log (part_id, cooperation_id, slot)
                VALUES (?, (SELECT TOP 1 id FROM cooperation WHERE name = ?), ?)
            """, (part_id, part['kop2'], slot))

        pm_conn.commit()
        #print(f"  Part {part_number} added.")
        
        # przekopiowanie rysunków do folderu ProMate
        


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




def files_main(order_number, parts):
    
    print("files main")
    folder = create_folder(order_number)
    copy_files_to_folder(parts, folder)
    
    
    
def create_folder(order_number):
    folder_path = Path(f"C:/Users/JakubFornal/Desktop/ProMate_rysunki/{order_number}")
    folder_path.mkdir(parents=True, exist_ok=True)
    return folder_path


def copy_files_to_folder(parts, folder_path):
    print("kopiowanie rysunkow")
    for part_number, part in parts.items():
        if part['PDF_path']:
            if os.path.exists(part['PDF_path']):
                pdf_dest = folder_path / f"{part_number}.pdf"
                shutil.copy(part['PDF_path'], pdf_dest)
                print("PDF elo: ", part['PDF_path'])
            else:
                print(f"  [BRAK] PDF nie znaleziony: {part['PDF_path']}")
        if part['DWG_path']:
            if os.path.exists(part['DWG_path']):
                dwg_dest = folder_path / f"{part_number}.dwg"
                shutil.copy(part['DWG_path'], dwg_dest)
            else:
                print(f"  [BRAK] DWG nie znaleziony: {part['DWG_path']}")
        if part['STP_path']:
            if os.path.exists(part['STP_path']):
                stp_dest = folder_path / f"{part_number}.stp"
                shutil.copy(part['STP_path'], stp_dest)
            else:
                print(f"  [BRAK] STP nie znaleziony: {part['STP_path']}")


def main():
    main_folder = r"C:\Users\JakubFornal\Desktop\ProMate_rysunki"
    
    today = date.today() - timedelta(days=3)  # yesterday's date # yesterday's date
    #today = date.today() 
    check_softlab_orders(today)




import time

if __name__ == "__main__":
    while True:
        try:
            print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Uruchamiam import...")
            main()
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Gotowe. Następne sprawdzenie za 2 minuty.\n")
        except Exception as e:
            print(f"[BŁĄD] {e}")
        time.sleep(120)
    
    
    
cursor.close()
conn.close()

    