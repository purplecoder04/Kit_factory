export type FieldSpec = {
  pageIndex: number
  name: string
  kind: "text" | "checkbox"
  x: number
  y: number
  width: number
  height: number
  multiline?: boolean
  fontSize?: number
  textColor?: "plum" | "white"
}
