import "server-only"

type ZipFile = {
  filename: string
  data: Buffer
}

const crcTable = makeCrcTable()

export function createZip(files: ZipFile[]) {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  files.forEach((file) => {
    const filename = Buffer.from(file.filename, "utf8")
    const crc = crc32(file.data)
    const localHeader = Buffer.alloc(30)

    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0, 6)
    localHeader.writeUInt16LE(0, 8)
    localHeader.writeUInt16LE(0, 10)
    localHeader.writeUInt16LE(0, 12)
    localHeader.writeUInt32LE(crc, 14)
    localHeader.writeUInt32LE(file.data.length, 18)
    localHeader.writeUInt32LE(file.data.length, 22)
    localHeader.writeUInt16LE(filename.length, 26)
    localHeader.writeUInt16LE(0, 28)

    localParts.push(localHeader, filename, file.data)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0, 8)
    centralHeader.writeUInt16LE(0, 10)
    centralHeader.writeUInt16LE(0, 12)
    centralHeader.writeUInt16LE(0, 14)
    centralHeader.writeUInt32LE(crc, 16)
    centralHeader.writeUInt32LE(file.data.length, 20)
    centralHeader.writeUInt32LE(file.data.length, 24)
    centralHeader.writeUInt16LE(filename.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(offset, 42)

    centralParts.push(centralHeader, filename)
    offset += localHeader.length + filename.length + file.data.length
  })

  const centralDirectory = Buffer.concat(centralParts)
  const localDirectory = Buffer.concat(localParts)
  const end = Buffer.alloc(22)

  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralDirectory.length, 12)
  end.writeUInt32LE(localDirectory.length, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([localDirectory, centralDirectory, end])
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff

  for (const byte of buffer) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff]
  }

  return (crc ^ 0xffffffff) >>> 0
}

function makeCrcTable() {
  return Array.from({ length: 256 }, (_, index) => {
    let crc = index

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }

    return crc >>> 0
  })
}
