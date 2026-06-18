export interface Order {
  id: number
  order_number: string
  MOS_number: string | null
  created_at: string
  closed_at: string | null
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
  finished_at: string | null
  rework_parent_part_id: number | null
  deadline_at: string | null
}

export interface OrderListItem {
  order_number:    string
  deadline_at:     string | null
  parts_count:     number
  completed_count: number
  phase_name:      string | null
}

export interface OrderSummary {
  order_number: string
  deadline_at:  string | null
  parts_count:  number
  phase_name:   string | null
}
