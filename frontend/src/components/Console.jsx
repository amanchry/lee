import React from 'react'
import * as ScrollArea from '@radix-ui/react-scroll-area'

export default function Console({ logs }) {
  const formatTimestamp = (timestamp) => {
    // Handle both Date objects and string timestamps
    let date;
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      // Fallback to current time if invalid
      date = new Date();
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return new Date().toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        fractionalSecondDigits: 3
      });
    }
    
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    })
  }

  const getLogIcon = (type) => {
    switch (type) {
      case 'error':
        return '❌'
      case 'warning':
        return '⚠️'
      case 'success':
        return '✅'
      default:
        return 'ℹ️'
    }
  }

  const getLogColor = (type) => {
    switch (type) {
      case 'error':
        return 'text-red-400'
      case 'warning':
        return 'text-yellow-400'
      case 'success':
        return 'text-green-400'
      case 'log':
        return 'text-ide-text'
      default:
        return 'text-ide-text-muted'
    }
  }

  return (
    <ScrollArea.Root className="h-full">
      <ScrollArea.Viewport className="h-full w-full">
        <div className="p-4 font-mono text-sm">
          {logs.length === 0 ? (
            <div className="text-ide-text-muted">No logs yet. Run a script to see output.</div>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                className={`flex gap-3 mb-2 ${getLogColor(log.type)}`}
              >
                <span className="text-ide-text-muted flex-shrink-0">
                  [{formatTimestamp(log.timestamp)}]
                </span>
                <span className="flex-shrink-0">{getLogIcon(log.type)}</span>
                <span className="flex-1">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar className="flex touch-none select-none transition-colors bg-ide-bg data-[orientation=vertical]:w-2.5 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:h-2.5">
        <ScrollArea.Thumb className="flex-1 bg-ide-border rounded-[10px] relative before:content-[''] before:absolute before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-full before:h-full before:min-w-[44px] before:min-h-[44px]" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  )
}
