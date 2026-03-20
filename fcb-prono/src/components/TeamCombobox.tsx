'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { getTeamLogo } from '@/lib/teamLogos'

interface TeamOption {
  name: string
  statLabel: string
}

interface TeamComboboxProps {
  options: TeamOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function TeamCombobox({
  options,
  value,
  onChange,
  placeholder = 'Kies een ploeg...',
}: TeamComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = search
    ? options.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()))
    : options

  useEffect(() => {
    if (isOpen && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement | undefined
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIndex, isOpen])

  useEffect(() => {
    if (isOpen) {
      // Focus the search input when dropdown opens
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setSearch('')
    }
  }, [isOpen])

  useEffect(() => {
    setHighlightIndex(0)
  }, [search])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectOption = (name: string) => {
    onChange(name)
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightIndex(i => Math.min(i + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filtered[highlightIndex]) {
          selectOption(filtered[highlightIndex].name)
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        break
    }
  }

  const logo = value ? getTeamLogo(value) : null

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className="flex items-center gap-2 w-full px-4 py-2.5 bg-cb-dark border border-border-subtle rounded-lg text-sm text-left cursor-pointer hover:border-cb-blue/40 transition-colors"
      >
        {value ? (
          <>
            {logo && (
              <span className="inline-flex items-center justify-center shrink-0" style={{ width: 18, height: 18 }}>
                <Image src={logo} alt={value} width={18} height={18} className="object-contain w-full h-full" />
              </span>
            )}
            <span className="flex-1 truncate text-white">{value}</span>
          </>
        ) : (
          <span className="flex-1 truncate text-gray-500">{placeholder}</span>
        )}
        <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-cb-card border border-border rounded-lg shadow-xl shadow-black/40 overflow-hidden">
          {/* Search input */}
          <div className="px-3 py-2 border-b border-white/[0.06]">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Zoek ploeg..."
              className="w-full bg-transparent text-sm text-white placeholder-gray-500 outline-none"
            />
          </div>
          <ul
            ref={listRef}
            className="max-h-60 overflow-y-auto"
          >
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-gray-500">Geen resultaten</li>
            ) : (
              filtered.map((option, idx) => {
                const optionLogo = getTeamLogo(option.name)
                return (
                  <li
                    key={option.name}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      selectOption(option.name)
                    }}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center gap-2.5 ${
                      option.name === value
                        ? 'bg-cb-blue/10 text-cb-blue'
                        : idx === highlightIndex
                          ? 'bg-cb-blue/20 text-white'
                          : 'text-gray-300 hover:bg-white/[0.03]'
                    }`}
                  >
                    {optionLogo && (
                      <span className="inline-flex items-center justify-center shrink-0" style={{ width: 20, height: 20 }}>
                        <Image src={optionLogo} alt={option.name} width={20} height={20} className="object-contain w-full h-full" />
                      </span>
                    )}
                    <span className="font-medium">{option.name}</span>
                    <span className="text-gray-500 text-xs ml-auto">{option.statLabel}</span>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
