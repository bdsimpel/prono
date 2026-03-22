export const PAYMENT_CONFIG = {
  iban: 'BE15063623108130',
  ibanFormatted: 'BE15 0636 2310 8130',
  bic: 'GKCCBEBB',
  beneficiary: 'Bram Desimpelaere',
  amount: 2,
  currency: 'EUR',
  // Optional: set this to a Payconiq/Wero payment request link to enable the pay button
  // Create a payment request in your Payconiq or bank app and paste the link here
  payconiqLink: 'https://pay.bancontact.com/p2p/faf659f4-7b57-4b60-87f2-6e0694b80696',
}

export function getPaymentReference(playerName: string): string {
  return `Play Offs Prono - ${playerName}`
}

/**
 * Generates an EPC QR code data string (EPC069-12 / BCD format).
 * This format is recognized by most European banking apps.
 * See: https://www.europeanpaymentscouncil.eu/document-library/guidance-documents/quick-response-code-guidelines-enable-data-capture-initiation
 */
export function generateEpcQrData(playerName: string): string {
  const reference = getPaymentReference(playerName)
  const lines = [
    'BCD',                          // Service Tag
    '002',                          // Version
    '1',                            // Character set (UTF-8)
    'SCT',                          // Identification code
    PAYMENT_CONFIG.bic,             // BIC
    PAYMENT_CONFIG.beneficiary,     // Beneficiary name
    PAYMENT_CONFIG.iban,            // IBAN
    `EUR${PAYMENT_CONFIG.amount.toFixed(2)}`, // Amount
    '',                             // Purpose (empty)
    '',                             // Structured reference (empty)
    reference,                      // Unstructured reference
    '',                             // Information (empty)
  ]
  return lines.join('\n')
}
