declare module 'textbox-for-pdfkit' {


  export type TextStyle = {
    font?: string
    fontSize?: number
    lineHeight?: number
    align?: 'left' | 'right' | 'center'
    color?: string
    removeSubsequentSpaces?: boolean
    link?: string
    oblique?: number
    underline?: boolean
    newLine?: boolean
    strike?: boolean
  }

  export type TextString = TextStyle & {
    text: string
  }

  export default function addTextbox(
    text: TextString[],
    doc: PDFKit.PDFDocument,
    posX: number,
    posY: number,
    width: number,
    style?: TextStyle,
  ): void
}
