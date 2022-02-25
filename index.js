#!/usr/bin/env node
const axios = require("axios");
const qrcode = require("qrcode-generator");
const fs = require("fs");
const PDFDocument = require("pdfkit");

const gifFrames = require("gif-frames");
const { WritableStreamBuffer } = require("stream-buffers");

const InitialBufferSize = 800;
const OneK = 1024;

/**
 * @param {string} url URL to retrieve GIF from
 * @returns {Promise<Buffer>} a Promise with a Buffer
 */
convertGifToPng = (url) => {
  return new Promise((resolve) => {
    const writer = new WritableStreamBuffer({
      initialSize: InitialBufferSize * OneK,
    });

    gifFrames({
      url,
      frames: 0,
      outputType: "PNG",
    }).then((frameData) => {
      frameData.shift().getImage().pipe(writer);
    });

    writer.on("finish", () => {
      resolve(writer.getContents());
    });
  });
};

go = async (keys) => {
  const instance = axios.create({
    baseURL: "https://g1.duniter.org",
    timeout: 10000,
    headers: { "X-Custom-Header": "foobar" },
  });

  for (pubKey of keys) {
    try {
      const response = await instance.get("/wot/lookup/" + pubKey);
      // get user uid
      const uid = response.data.results[0].uids[0].uid;

      let pdfDoc = new PDFDocument();
      pdfDoc.pipe(fs.createWriteStream(`user-${uid}.pdf`));

      // Generate QrCode
      var qr = qrcode(4, "M");
      qr.addData(pubKey);
      qr.make();
      const image = await convertGifToPng(qr.createDataURL(10));

      pdfDoc
        .text(`identifiant: `, { continue: true, lineBreak: false })
        .font("Helvetica-Bold")
        .text(`${uid}`);

      pdfDoc.font("Helvetica").text(`clé publique: ${pubKey}`, {
        width: 410,
        align: "center",
      });

      pdfDoc.image(image, { align: "center" });
      pdfDoc.end();

      console.log(`Created file: user-${uid}.pdf`);
    } catch (error) {
      console.error("Error occured");
      console.error(error);
    }
  }
  console.log(`>> end`);
};

const keys = process.argv.slice(2);
go(keys);
