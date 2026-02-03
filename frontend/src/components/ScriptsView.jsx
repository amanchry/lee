import React, { useState } from 'react'
import { FileCode, Plus, Trash2, Settings } from 'lucide-react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import * as Dialog from '@radix-ui/react-dialog'
import ScriptSettingsModal from './ScriptSettingsModal'

export default function ScriptsView({ 
  scripts, 
  activeScriptId, 
  onSelectScript, 
  onCreateScript,
  onDeleteScript,
  onRenameScript,
  onUpdateScript
}) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [scriptToManage, setScriptToManage] = useState(null)
  const [createScriptName, setCreateScriptName] = useState('')

  const handleSettingsClick = (e, script) => {
    e.stopPropagation()
    setScriptToManage(script)
    setSettingsModalOpen(true)
  }

  const handleSettingsUpdate = (updatedScript) => {
    if (onUpdateScript) {
      onUpdateScript(updatedScript)
    }
  }

  const handleCreateClick = () => {
    setCreateScriptName('')
    setCreateDialogOpen(true)
  }

  const handleCreateSubmit = (e) => {
    e.preventDefault()
    if (createScriptName.trim()) {
      onCreateScript(createScriptName.trim())
      setCreateDialogOpen(false)
      setCreateScriptName('')
    }
  }

  return (
    <>
      <div className="h-full flex flex-col bg-ide-panel min-h-0 overflow-hidden">
        <div className="p-2 border-b border-ide-border flex-shrink-0">
          <button
            onClick={handleCreateClick}
            className="w-full px-3 py-2 text-sm bg-ide-accent hover:bg-ide-accent-hover text-white rounded flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Script
          </button>
        </div>
        <ScrollArea.Root className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea.Viewport className="h-full w-full">
            <div className="p-2">
              {scripts.length === 0 ? (
                <div className="text-center py-8 text-ide-text-muted text-sm">
                  No scripts yet. Create a new script to get started.
                </div>
              ) : (
                scripts.map((script) => (
                  <div
                    key={script.id}
                    className={`group flex items-center gap-2 px-3 py-2 rounded cursor-pointer mb-1 ${
                      activeScriptId === script.id
                        ? 'bg-ide-accent text-white'
                        : 'hover:bg-ide-bg'
                    }`}
                    onClick={() => onSelectScript(script.id)}
                  >
                    <FileCode className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 text-sm truncate">{script.name}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleSettingsClick(e, script)}
                        className="p-1 hover:bg-ide-panel rounded transition-colors"
                        title="Script settings"
                      >
                        <Settings className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteScript(script.id)
                        }}
                        className="p-1 hover:bg-red-500/20 rounded transition-colors"
                        title="Delete script"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
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

      {/* Create Script Dialog */}
      <Dialog.Root open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-ide-panel border border-ide-border rounded-lg shadow-lg p-6 w-[90vw] max-w-md z-50">
            <Dialog.Title className="text-lg font-semibold text-ide-text mb-4">
              Create New Script
            </Dialog.Title>
            <form onSubmit={handleCreateSubmit}>
              <input
                type="text"
                value={createScriptName}
                onChange={(e) => setCreateScriptName(e.target.value)}
                className="w-full px-3 py-2 bg-ide-bg border border-ide-border rounded text-ide-text focus:outline-none focus:ring-2 focus:ring-ide-accent mb-4"
                placeholder="Enter script name"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="px-4 py-2 text-sm text-ide-text-muted hover:text-ide-text transition-colors"
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={!createScriptName.trim()}
                  className="px-4 py-2 text-sm bg-ide-accent hover:bg-ide-accent-hover disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Script Settings Modal */}
      <ScriptSettingsModal
        script={scriptToManage}
        isOpen={settingsModalOpen}
        onClose={() => {
          setSettingsModalOpen(false)
          setScriptToManage(null)
        }}
        onUpdate={handleSettingsUpdate}
        onRename={onRenameScript}
      />
    </>
  )
}
