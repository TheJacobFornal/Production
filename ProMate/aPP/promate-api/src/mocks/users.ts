export const mockUsers = [
  {
    id: 1,
    name: 'Jan',
    surname: 'Kowalski',
    email: 'j.kowalski@promate.pl',
    position_id: 1,
    is_active: true,
    barcode: 'USR001',
    rfid_uid: null,
    created_at: new Date('2024-01-01'),
  },
  {
    id: 2,
    name: 'Anna',
    surname: 'Nowak',
    email: 'a.nowak@promate.pl',
    position_id: 2,
    is_active: true,
    barcode: 'USR002',
    rfid_uid: null,
    created_at: new Date('2024-01-01'),
  },
  {
    id: 3,
    name: 'Tomasz',
    surname: 'Wiśniewski',
    email: 't.wisniewski@promate.pl',
    position_id: 3,
    is_active: true,
    barcode: 'USR003',
    rfid_uid: null,
    created_at: new Date('2024-01-01'),
  },
]

export const mockPositions = [
  { id: 1, name: 'Operator CNC' },
  { id: 2, name: 'Technolog' },
  { id: 3, name: 'Kierownik produkcji' },
  { id: 4, name: 'Administrator' },
]
