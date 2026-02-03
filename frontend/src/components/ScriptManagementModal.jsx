import React, { useState, useEffect } from 'react'
import { X, Save, Trash2, Copy, ExternalLink, Loader2 } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { api } from '../services/api'

export default function ScriptManagementModal({ 
  script, 
  isOpen, 
  onClose, 
  onSave, 
  onDelete 
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [scriptId, setScriptId] = useState(null)
  const toast = useToast()

  useEffect(() => {
    if (isOpen && script) {
      setName(script.name || '')
      setCode(script.code || '')
      // Use backendId if available, otherwise use id (for new scripts)
      setScriptId(script.backendId || script.id || null)
    } else if (!isOpen) {
      // Only reset when modal is closed
      setName('')
      setCode('')
      setScriptId(null)
    }
  }, [isOpen, script])

  const handleSave = async () => {
    if (!name.trim()) {
      toast.warning('Validation', 'Please enter a script name')
      return
    }

    if (!code.trim()) {
      toast.warning('Validation', 'Please enter script code')
      return
    }

    setIsSaving(true)
    try {
      const isUpdate = scriptId && !scriptId.toString().startsWith('temp-')
      
      let response
      if (isUpdate) {
        response = await api.scripts.update(scriptId, name.trim(), code.trim(), '')
      } else {
        response = await api.scripts.create(name.trim(), code.trim(), '')
      }

      if (response.success) {
        toast.success('Script saved', isUpdate ? 'Script updated successfully!' : 'Script created successfully!')
        
        // Update scriptId if it was a new script (temp ID -> real ID)
        if (!isUpdate && response.data && response.data.id) {
          setScriptId(response.data.id)
        }
        
        // Update the script object with saved data
        if (onSave) {
          onSave(response.data)
        }
        
        // Don't close the modal - keep it open for further editing
      } else {
        toast.error('Save failed', response.message || 'Failed to save script')
      }
    } catch (error) {
      console.error('Error saving script:', error)
      toast.error('Error', error.message || 'Error saving script')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!scriptId || scriptId.toString().startsWith('temp-')) return

    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await api.scripts.delete(scriptId)

      if (response.success) {
        toast.success('Deleted', 'Script deleted successfully!')
        if (onDelete) {
          onDelete(scriptId)
        }
        onClose()
      } else {
        toast.error('Delete failed', response.message || 'Failed to delete script')
      }
    } catch (error) {
      console.error('Error deleting script:', error)
      toast.error('Error', error.message || 'Error deleting script')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCopyLink = () => {
    if (!scriptId) return
    
    const scriptUrl = `${window.location.origin}/script/${scriptId}`
    navigator.clipboard.writeText(scriptUrl)
    toast.success('Link copied', 'Script link copied to clipboard!')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-ide-panel border border-ide-border rounded-lg shadow-2xl w-full max-w-3xl h-[90vh] flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ide-border flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-ide-text">
              {scriptId ? 'Edit Script' : 'Save Script'}
            </h2>
            {scriptId && (
              <p className="text-xs text-ide-text-muted mt-1">
                Script ID: {scriptId}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {scriptId && (
              <>
                <button
                  onClick={handleCopyLink}
                  className="p-2 hover:bg-ide-bg rounded transition-colors text-ide-text-muted hover:text-ide-text"
                  title="Copy script link"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <a
                  href={`/script/${scriptId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-ide-bg rounded transition-colors text-ide-text-muted hover:text-ide-text"
                  title="Open script in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-ide-bg rounded transition-colors text-ide-text-muted hover:text-ide-text"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Script Name */}
          <div>
            <label className="block text-sm font-medium text-ide-text mb-2">
              Script Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter script name"
              className="w-full px-3 py-2 bg-ide-bg border border-ide-border rounded text-ide-text focus:outline-none focus:ring-2 focus:ring-ide-accent"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-ide-border flex-shrink-0">
          <div>
            {scriptId && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded flex items-center gap-2 transition-colors"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-ide-bg border border-ide-border text-ide-text rounded hover:bg-ide-border transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !name.trim() || !code.trim()}
              className="px-4 py-2 text-sm bg-ide-accent hover:bg-ide-accent-hover disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded flex items-center gap-2 transition-colors"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {scriptId ? 'Update' : 'Save'} Script
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
