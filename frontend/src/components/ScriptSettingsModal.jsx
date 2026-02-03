import React, { useState, useEffect } from 'react'
import { X, Save, Copy, ExternalLink, Loader2, Globe, Lock, Edit2 } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { api } from '../services/api'

export default function ScriptSettingsModal({ 
  script, 
  isOpen, 
  onClose, 
  onUpdate,
  onRename
}) {
  const [name, setName] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTogglingPublic, setIsTogglingPublic] = useState(false)
  const [scriptId, setScriptId] = useState(null)
  const toast = useToast()

  useEffect(() => {
    if (isOpen && script) {
      setName(script.name || '')
      setIsPublic(script.is_public || false)
      setScriptId(script.backendId || script.id || null)
    } else if (!isOpen) {
      setName('')
      setIsPublic(false)
      setScriptId(null)
    }
  }, [isOpen, script])

  const handleSave = async () => {
    if (!name.trim()) {
      toast.warning('Validation', 'Please enter a script name')
      return
    }

    setIsSaving(true)
    try {
      if (!scriptId || scriptId.toString().startsWith('temp-')) {
        toast.error('Error', 'Cannot save unsaved script')
        return
      }

      const currentScript = script
      const response = await api.scripts.update(
        scriptId, 
        name.trim(), 
        currentScript.code || '', 
        ''
      )

      if (response.success) {
        toast.success('Script updated', 'Script name updated successfully!')
        if (onUpdate) {
          onUpdate(response.data)
        }
        if (onRename) {
          onRename(scriptId.toString(), name.trim())
        }
        onClose()
      } else {
        toast.error('Save failed', response.message || 'Failed to update script')
      }
    } catch (error) {
      console.error('Error saving script:', error)
      toast.error('Error', error.message || 'Error updating script')
    } finally {
      setIsSaving(false)
    }
  }

  const handleTogglePublic = async () => {
    if (!scriptId || scriptId.toString().startsWith('temp-')) {
      toast.warning('Cannot share', 'Please save the script first')
      return
    }

    setIsTogglingPublic(true)
    try {
      const response = await api.scripts.togglePublic(scriptId)

      if (response.success) {
        const newPublicStatus = response.data.is_public
        setIsPublic(newPublicStatus)
        toast.success(
          'Visibility updated', 
          `Script is now ${newPublicStatus ? 'public' : 'private'}`
        )
        if (onUpdate) {
          onUpdate(response.data)
        }
      } else {
        toast.error('Update failed', response.message || 'Failed to update visibility')
      }
    } catch (error) {
      console.error('Error toggling public status:', error)
      toast.error('Error', error.message || 'Error updating visibility')
    } finally {
      setIsTogglingPublic(false)
    }
  }

  const handleCopyLink = () => {
    if (!scriptId || scriptId.toString().startsWith('temp-')) {
      toast.warning('Cannot share', 'Please save the script first')
      return
    }
    
    const scriptUrl = `${window.location.origin}/script/${scriptId}`
    navigator.clipboard.writeText(scriptUrl)
    toast.success('Link copied', 'Script link copied to clipboard!')
  }

  const handleOpenInNewTab = () => {
    if (!scriptId || scriptId.toString().startsWith('temp-')) {
      toast.warning('Cannot open', 'Please save the script first')
      return
    }
    
    window.open(`/script/${scriptId}`, '_blank')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-ide-panel border border-ide-border rounded-lg shadow-2xl w-full max-w-md m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ide-border">
          <div>
            <h2 className="text-lg font-semibold text-ide-text">
              Script Settings
            </h2>
            {scriptId && (
              <p className="text-xs text-ide-text-muted mt-1">
                ID: {scriptId}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-ide-bg rounded transition-colors text-ide-text-muted hover:text-ide-text"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
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

          {/* Public/Private Toggle */}
          <div className="flex items-center justify-between p-3 bg-ide-bg border border-ide-border rounded">
            <div className="flex items-center gap-2">
              {isPublic ? (
                <Globe className="w-5 h-5 text-green-400" />
              ) : (
                <Lock className="w-5 h-5 text-ide-text-muted" />
              )}
              <div>
                <div className="text-sm font-medium text-ide-text">
                  {isPublic ? 'Public' : 'Private'}
                </div>
                <div className="text-xs text-ide-text-muted">
                  {isPublic 
                    ? 'Anyone with the link can view this script'
                    : 'Only you can view this script'}
                </div>
              </div>
            </div>
            <button
              onClick={handleTogglePublic}
              disabled={isTogglingPublic || !scriptId || scriptId.toString().startsWith('temp-')}
              className="px-3 py-1.5 text-sm bg-ide-accent hover:bg-ide-accent-hover disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded flex items-center gap-2 transition-colors"
            >
              {isTogglingPublic ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  {isPublic ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                  Make {isPublic ? 'Private' : 'Public'}
                </>
              )}
            </button>
          </div>

          {/* Share Section */}
          {scriptId && !scriptId.toString().startsWith('temp-') && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-ide-text">
                Share Script
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyLink}
                  className="flex-1 px-3 py-2 text-sm bg-ide-bg border border-ide-border text-ide-text rounded hover:bg-ide-border transition-colors flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy Link
                </button>
                <button
                  onClick={handleOpenInNewTab}
                  className="flex-1 px-3 py-2 text-sm bg-ide-bg border border-ide-border text-ide-text rounded hover:bg-ide-border transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open
                </button>
              </div>
              {isPublic && (
                <div className="mt-2 p-2 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-400">
                  ✓ This script is public and can be viewed by anyone with the link
                </div>
              )}
              {!isPublic && (
                <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-400">
                  ⚠ This script is private. Make it public to share with others.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-ide-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-ide-bg border border-ide-border text-ide-text rounded hover:bg-ide-border transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim() || !scriptId || scriptId.toString().startsWith('temp-')}
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
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
