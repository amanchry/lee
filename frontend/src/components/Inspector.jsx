import React from 'react'
import { MapPin } from 'lucide-react'
import * as ScrollArea from '@radix-ui/react-scroll-area'

export default function Inspector({ data }) {
  return (
    <div className="h-full flex flex-col bg-ide-panel">
      <ScrollArea.Root className="flex-1">
        <ScrollArea.Viewport className="h-full w-full">
          <div className="p-4">
            {!data ? (
              <div className="text-center py-8 text-ide-text-muted text-sm">
                <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Click on the map to inspect values</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-ide-bg border border-ide-border rounded p-3">
                  <h4 className="text-xs font-semibold text-ide-text-muted mb-2 uppercase">
                    Coordinates
                  </h4>
                  <div className="space-y-1 font-mono text-sm">
                    <div className="flex justify-between">
                      <span className="text-ide-text-muted">Longitude:</span>
                      <span className="text-ide-text">{data.coordinates[0].toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ide-text-muted">Latitude:</span>
                      <span className="text-ide-text">{data.coordinates[1].toFixed(6)}</span>
                    </div>
                  </div>
                </div>

                {data.values && (
                  <div className="bg-ide-bg border border-ide-border rounded p-3">
                    <h4 className="text-xs font-semibold text-ide-text-muted mb-2 uppercase">
                      Pixel Values
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(data.values).map(([band, value]) => (
                        <div key={band} className="flex justify-between items-center">
                          <span className="text-sm text-ide-text-muted">{band}:</span>
                          <span className="text-sm font-mono text-ide-text">
                            {typeof value === 'number' ? value.toFixed(4) : value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {data.timestamp && (
                  <div className="bg-ide-bg border border-ide-border rounded p-3">
                    <h4 className="text-xs font-semibold text-ide-text-muted mb-2 uppercase">
                      Timestamp
                    </h4>
                    <div className="text-sm font-mono text-ide-text">
                      {data.timestamp.toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar className="flex touch-none select-none transition-colors bg-ide-bg data-[orientation=vertical]:w-2.5 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:h-2.5">
          <ScrollArea.Thumb className="flex-1 bg-ide-border rounded-[10px] relative before:content-[''] before:absolute before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-full before:h-full before:min-w-[44px] before:min-h-[44px]" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  )
}
