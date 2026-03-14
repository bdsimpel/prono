'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface PlayerOption {
  name: string
  team: string
  stat: number
}

interface PlayerComboboxProps {
  options: PlayerOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  statLabel: string
}

function stripDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export default function PlayerCombobox({
  options,
  value,
  onChange,
  placeholder = 'Zoek een speler...',
  statLabel,
}: PlayerComboboxProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedQuery, setDebouncedQuery] = useState('')

  const handleQueryChange = useCallback((val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(val)
    }, 150)
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const filtered = debouncedQuery.trim() === ''
    ? options
    : options.filter(o => {
        const normalizedName = stripDiacritics(o.name).toLowerCase()
        const normalizedQuery = stripDiacritics(debouncedQuery).toLowerCase()
        return normalizedName.includes(normalizedQuery)
      })

  useEffect(() => {
    setHighlightIndex(0)
  }, [debouncedQuery])

  useEffect(() => {
    if (isOpen && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement | undefined
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIndex, isOpen])

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
    setQuery('')
    setDebouncedQuery('')
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
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

  return (
    <div ref={containerRef} className="relative">
      {value && !isOpen ? (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true)
            setTimeout(() => inputRef.current?.focus(), 0)
          }}
          className="flex items-center gap-2 w-full px-4 py-2.5 bg-cb-dark border border-border-subtle rounded-lg text-white text-sm text-left cursor-pointer hover:border-cb-blue/40 transition-colors"
        >
          <span className="flex-1 truncate">{value}</span>
          <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
        </button>
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            handleQueryChange(e.target.value)
            if (!isOpen) setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={value ? `${value} — typ om te wijzigen...` : placeholder}
          className="w-full px-4 py-2.5 bg-cb-dark border border-border-subtle rounded-lg text-white text-sm focus:outline-none focus:border-cb-blue transition-colors"
        />
      )}

      {isOpen && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-cb-card border border-border rounded-lg shadow-xl shadow-black/40"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-gray-600">Geen spelers gevonden</li>
          ) : (
            filtered.map((option, idx) => (
              <li
                key={`${option.name}-${option.team}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectOption(option.name)
                }}
                onMouseEnter={() => setHighlightIndex(idx)}
                className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                  option.name === value
                    ? 'bg-cb-blue/10 text-cb-blue'
                    : idx === highlightIndex
                      ? 'bg-cb-blue/20 text-white'
                      : 'text-gray-300 hover:bg-white/[0.03]'
                }`}
              >
                <span className="font-medium">{option.name}</span>
                <span className="text-gray-500 ml-1.5">{option.team}</span>
                <span className="text-gray-600 text-xs ml-1.5">({option.stat} {statLabel})</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
