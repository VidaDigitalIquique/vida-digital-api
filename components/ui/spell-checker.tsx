'use client'

import { useEffect, useRef, useState } from 'react'

interface LTMatch {
  offset: number
  length: number
  replacements: { value: string }[]
  message: string
}

type SpellCheckedInputProps = React.ComponentProps<'input'>

export function SpellCheckedInput({
  value,
  onChange,
  className,
  ...rest
}: SpellCheckedInputProps) {
  const [matches, setMatches] = useState<LTMatch[]>([])
  const [tooltipMatch, setTooltipMatch] = useState<LTMatch | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [internalValue, setInternalValue] = useState<string>(String(value ?? ''))

  const inputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    setInternalValue(String(value ?? ''))
  }, [value])

  async function checkSpelling(text: string) {
    if (text.length < 4) { setMatches([]); return }
    try {
      const res = await fetch('https://api.languagetool.org/v1/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ language: 'es', text }),
      })
      const data = await res.json()
      setMatches(data.matches ?? [])
    } catch {
      // silencioso
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newVal = e.target.value
    setInternalValue(newVal)
    onChange?.(e)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => checkSpelling(newVal), 800)
  }

  function handleScroll(e: React.UIEvent<HTMLInputElement>) {
    if (overlayRef.current) {
      overlayRef.current.scrollLeft = (e.target as HTMLInputElement).scrollLeft
    }
  }

  function applyReplacement(match: LTMatch, replacement: string) {
    const newText =
      internalValue.slice(0, match.offset) +
      replacement +
      internalValue.slice(match.offset + match.length)
    setInternalValue(newText)
    setMatches([])
    setTooltipMatch(null)
    if (onChange) {
      const nativeInput = inputRef.current
      if (nativeInput) {
        Object.defineProperty(nativeInput, 'value', {
          writable: true,
          configurable: true,
          value: newText,
        })
        const syntheticEvent = new Event('input', { bubbles: true })
        Object.defineProperty(syntheticEvent, 'target', {
          writable: false,
          value: nativeInput,
        })
        onChange(syntheticEvent as unknown as React.ChangeEvent<HTMLInputElement>)
      }
    }
  }

  function renderHighlighted() {
    if (matches.length === 0) {
      return <span style={{ color: 'transparent' }}>{internalValue}</span>
    }

    const parts: React.ReactNode[] = []
    let cursor = 0

    matches.forEach((match, i) => {
      if (match.offset > cursor) {
        parts.push(
          <span key={`t-${i}`} style={{ color: 'transparent' }}>
            {internalValue.slice(cursor, match.offset)}
          </span>
        )
      }
      const fragment = internalValue.slice(match.offset, match.offset + match.length)
      parts.push(
        <span
          key={`m-${i}`}
          style={{
            color: 'transparent',
            borderBottom: '2px solid red',
            pointerEvents: 'all',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            setTooltipMatch(match)
            setTooltipPos({ x: e.clientX, y: e.clientY })
          }}
          onMouseLeave={() => setTooltipMatch(null)}
        >
          {fragment}
        </span>
      )
      cursor = match.offset + match.length
    })

    if (cursor < internalValue.length) {
      parts.push(
        <span key="tail" style={{ color: 'transparent' }}>
          {internalValue.slice(cursor)}
        </span>
      )
    }

    return parts
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* OVERLAY */}
      <div
        ref={overlayRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          whiteSpace: 'pre',
          padding: '4px 10px',
          fontSize: 'inherit',
          fontFamily: 'inherit',
          lineHeight: 'inherit',
          color: 'transparent',
          zIndex: 1,
        }}
      >
        {renderHighlighted()}
      </div>

      {/* INPUT real */}
      <input
        ref={inputRef}
        value={internalValue}
        onChange={handleChange}
        onScroll={handleScroll}
        className={className}
        style={{ position: 'relative', zIndex: 2, background: 'transparent' }}
        {...rest}
      />

      {/* TOOLTIP */}
      {tooltipMatch && tooltipMatch.replacements.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: tooltipPos.y + 20,
            left: tooltipPos.x,
            zIndex: 9999,
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            minWidth: '120px',
          }}
        >
          {tooltipMatch.replacements.slice(0, 3).map((r, i) => (
            <button
              key={i}
              onMouseDown={(e) => {
                e.preventDefault()
                applyReplacement(tooltipMatch, r.value)
              }}
              style={{
                textAlign: 'left',
                padding: '4px 8px',
                borderRadius: '4px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#1a202c',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f7fafc')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              {r.value}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
