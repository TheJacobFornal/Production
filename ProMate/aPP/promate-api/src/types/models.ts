export interface Order {
  id: number
  order_number: string
  MOS_number: string | null
  created_at: Date
  closed_at: Date | null
  folder_path: string | null
  all_drawings: boolean
  barcode: string | null
  phase_id: number | null
}

export interface Part {
  id: number
  order_id: number
  symbol: string | null
  part_number: string
  name: string
  quantity_right: number
  quantity_left: number
  phase_id: number | null
  location_id: number | null
  card_printed: boolean
  sticker_printed: boolean
  barcode: string | null
  finished_at: Date | null
  producer: string | null
  comment:  string | null
}

export interface User {
  id: number
  name: string
  surname: string
  email: string | null
  position_id: number | null
  is_active: boolean
  barcode: string | null
  rfid_uid: string | null
  created_at: Date
}
