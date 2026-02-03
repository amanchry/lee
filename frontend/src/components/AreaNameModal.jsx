import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'

export default function AreaNameModal({ isOpen, onClose, onSubmit, fileName, areaName: initialAreaName }) {
  const [areaName, setAreaName] = useState('')

  useEffect(() => {
    if (isOpen) {
      // Use provided areaName if available, otherwise extract from filename
      if (initialAreaName) {
        setAreaName(initialAreaName)
      } else if (fileName) {
        const nameWithoutExt = fileName.replace(/\.(geojson|json)$/i, '')
        setAreaName(nameWithoutExt)
      } else {
        setAreaName('')
      }
    }
  }, [isOpen, fileName, initialAreaName])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (areaName.trim()) {
      onSubmit(areaName.trim())
      setAreaName('')
    }
  }

  const handleCancel = () => {
    setAreaName('')
    onClose()
  }

  useEffect(() => {
    console.log('AreaNameModal isOpen changed:', isOpen)
  }, [isOpen])

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-ide-panel border border-ide-border rounded-lg shadow-lg z-[101] w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold text-ide-text">
              Save Drawn Boundary
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                onClick={handleCancel}
                className="p-1 hover:bg-ide-bg rounded text-ide-text-muted hover:text-ide-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-ide-text-muted mb-2">
                Area Name
              </label>
              <input
                type="text"
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
                placeholder="Enter a name for this area"
                className="w-full px-3 py-2 bg-ide-bg border border-ide-border rounded text-ide-text focus:outline-none focus:ring-2 focus:ring-ide-accent"
                autoFocus
                required
              />
              {fileName && (
                <p className="mt-1 text-xs text-ide-text-muted">
                  Uploading: {fileName}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-sm bg-ide-bg border border-ide-border rounded text-ide-text hover:bg-ide-border transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!areaName.trim()}
                className="px-4 py-2 text-sm bg-ide-accent hover:bg-ide-accent-hover disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                Save Area
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
