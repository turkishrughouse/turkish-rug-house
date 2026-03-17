type ZipEntry = {
  name: string
  data: Uint8Array
  modifiedAt?: Date
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1)
    }
    table[index] = value >>> 0
  }
  return table
})()

function crc32(input: Uint8Array) {
  let crc = 0xffffffff
  for (let index = 0; index < input.length; index += 1) {
    crc = CRC_TABLE[(crc ^ input[index]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function encodeDosDateTime(date: Date) {
  const safeYear = Math.max(1980, date.getFullYear())
  const dosTime =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    Math.floor(date.getSeconds() / 2)
  const dosDate =
    (((safeYear - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f)

  return { dosTime, dosDate }
}

function uint16(value: number) {
  const buffer = Buffer.allocUnsafe(2)
  buffer.writeUInt16LE(value & 0xffff, 0)
  return buffer
}

function uint32(value: number) {
  const buffer = Buffer.allocUnsafe(4)
  buffer.writeUInt32LE(value >>> 0, 0)
  return buffer
}

export function createZip(entries: ZipEntry[]) {
  const encoder = new TextEncoder()
  const files: Buffer[] = []
  const centralDirectory: Buffer[] = []
  let localOffset = 0

  entries.forEach((entry) => {
    const nameBytes = Buffer.from(encoder.encode(entry.name))
    const dataBytes = Buffer.from(entry.data)
    const { dosTime, dosDate } = encodeDosDateTime(entry.modifiedAt || new Date())
    const checksum = crc32(dataBytes)

    const localHeader = Buffer.concat([
      uint32(0x04034b50),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(dosTime),
      uint16(dosDate),
      uint32(checksum),
      uint32(dataBytes.length),
      uint32(dataBytes.length),
      uint16(nameBytes.length),
      uint16(0),
      nameBytes,
    ])

    files.push(localHeader, dataBytes)

    const centralHeader = Buffer.concat([
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(dosTime),
      uint16(dosDate),
      uint32(checksum),
      uint32(dataBytes.length),
      uint32(dataBytes.length),
      uint16(nameBytes.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(localOffset),
      nameBytes,
    ])

    centralDirectory.push(centralHeader)
    localOffset += localHeader.length + dataBytes.length
  })

  const centralSize = centralDirectory.reduce((sum, chunk) => sum + chunk.length, 0)
  const endRecord = Buffer.concat([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(entries.length),
    uint16(entries.length),
    uint32(centralSize),
    uint32(localOffset),
    uint16(0),
  ])

  return Buffer.concat([...files, ...centralDirectory, endRecord])
}
