#!/usr/bin/env node
import axios, { AxiosInstance } from 'axios'
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

  constructor(uid: string, pubKey: string, pdfDoc: PDFKit.PDFDocument) {
    this.uid = uid
    this.pubKey = pubKey
    this.pdfDoc = pdfDoc
    const size = pdfDoc.options.size as number[]
    this.width = size[0]
    this.height = size[1]

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

    const idToolong = this.uid.length > 15 ? true : false

    addTextbox(
      [
        { text: 'identifiant: ', fontSize: boxStyle.fontSize.base },
        {
          text: `${this.uid}`,
          fontSize: boxStyle.fontSize.highlight,
          newLine: idToolong,
          font: 'Helvetica-Bold',
        },
      ],
      this.pdfDoc,
      baseX + boxStyle.x,
      Y + boxStyle.y,
      boxStyle.width,
      boxStyle.textStyle,
    )
    Y += boxStyle.y + (idToolong ? boxStyle.y : 0)

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

class PublicKey {
  originalKey: string
  splittedKey: boolean
  name: string = ''
  key: string

  constructor(originalKey: string) {
    this.originalKey = originalKey
    const splitKey = originalKey.split(':')
    if ((this.splittedKey = splitKey.length === 2)) {
      this.key = splitKey[1]
      this.name = splitKey[0]
    } else this.key = this.originalKey
  }
}

class UserData {
  duniter: AxiosInstance
  presle: AxiosInstance

  constructor() {
    this.duniter = axios.create({
      baseURL: 'https://g1.duniter.org',
      timeout: 10000,
    })
    this.presle = axios.create({
      baseURL: 'https://g1.data.presles.fr',
      timeout: 10000,
    })
  }

  async getUid(pubKey: PublicKey): Promise<string> {
    // this doesnt't fetch any data from API
    if (pubKey.splittedKey) {
      return pubKey.name
    }

    // this will try to fetch from duniter API
    try {
      const response = await this.duniter.get('/wot/lookup/' + pubKey.key)
      return response.data.results[0].uids[0].uid
    } catch (error) {
      console.error('Error occured with Duniter call')
      console.error(error)
    }

    // this will try to fetch from presle API
    try {
      const response = await this.presle.get('/user/profile/' + pubKey.key)
      if (response.data.found === false) {
        throw new Error(`User with public key ${pubKey.key} hasn't be found`)
      }
      // get user uid
      return response.data._source.title
    } catch (error) {
      console.error('Error occured with Presle call')
      console.error(error)
    }
    return ''
  }
}

// generate PDF
const getPdf = (name: string): PDFKit.PDFDocument => {
  const pdfDoc = new PDFDocument({ size: [1240, 1754], margin: 0 }) // 150dpi
  pdfDoc.pipe(fs.createWriteStream(name))
  pdfDoc.registerFont('Fontawesome', 'fonts/Font-Awesome-6-Free-Solid-900.otf')
  return pdfDoc
}

const go = async (keys: string[], oneFileOutput: boolean) => {
  console.log('oneFileOutput:', oneFileOutput)

  const userData = new UserData()
  let pdfDoc: PDFKit.PDFDocument = getPdf(`user-all.pdf`)

  for (const pubKey of keys) {
    const keyObj = new PublicKey(pubKey)
    const uid = await userData.getUid(keyObj)
    if (uid === '') continue

    if (!oneFileOutput) {
      pdfDoc = getPdf(`user-${uid}.pdf`)
    }

    const builder = new CesiumCardCreator(uid, keyObj.key, pdfDoc)
    await builder.build()

    if (oneFileOutput && keyObj.originalKey !== keys[keys.length - 1]) {
      console.log(`add page for ${uid}`)
      pdfDoc.addPage()
    } else {
      if (oneFileOutput) console.log(`Created file: user-${uid}.pdf`)
      else console.log(`last page created for: user-${uid}.pdf`)

      pdfDoc.end()
    }
  }
  console.log(`>> end`)
}

let oneFileOutput = false
const args = process.argv.slice(2)
let keys = [...args]

if (args[0] === 'file') {
  keys = fs.readFileSync('.profiles').toString().split('\n')
  if (args[1] && args[1] === 'c') {
    oneFileOutput = true
  }
}

go(keys, oneFileOutput)
