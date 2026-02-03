import React from 'react'
import { Eye, EyeOff, Trash2 } from 'lucide-react'
import * as ScrollArea from '@radix-ui/react-scroll-area'

export default function LayersPanel({ 
  layers, 
  onToggleLayer, 
  onDeleteLayer, 
  onUpdateLayerOpacity 
}) {
  return (
    <div className="h-full flex flex-col bg-ide-panel">
      <div className="p-4 border-b border-ide-border">
        <h3 className="text-sm font-semibold text-ide-text">Layers</h3>
        <p className="text-xs text-ide-text-muted mt-1">
          Manage visualization layers
        </p>
      </div>
      <ScrollArea.Root className="flex-1">
        <ScrollArea.Viewport className="h-full w-full">
          <div className="p-2">
            {layers.length === 0 ? (
              <div className="text-center py-8 text-ide-text-muted text-sm">
                No layers yet. Run a script to generate outputs.
              </div>
            ) : (
              layers.map((layer) => (
                <div
                  key={layer.id}
                  className="bg-ide-bg border border-ide-border rounded p-3 mb-2"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <button
                        onClick={() => onToggleLayer(layer.id)}
                        className="flex-shrink-0 p-1 hover:bg-ide-panel rounded transition-colors"
                      >
                        {layer.visible ? (
                          <Eye className="w-4 h-4 text-ide-text" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-ide-text-muted" />
                        )}
                      </button>
                      <span className="text-sm font-medium text-ide-text truncate">
                        {layer.name}
                      </span>
                      <span className="text-xs text-ide-text-muted flex-shrink-0">
                        {layer.type}
                      </span>
                    </div>
                    <button
                      onClick={() => onDeleteLayer(layer.id)}
                      className="flex-shrink-0 p-1 hover:bg-red-500/20 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-ide-text-muted hover:text-red-400" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={layer.opacity}
                      onChange={(e) => onUpdateLayerOpacity(layer.id, parseFloat(e.target.value))}
                      className="flex-1 h-1 bg-ide-border rounded-lg appearance-none cursor-pointer accent-ide-accent"
                    />
                    <span className="text-xs text-ide-text-muted w-10 text-right">
                      {Math.round(layer.opacity * 100)}%
                    </span>
                  </div>
                </div>
              ))
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
