'use client'

import { useState } from 'react'
import { PAYMENT_CONFIG, getPaymentReference } from '@/lib/payment'
import type { PaymentStatus } from '@/lib/types'

interface PaymentSectionProps {
  playerId: string
  playerName: string
  initialStatus?: PaymentStatus
  onStatusChange?: (status: PaymentStatus) => void
}

export default function PaymentSection({ playerId, playerName, initialStatus = 'unpaid', onStatusChange }: PaymentSectionProps) {
  const [status, setStatus] = useState<PaymentStatus>(initialStatus)
  const [copied, setCopied] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handlePaymentUpdate = async (method: 'cash' | 'wero' | 'transfer') => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/payment/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, method }),
      })
      if (res.ok) {
        setStatus('pending')
        onStatusChange?.('pending')
      }
    } catch {
      // silently fail
    } finally {
      setSubmitting(false)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  if (status === 'paid') {
    return (
      <div className="bg-green-900/20 border border-green-800 rounded-xl p-6 text-center">
        <div className="text-2xl mb-2">&#10003;</div>
        <p className="text-green-300 font-medium">Betaling ontvangen</p>
        <p className="text-green-400/60 text-sm mt-1">Je inschrijving is volledig in orde.</p>
      </div>
    )
  }

  if (status === 'pending') {
    return (
      <div className="bg-yellow-900/20 border border-yellow-800 rounded-xl p-6 text-center">
        <div className="text-2xl mb-2">&#8987;</div>
        <p className="text-yellow-300 font-medium">Betaling in afwachting</p>
        <p className="text-yellow-400/60 text-sm mt-1">Je betaling wordt gecontroleerd door de admin.</p>
      </div>
    )
  }

  const reference = getPaymentReference(playerName)

  const payconiqButton = (
    <a
      href={PAYMENT_CONFIG.payconiqLink}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => handlePaymentUpdate('wero')}
      className="block w-full py-3 bg-[#FF4785] text-white font-medium rounded-lg text-center hover:bg-[#FF4785]/90 transition-colors"
    >
      Betaal &euro;2 via Payconiq / Wero
    </a>
  )

  const manualSection = (
    <div className="space-y-3">
      <p className="text-sm text-gray-400">Manueel overschrijven</p>
      <div className="bg-cb-dark rounded-lg p-4 space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-gray-500 text-xs block">IBAN</span>
            <span className="text-white font-mono">{PAYMENT_CONFIG.ibanFormatted}</span>
          </div>
          <button
            onClick={() => copyToClipboard(PAYMENT_CONFIG.ibanFormatted, 'iban')}
            className="px-2 py-1 text-xs bg-cb-blue/20 text-cb-gold rounded hover:bg-cb-blue/30 transition-colors"
          >
            {copied === 'iban' ? 'Gekopieerd!' : 'Kopieer'}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-gray-500 text-xs block">Bedrag</span>
            <span className="text-white font-mono">&euro;{PAYMENT_CONFIG.amount.toFixed(2)}</span>
          </div>
          <button
            onClick={() => copyToClipboard(`${PAYMENT_CONFIG.amount.toFixed(2)}`, 'amount')}
            className="px-2 py-1 text-xs bg-cb-blue/20 text-cb-gold rounded hover:bg-cb-blue/30 transition-colors"
          >
            {copied === 'amount' ? 'Gekopieerd!' : 'Kopieer'}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-gray-500 text-xs block">Mededeling</span>
            <span className="text-white font-mono">{reference}</span>
          </div>
          <button
            onClick={() => copyToClipboard(reference, 'ref')}
            className="px-2 py-1 text-xs bg-cb-blue/20 text-cb-gold rounded hover:bg-cb-blue/30 transition-colors"
          >
            {copied === 'ref' ? 'Gekopieerd!' : 'Kopieer'}
          </button>
        </div>
        <div>
          <span className="text-gray-500 text-xs block">Begunstigde</span>
          <span className="text-white">{PAYMENT_CONFIG.beneficiary}</span>
        </div>
        <button
          onClick={() => handlePaymentUpdate('transfer')}
          disabled={submitting}
          className="w-full py-2.5 bg-cb-blue/20 text-cb-gold text-sm font-medium rounded-lg hover:bg-cb-blue/30 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Even geduld...' : 'Ik heb overgeschreven'}
        </button>
      </div>
    </div>
  )

  const cashButton = (
    <button
      onClick={() => handlePaymentUpdate('cash')}
      disabled={submitting}
      className="w-full py-2.5 bg-cb-dark text-gray-300 text-sm font-medium rounded-lg border border-border hover:bg-cb-dark/80 transition-colors disabled:opacity-50"
    >
      {submitting ? 'Even geduld...' : 'Ik betaal cash'}
    </button>
  )

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-1">Inschrijvingsgeld: &euro;2</h3>
        <p className="text-sm text-gray-400">Kies hoe je wil betalen</p>
      </div>

      {payconiqButton}
      {manualSection}
      {cashButton}
    </div>
  )
}
