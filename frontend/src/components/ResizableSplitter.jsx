import React, { useState, useRef, useEffect } from 'react'

export default function ResizableSplitter({ 
  children, 
  direction = 'vertical', 
  defaultSize = 50,
  minSize = 10,
  maxSize = 90 
}) {
  const [topSize, setTopSize] = useState(defaultSize)
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef(null)
  const startPosRef = useRef(null)
  const startSizeRef = useRef(null)

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing || !containerRef.current) return

      const container = containerRef.current
      const containerRect = container.getBoundingClientRect()
      const containerSize = direction === 'vertical' 
        ? containerRect.height 
        : containerRect.width
      
      const mousePos = direction === 'vertical' 
        ? e.clientY - containerRect.top
        : e.clientX - containerRect.left
      
      const newSize = (mousePos / containerSize) * 100
      const clampedSize = Math.max(minSize, Math.min(maxSize, newSize))
      setTopSize(clampedSize)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      startPosRef.current = null
      startSizeRef.current = null
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = direction === 'vertical' ? 'row-resize' : 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, direction, minSize, maxSize])

  const handleMouseDown = (e) => {
    e.preventDefault()
    setIsResizing(true)
    startPosRef.current = direction === 'vertical' ? e.clientY : e.clientX
    startSizeRef.current = topSize
  }

  const [topChild, bottomChild] = React.Children.toArray(children)

  return (
    <div 
      ref={containerRef}
      className={`flex ${direction === 'vertical' ? 'flex-col' : 'flex-row'} h-full w-full relative`}
    >
      <div 
        className="flex-shrink-0 overflow-hidden"
        style={{ 
          [direction === 'vertical' ? 'height' : 'width']: `${topSize}%` 
        }}
      >
        {topChild}
      </div>
      <div
        onMouseDown={handleMouseDown}
        className={`flex-shrink-0 bg-ide-border hover:bg-ide-accent transition-colors ${
          direction === 'vertical' ? 'h-1 cursor-row-resize' : 'w-1 cursor-col-resize'
        } ${isResizing ? 'bg-ide-accent' : ''}`}
      />
      <div 
        className="flex-1 overflow-hidden min-h-0"
        style={{ 
          [direction === 'vertical' ? 'height' : 'width']: `${100 - topSize}%` 
        }}
      >
        {bottomChild}
      </div>
    </div>
  )
}
