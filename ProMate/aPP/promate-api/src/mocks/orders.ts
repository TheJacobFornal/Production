export const mockOrders = [
  { id: 1, order_number: 'W263004-DS-06',    MOS_number: 'W263004-DS-06',    created_at: new Date('2026-01-01'), closed_at: null, folder_path: null, all_drawings: false, barcode: null, phase_id: 2 },
  { id: 2, order_number: 'W261013-IZ-05',    MOS_number: 'W261013-IZ-05',    created_at: new Date('2026-01-01'), closed_at: null, folder_path: null, all_drawings: false, barcode: null, phase_id: 2 },
  { id: 3, order_number: 'W251003-GC010-81', MOS_number: 'W251003-GC010-81', created_at: new Date('2026-01-01'), closed_at: null, folder_path: null, all_drawings: false, barcode: null, phase_id: 2 },
  { id: 4, order_number: 'W253009-IV-26',    MOS_number: 'W253009-IV-26',    created_at: new Date('2026-01-01'), closed_at: null, folder_path: null, all_drawings: false, barcode: null, phase_id: 2 },
  { id: 5, order_number: 'W251003-GC010-82', MOS_number: 'W251003-GC010-82', created_at: new Date('2026-01-01'), closed_at: null, folder_path: null, all_drawings: false, barcode: null, phase_id: 2 },
  { id: 6, order_number: 'W253013-BN-06',    MOS_number: 'W253013-BN-06',    created_at: new Date('2026-01-01'), closed_at: null, folder_path: null, all_drawings: false, barcode: null, phase_id: 2 },
  { id: 7, order_number: 'O260050-KP',       MOS_number: 'O260050-KP',       created_at: new Date('2026-01-01'), closed_at: null, folder_path: null, all_drawings: false, barcode: null, phase_id: 2 },
  { id: 8, order_number: 'O260051-BE',       MOS_number: 'O260051-BE',       created_at: new Date('2026-01-01'), closed_at: null, folder_path: null, all_drawings: false, barcode: null, phase_id: 2 },
]

export const mockParts = [
  // ─── W263004-DS-06 (order_id=1) ──────────────────────────────────────────────
  { id:  1, order_id: 1, symbol: 'A', part_number: 'DS50.08.03.00.03', name: 'RAMIE_WYSIEGU',   quantity_right: 2, quantity_left: 0, deadline_at: new Date('2026-07-07'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
  { id:  2, order_id: 1, symbol: 'B', part_number: 'DS50.14.01.00.01', name: 'PODSTAWA',        quantity_right: 3, quantity_left: 0, deadline_at: new Date('2026-07-07'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
  { id:  3, order_id: 1, symbol: 'C', part_number: 'DS50.14.01.00.02', name: 'PLYTA_SILOWNIKA', quantity_right: 2, quantity_left: 0, deadline_at: new Date('2026-07-07'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
  { id:  4, order_id: 1, symbol: 'D', part_number: 'DS50.14.01.00.03', name: 'SZYNA_HGR15T',    quantity_right: 1, quantity_left: 0, deadline_at: new Date('2026-07-07'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
  { id:  5, order_id: 1, symbol: 'E', part_number: 'DS50.14.02.00.01', name: 'PLYTKA_PIN',      quantity_right: 1, quantity_left: 0, deadline_at: new Date('2026-07-07'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
  { id:  6, order_id: 1, symbol: 'F', part_number: 'DS50.14.02.00.03', name: 'PIN_BAZUJ_2',     quantity_right: 1, quantity_left: 0, deadline_at: new Date('2026-07-07'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
  { id:  7, order_id: 1, symbol: 'G', part_number: 'DS50.14.02.00.05', name: 'PLYTKA_WOZKA',    quantity_right: 1, quantity_left: 0, deadline_at: new Date('2026-07-07'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
  { id:  8, order_id: 1, symbol: 'H', part_number: 'DS50.14.02.00.06', name: 'KOSTKA_DYSTANS',  quantity_right: 1, quantity_left: 0, deadline_at: new Date('2026-07-07'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
  { id:  9, order_id: 1, symbol: 'I', part_number: 'DS50.14.02.00.07', name: 'KOSTKA_ZDERZAKA', quantity_right: 1, quantity_left: 0, deadline_at: new Date('2026-07-07'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
  { id: 10, order_id: 1, symbol: 'J', part_number: 'FS31.04.00.00.04', name: 'TULEJKA',         quantity_right: 2, quantity_left: 0, deadline_at: new Date('2026-07-07'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
  { id: 11, order_id: 1, symbol: 'K', part_number: 'ZR10.04.01.00.02', name: 'SPRZEGLO',        quantity_right: 1, quantity_left: 0, deadline_at: new Date('2026-07-07'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
  { id: 12, order_id: 1, symbol: 'L', part_number: 'DS50.03.10.00.01', name: 'MOCOW_MIECZ',     quantity_right: 1, quantity_left: 0, deadline_at: new Date('2026-07-07'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
  { id: 13, order_id: 1, symbol: 'M', part_number: 'DS50.03.11.00.01', name: 'MOCOW_MIECZ',     quantity_right: 1, quantity_left: 0, deadline_at: new Date('2026-07-07'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
  { id: 14, order_id: 1, symbol: 'N', part_number: 'DS50.03.11.00.03', name: 'BLOKADA',         quantity_right: 1, quantity_left: 0, deadline_at: new Date('2026-07-07'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
  { id: 15, order_id: 1, symbol: 'O', part_number: 'DS50.08.01.00.06', name: 'KOSTKA_CZUJNIK',  quantity_right: 1, quantity_left: 0, deadline_at: new Date('2026-07-07'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
  { id: 16, order_id: 1, symbol: 'P', part_number: 'DS50.08.02.00.11', name: 'ZABIERAK',        quantity_right: 1, quantity_left: 0, deadline_at: new Date('2026-07-07'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
  { id: 17, order_id: 1, symbol: 'Q', part_number: 'DS50.08.03.00.01', name: 'UCHWYT_NAPED',    quantity_right: 1, quantity_left: 0, deadline_at: new Date('2026-07-07'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },

  // ─── W261013-IZ-05 (order_id=2) ──────────────────────────────────────────────
  { id: 18, order_id: 2, symbol: 'A', part_number: 'IZ33.02.00.00.01', name: 'UCHWYT_CZUJNIK', quantity_right: 4, quantity_left: 0, deadline_at: new Date('2026-06-19'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
  { id: 19, order_id: 2, symbol: 'B', part_number: 'IZ33.02.00.00.02', name: 'WALEK_NOSNY',    quantity_right: 4, quantity_left: 0, deadline_at: new Date('2026-06-19'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
  { id: 20, order_id: 2, symbol: 'C', part_number: 'IZ33.02.00.00.03', name: 'WALEK_NOSNY_2',  quantity_right: 1, quantity_left: 0, deadline_at: new Date('2026-06-19'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },

  // ─── W251003-GC010-81 (order_id=3) ───────────────────────────────────────────
  { id: 21, order_id: 3, symbol: 'A', part_number: 'GC010.01.11.00.01', name: 'OPRAWA_TRZPIEN', quantity_right: 5, quantity_left: 0, deadline_at: new Date('2026-06-12'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
  { id: 22, order_id: 3, symbol: 'B', part_number: 'GC010.02.03.03.07', name: 'UCHWYT_PESZLA',  quantity_right: 3, quantity_left: 0, deadline_at: new Date('2026-06-12'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
  { id: 23, order_id: 3, symbol: 'C', part_number: 'GC010.02.03.03.08', name: 'POKRYWA_UCHWYT', quantity_right: 1, quantity_left: 0, deadline_at: new Date('2026-06-12'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },

  // ─── W253009-IV-26 (order_id=4) ──────────────────────────────────────────────
  { id: 24, order_id: 4, symbol: 'A', part_number: 'IV20.03.02.00.02E', name: 'PLYTA_WODZACA', quantity_right: 1, quantity_left: 0, deadline_at: new Date('2026-06-09'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },

  // ─── W251003-GC010-82 (order_id=5) ───────────────────────────────────────────
  { id: 25, order_id: 5, symbol: 'A', part_number: 'GC010.07.01.00.02a', name: 'osadz_silow', quantity_right: 1, quantity_left: 0, deadline_at: new Date('2026-06-10'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },

  // ─── W253013-BN-06 (order_id=6) ──────────────────────────────────────────────
  { id: 26, order_id: 6, symbol: 'A', part_number: 'BN13.01.00.00.01', name: 'BLAT_REGAL', quantity_right: 6, quantity_left: 0, deadline_at: new Date('2026-06-26'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
  { id: 27, order_id: 6, symbol: 'B', part_number: 'BN13.02.01.00.01', name: 'PL_MOCUJ',   quantity_right: 4, quantity_left: 0, deadline_at: new Date('2026-06-26'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
  { id: 28, order_id: 6, symbol: 'C', part_number: 'BN13.02.03.00.01', name: 'PL_BOCZNY',  quantity_right: 1, quantity_left: 0, deadline_at: new Date('2026-06-26'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
  { id: 29, order_id: 6, symbol: 'D', part_number: 'BN13.02.03.00.02', name: 'PLYTA_OSL',  quantity_right: 1, quantity_left: 0, deadline_at: new Date('2026-06-26'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
  { id: 30, order_id: 6, symbol: 'E', part_number: 'BN13.02.03.00.03', name: 'ZABIERAK',   quantity_right: 1, quantity_left: 0, deadline_at: new Date('2026-06-26'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },

  // ─── O260050-KP (order_id=7) ─────────────────────────────────────────────────
  { id: 31, order_id: 7, symbol: 'A', part_number: 'C02', name: 'Płyta boczna',             quantity_right: 1, quantity_left: 0, deadline_at: new Date('2026-06-22'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
  { id: 32, order_id: 7, symbol: 'B', part_number: 'C03', name: 'Płyta montażowa silników', quantity_right: 1, quantity_left: 0, deadline_at: new Date('2026-06-22'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },

  // ─── O260051-BE (order_id=8) ─────────────────────────────────────────────────
  { id: 33, order_id: 8, symbol: 'A', part_number: 'przeróbka koła', name: 'przeróbka koła', quantity_right: 1, quantity_left: 0, deadline_at: new Date('2026-06-09'), phase_id: 9, location_id: null, card_printed: false, sticker_printed: false, barcode: null, finished_at: null },
]
