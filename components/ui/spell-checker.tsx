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
  const [internalValue, setInternalValue] = useState<string>(String(value ?? ''))

  const inputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const hideTooltipRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    setInternalValue(String(value ?? ''))
  }, [value])

  useEffect(() => {
    if (!inputRef.current || !overlayRef.current) return
    const computed = getComputedStyle(inputRef.current)
    const overlay = overlayRef.current
    overlay.style.paddingTop = computed.paddingTop
    overlay.style.paddingBottom = computed.paddingBottom
    overlay.style.paddingLeft = computed.paddingLeft
    overlay.style.paddingRight = computed.paddingRight
    overlay.style.fontSize = computed.fontSize
    overlay.style.fontFamily = computed.fontFamily
    overlay.style.fontWeight = computed.fontWeight
    overlay.style.lineHeight = computed.lineHeight
    overlay.style.letterSpacing = computed.letterSpacing
    overlay.style.height = computed.height
  }, [])

  async function checkSpelling(text: string) {
    if (text.length < 4) { setMatches([]); return }
    try {
      const res = await fetch('https://api.languagetool.org/v2/check', {
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
    onChange?.({ target: { value: newText } } as React.ChangeEvent<HTMLInputElement>)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => checkSpelling(newText), 800)
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
          }}
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
          color: 'transparent',
          zIndex: 10,
          boxSizing: 'border-box',
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
        onMouseMove={(e) => {
          if (matches.length === 0) return
          const inputEl = inputRef.current!
          const inputRect = inputEl.getBoundingClientRect()
          const computed = getComputedStyle(inputEl)
          const paddingLeft = parseFloat(computed.paddingLeft)
          const charWidth = parseFloat(computed.fontSize) * 0.55
          const charIndex = Math.floor((e.clientX - inputRect.left - paddingLeft + inputEl.scrollLeft) / charWidth)
          const found = matches.find(m => charIndex >= m.offset && charIndex < m.offset + m.length)
          setTooltipMatch(found ?? null)
        }}
        onMouseLeave={() => {
          hideTooltipRef.current = setTimeout(() => setTooltipMatch(null), 150)
        }}
        className={className}
        tabIndex={0}
        style={{ position: 'relative', zIndex: 1, background: 'transparent' }}
        {...rest}
      />

      {/* TOOLTIP */}
      {tooltipMatch && tooltipMatch.replacements.length > 0 && (
        <div
          onMouseEnter={() => clearTimeout(hideTooltipRef.current)}
          onMouseLeave={() => setTooltipMatch(null)}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
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
