#!/usr/bin/env node
import axios from 'axios'
import addTextbox, { TextStyle } from 'textbox-for-pdfkit'
import QRCode from 'qrcode-generator'
import fs from 'fs'
import PDFDocument from 'pdfkit'
import { sign } from 'crypto'

const gifFrames = require('gif-frames')
const { WritableStreamBuffer } = require('stream-buffers')

const InitialBufferSize = 800
const OneK = 1024

/**
 * @param {string} url URL to retrieve GIF from
 * @returns {Promise<Buffer>} a Promise with a Buffer
 */
const convertGifToPng = (url: string): Promise<Buffer> => {
  return new Promise((resolve) => {
    const writer = new WritableStreamBuffer({
      initialSize: InitialBufferSize * OneK,
    })

    gifFrames({
      url,
      frames: 0,
      outputType: 'PNG',
    }).then((frameData: any) => {
      frameData.shift().getImage().pipe(writer)
    })

    writer.on('finish', () => {
      resolve(writer.getContents())
    })
  })
}

class CesiumCardCreator {
  uid: string
  pubKey: string
  width: number
  height: number
  pdfDoc: PDFKit.PDFDocument
  qr: QRCode

  constructor(uid: string, pubKey: string, width: number, height: number) {
    this.uid = uid
    this.pubKey = pubKey
    this.width = width
    this.height = height
    // generate PDF
    this.pdfDoc = new PDFDocument({ size: [width, height], margin: 0 })
    this.pdfDoc.registerFont('Fontawesome', 'fonts/Font-Awesome-6-Free-Solid-900.otf')
    this.pdfDoc.pipe(fs.createWriteStream(`user-${uid}.pdf`))

    // Generate QrCode
    this.qr = QRCode(4, 'M')
    this.qr.addData(pubKey)
    this.qr.make()
  }

  async build() {
    const image = await convertGifToPng(this.qr.createDataURL(10))

    const halfW = this.width / 2
    const halfH = this.height / 2
    this.pdfDoc.rect(0, 0, halfW, halfH).stroke()
    this.pdfDoc.rect(halfW, 0, halfW, halfH).stroke()
    this.pdfDoc.rect(0, halfH, halfW, halfH).stroke()
    this.pdfDoc.rect(halfW, halfH, halfW, halfH).stroke()

    // Build one card
    for (let position = 1; position < 5; position++) {
      this.buildCard(position, image)
    }

    this.pdfDoc.end()
  }

  buildCard(position: number, image: Buffer) {
    const halfW = this.width / 2
    const halfH = this.height / 2
    const baseX = position % 2 ? 0 : halfW
    const baseY = position > 2 ? halfH : 0
    let Y = baseY + 50

    const textStyle: TextStyle = {
      color: 'black',
      font: 'Helvetica',
      align: 'center',
      fontSize: 30,
    }
    const boxStyle = {
      textStyle,
      x: 0,
      y: 50,
      width: this.width / 2,
      fontSize: {
        base: textStyle.fontSize,
        highlight: 36,
        key: 18,
      },
    }

    addTextbox(
      [
        { text: 'identifiant: ', lineHeight: 50, fontSize: boxStyle.fontSize.base },
        { text: `${this.uid}`, fontSize: boxStyle.fontSize.highlight, lineHeight: 50, font: 'Helvetica-Bold' },
      ],
      this.pdfDoc,
      baseX + boxStyle.x,
      Y + boxStyle.y,
      boxStyle.width,
      boxStyle.textStyle,
    )
    Y += boxStyle.y

    addTextbox(
      [
        { text: ` `, font: 'Fontawesome', fontSize: boxStyle.fontSize.key + 2 },
        { text: `${this.pubKey}`, fontSize: boxStyle.fontSize.key, font: 'Helvetica-Bold' },
      ],
      this.pdfDoc,
      baseX + boxStyle.x,
      Y + 30,
      boxStyle.width,
      boxStyle.textStyle,
    )

    Y += boxStyle.y + 50

    this.pdfDoc.image(image, baseX + 70, Y, {
      fit: [boxStyle.width - 140, boxStyle.width - 140],
      align: 'center',
      valign: 'center',
    })

    Y += boxStyle.width - 140

    const X = baseX + 100
    this.pdfDoc.image('./Cesium_logo_200px.png', X, Y, { fit: [100, 100] })

    addTextbox(
      [
        { text: `Téléchargez l'app Césium`, align: 'left' },
        { text: `https://cesium.app/fr/`, newLine: true, color: `blue`, align: 'left', link: 'https://cesium.app/fr/' },
      ],
      this.pdfDoc,
      X + 120,
      Y + 30,
      boxStyle.width,
      { ...boxStyle.textStyle, fontSize: 24 },
    )
    Y += 110
  }
}

const go = async (keys: string[]) => {
  const instance = axios.create({
    baseURL: 'https://g1.duniter.org',
    timeout: 10000,
    headers: { 'X-Custom-Header': 'foobar' },
  })

  for (const pubKey of keys) {
    try {
      const response = await instance.get('/wot/lookup/' + pubKey)
      // get user uid
      const uid = response.data.results[0].uids[0].uid

      const builder = new CesiumCardCreator(uid, pubKey, 1240, 1754) // 150dpi
      await builder.build()

      console.log(`Created file: user-${uid}.pdf`)
    } catch (error) {
      console.error('Error occured')
      console.error(error)
    }
  }
  console.log(`>> end`)
}

let keys = process.argv.slice(2)
if (keys[0] === 'file') {
  keys = fs.readFileSync('.profiles').toString().split("\n")
}
go(keys)
