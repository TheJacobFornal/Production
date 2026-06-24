import time
from datetime import date, timedelta, datetime
from SoftLab_import.SL_main import check_softlab_orders, init_connections


MODE = "prod"   # "test" or "prod"
#MODE = "test"   # "test" or "prod"

MAIN_FOLDER = r"Y:\Jakub Fornal\MOS_dysk"
#MAIN_FOLDER = r"C:\Users\JakubFornal\Desktop\ProMate_rysunki"


if __name__ == "__main__":
    print(f"\nProMate Import [{MODE}]")
    print("  1 - pętla co 2 minuty (tylko dzisiaj)")
    print("  2 - jednorazowy import X dni wstecz")
    print("  3 - pętla co 2 minuty (konkretna data)")
    choice = input("\nWybór [1/2/3]: ").strip()

    init_connections(MODE)

    if choice == "1":
        while True:
            try:
                print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Sprawdzam {date.today()}...")
                check_softlab_orders(date.today(), MAIN_FOLDER)
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Gotowe. Następne za 2 minuty.\n")
            except Exception as e:
                print(f"[BŁĄD] {e}")
            time.sleep(120)

    elif choice == "2":
        days_back = input("Ile dni wstecz? ").strip()
        if not days_back.isdigit():
            print("Nieprawidłowa liczba.")
        else:
            n = int(days_back)
            today = date.today()
            print(f"\nImport od {today - timedelta(days=n)} do {today} ({n + 1} dni)\n")
            for i in range(n + 1):
                d = today - timedelta(days=i)
                try:
                    print(f"[{i+1}/{n+1}] {d}")
                    check_softlab_orders(d, MAIN_FOLDER)
                except Exception as e:
                    print(f"  [BŁĄD] {d}: {e}")
            print("\nGotowe.\n")

    elif choice == "3":
        data = input("Wpisz datę (Dzień, Mies, Rok): ").strip()
        try:
            parts_d = [int(x.strip()) for x in data.split(',')]
            selected_date = date(parts_d[2], parts_d[1], parts_d[0])
        except Exception:
            print("Nieprawidłowy format daty. Użyj: Dzień, Mies, Rok (np. 23, 6, 2026)")
            exit(1)

        while True:
            try:
                print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Sprawdzam {selected_date}...")
                check_softlab_orders(selected_date, MAIN_FOLDER)
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Gotowe. Następne za 2 minuty.\n")
            except Exception as e:
                print(f"[BŁĄD] {e}")
            time.sleep(120)

    else:
        print("Nieznany wybór.")
