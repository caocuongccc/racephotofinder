/**
 * NAPAS QR Code Generator
 * Theo chuẩn VietQR - EMVCo
 */

export interface BankInfo {
  bankId: string // Mã ngân hàng (VD: 970415 = VietinBank, 970422 = MB Bank)
  accountNo: string
  accountName: string
}

export interface QRData {
  bankInfo: BankInfo
  amount: number
  description: string
  transactionId?: string
}

/**
 * Generate NAPAS QR Code data string (EMVCo format)
 */
export function generateNAPASQR(data: QRData): string {
  const { bankInfo, amount, description, transactionId } = data

  // EMVCo QR Format
  // Format: ID + Length + Value
  const fields: Array<{ id: string; value: string }> = []

  // Payload Format Indicator (ID 00)
  fields.push({ id: '00', value: '01' })

  // Point of Initiation Method (ID 01) - Static QR
  fields.push({ id: '01', value: '11' })

  // Merchant Account Information (ID 38 - NAPAS/VietQR)
  const merchantInfo = [
    { id: '00', value: 'A000000727' }, // GUID
    { id: '01', value: bankInfo.bankId }, // Bank BIN/ID
    { id: '02', value: bankInfo.accountNo }, // Account Number
  ]

  const merchantInfoStr = merchantInfo
    .map((f) => `${f.id}${String(f.value.length).padStart(2, '0')}${f.value}`)
    .join('')

  fields.push({
    id: '38',
    value: merchantInfoStr,
  })

  // Transaction Currency (ID 53) - VND
  fields.push({ id: '53', value: '704' })

  // Transaction Amount (ID 54)
  if (amount > 0) {
    fields.push({ id: '54', value: amount.toString() })
  }

  // Country Code (ID 58)
  fields.push({ id: '58', value: 'VN' })

  // Merchant Name (ID 59)
  fields.push({ id: '59', value: bankInfo.accountName })

  // Additional Data (ID 62)
  const additionalData = []

  // Bill Number (ID 01)
  if (transactionId) {
    additionalData.push({ id: '01', value: transactionId })
  }

  // Purpose of Transaction (ID 08)
  if (description) {
    // Limit to 25 characters for QR compatibility
    const cleanDescription = description.substring(0, 25)
    additionalData.push({ id: '08', value: cleanDescription })
  }

  if (additionalData.length > 0) {
    const additionalDataStr = additionalData
      .map((f) => `${f.id}${String(f.value.length).padStart(2, '0')}${f.value}`)
      .join('')

    fields.push({
      id: '62',
      value: additionalDataStr,
    })
  }

  // Build QR string
  let qrString = fields
    .map((f) => `${f.id}${String(f.value.length).padStart(2, '0')}${f.value}`)
    .join('')

  // Add CRC (ID 63) - 4 digits
  const crc = calculateCRC16(qrString + '6304')
  qrString += `63${String(crc.length).padStart(2, '0')}${crc}`

  return qrString
}

/**
 * Calculate CRC16-CCITT for QR code
 */
function calculateCRC16(data: string): string {
  let crc = 0xffff
  const polynomial = 0x1021

  for (let i = 0; i < data.length; i++) {
    const byte = data.charCodeAt(i)
    crc ^= byte << 8

    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ polynomial) & 0xffff
      } else {
        crc = (crc << 1) & 0xffff
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/**
 * Bank list (major Vietnamese banks)
 */
export const VIETNAM_BANKS = [
  { id: '970415', name: 'VietinBank', shortName: 'VTB' },
  { id: '970422', name: 'MB Bank', shortName: 'MB' },
  { id: '970436', name: 'Vietcombank', shortName: 'VCB' },
  { id: '970418', name: 'BIDV', shortName: 'BIDV' },
  { id: '970432', name: 'VPBank', shortName: 'VPB' },
  { id: '970403', name: 'Sacombank', shortName: 'STB' },
  { id: '970407', name: 'Techcombank', shortName: 'TCB' },
  { id: '970416', name: 'ACB', shortName: 'ACB' },
  { id: '970423', name: 'TPBank', shortName: 'TPB' },
  { id: '970441', name: 'VIB', shortName: 'VIB' },
  { id: '970405', name: 'Agribank', shortName: 'AGB' },
  { id: '970448', name: 'OCB', shortName: 'OCB' },
  { id: '970419', name: 'NCB', shortName: 'NCB' },
  { id: '970443', name: 'SHB', shortName: 'SHB' },
  { id: '970431', name: 'Eximbank', shortName: 'EIB' },
  { id: '970426', name: 'MSB', shortName: 'MSB' },
  { id: '970414', name: 'Oceanbank', shortName: 'OCN' },
  { id: '970433', name: 'VietBank', shortName: 'VB' },
  { id: '970438', name: 'BacABank', shortName: 'BAB' },
  { id: '970439', name: 'PVcomBank', shortName: 'PVB' },
]

/**
 * Generate payment reference code
 */
export function generatePaymentReference(eventId: string, photoId?: string): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  const eventPrefix = eventId.substring(0, 4).toUpperCase()
  
  if (photoId) {
    const photoPrefix = photoId.substring(0, 4).toUpperCase()
    return `${eventPrefix}${photoPrefix}${timestamp}${random}`
  }
  
  return `${eventPrefix}${timestamp}${random}`
}

/**
 * Validate payment reference format
 */
export function isValidPaymentReference(ref: string): boolean {
  // Format: 8-20 uppercase alphanumeric characters
  return /^[A-Z0-9]{8,20}$/.test(ref)
}