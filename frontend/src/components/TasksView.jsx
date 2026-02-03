import React from 'react'
import { Clock, CheckCircle2, XCircle, Loader2, Play, Square } from 'lucide-react'
import * as ScrollArea from '@radix-ui/react-scroll-area'

export default function TasksView({ tasks = [] }) {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'queued':
        return <Clock className="w-4 h-4 text-yellow-400" />
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400" />
      default:
        return <Clock className="w-4 h-4 text-ide-text-muted" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'queued':
        return 'border-yellow-400/30 bg-yellow-400/10'
      case 'running':
        return 'border-blue-400/30 bg-blue-400/10'
      case 'completed':
        return 'border-green-400/30 bg-green-400/10'
      case 'error':
        return 'border-red-400/30 bg-red-400/10'
      default:
        return 'border-ide-border bg-ide-bg'
    }
  }

  const formatDuration = (startTime, endTime) => {
    if (!startTime) return '-'
    const end = endTime || new Date()
    const duration = Math.floor((end - startTime) / 1000)
    if (duration < 60) return `${duration}s`
    const minutes = Math.floor(duration / 60)
    const seconds = duration % 60
    return `${minutes}m ${seconds}s`
  }

  return (
    <div className="h-full flex flex-col bg-ide-panel">
      <div className="p-4 border-b border-ide-border">
        <h3 className="text-sm font-semibold text-ide-text">Tasks</h3>
        <p className="text-xs text-ide-text-muted mt-1">
          Monitor job execution and task status
        </p>
      </div>
      <ScrollArea.Root className="flex-1">
        <ScrollArea.Viewport className="h-full w-full">
          <div className="p-2">
            {tasks.length === 0 ? (
              <div className="text-center py-8 text-ide-text-muted text-sm">
                No tasks yet. Run a script to create a task.
              </div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className={`border rounded p-3 mb-2 ${getStatusColor(task.status)}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getStatusIcon(task.status)}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-ide-text truncate">
                          {task.name || `Task ${task.id}`}
                        </div>
                        <div className="text-xs text-ide-text-muted mt-0.5">
                          {task.scriptName || 'Script execution'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {task.status === 'running' && (
                        <button className="p-1 hover:bg-red-500/20 rounded transition-colors">
                          <Square className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-ide-text-muted">
                    <span className="capitalize">{task.status}</span>
                    <span>{formatDuration(task.startTime, task.endTime)}</span>
                  </div>
                  {task.error && (
                    <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
                      {task.error}
                    </div>
                  )}
                  {task.progress !== undefined && task.status === 'running' && (
                    <div className="mt-2">
                      <div className="h-1 bg-ide-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-ide-accent transition-all duration-300"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                      <div className="text-xs text-ide-text-muted mt-1 text-right">
                        {task.progress}%
                      </div>
                    </div>
                  )}
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
