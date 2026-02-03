import React, { useState, useEffect } from 'react'
import { X, Folder, File, Edit2, Trash2, Move, FolderPlus, FilePlus } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import { api } from '../services/api'
import { useToast } from '../hooks/useToast'

export default function AssetManagementModal({ 
  isOpen, 
  onClose, 
  currentPath,
  files = [],
  folders = [],
  onRefresh 
}) {
  const [activeTab, setActiveTab] = useState('create')
  const [newFolderName, setNewFolderName] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  const [actionType, setActionType] = useState(null) // 'rename', 'move', 'delete'
  const [newName, setNewName] = useState('')
  const [destinationFolder, setDestinationFolder] = useState('assets')
  const [availableFolders, setAvailableFolders] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const toast = useToast()

  // Load available folders for move operation
  useEffect(() => {
    if (isOpen && actionType === 'move') {
      loadFoldersForMove()
    }
  }, [isOpen, actionType])

  const loadFoldersForMove = async () => {
    try {
      const response = await api.files.list('assets')
      if (response.success && response.data) {
        const allFolders = []
        const collectFolders = (items, prefix = '') => {
          items.folders?.forEach(folder => {
            const folderPath = prefix ? `${prefix}/${folder.name}` : folder.name
            allFolders.push({
              name: folder.name,
              path: folderPath,
              displayPath: folderPath === 'assets' ? 'assets (root)' : folderPath
            })
            // Note: For nested folders, we'd need recursive loading
          })
        }
        collectFolders(response.data, 'assets')
        setAvailableFolders([
          { name: 'assets', path: 'assets', displayPath: 'assets (root)' },
          ...allFolders.filter(f => f.path !== 'assets')
        ])
      }
    } catch (error) {
      console.error('Error loading folders:', error)
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.warning('Invalid input', 'Please enter a folder name')
      return
    }

    setIsLoading(true)
    try {
      const response = await api.files.createFolder(newFolderName.trim(), currentPath)
      if (response.success) {
        toast.success('Folder created', `"${newFolderName}" created successfully!`)
        setNewFolderName('')
        onRefresh?.()
      } else {
        toast.error('Failed', response.message || 'Error creating folder')
      }
    } catch (error) {
      toast.error('Error', error.message || 'Error creating folder')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRename = async () => {
    if (!newName.trim() || !selectedItem) {
      toast.warning('Invalid input', 'Please enter a new name')
      return
    }

    setIsLoading(true)
    try {
      const pathToRename = selectedItem.original_path || selectedItem.path
      const response = await api.files.rename(pathToRename, newName.trim())
      if (response.success) {
        toast.success('Renamed', `"${selectedItem.name}" renamed to "${newName.trim()}"`)
        setSelectedItem(null)
        setNewName('')
        setActionType(null)
        onRefresh?.()
      } else {
        toast.error('Failed', response.message || 'Error renaming')
      }
    } catch (error) {
      toast.error('Error', error.message || 'Error renaming')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMove = async () => {
    if (!selectedItem || !destinationFolder) {
      toast.warning('Invalid input', 'Please select a destination folder')
      return
    }

    setIsLoading(true)
    try {
      const sourcePath = selectedItem.original_path || selectedItem.path
      const response = await api.files.move(sourcePath, destinationFolder)
      if (response.success) {
        toast.success('Moved', `"${selectedItem.name}" moved successfully`)
        setSelectedItem(null)
        setDestinationFolder('assets')
        setActionType(null)
        onRefresh?.()
      } else {
        toast.error('Failed', response.message || 'Error moving')
      }
    } catch (error) {
      toast.error('Error', error.message || 'Error moving')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedItem) return

    setIsLoading(true)
    try {
      const pathToDelete = selectedItem.original_path || selectedItem.path
      const response = await api.files.delete(pathToDelete)
      if (response.success) {
        toast.success('Deleted', `"${selectedItem.name}" deleted successfully`)
        setSelectedItem(null)
        setActionType(null)
        onRefresh?.()
      } else {
        toast.error('Failed', response.message || 'Error deleting')
      }
    } catch (error) {
      toast.error('Error', error.message || 'Error deleting')
    } finally {
      setIsLoading(false)
    }
  }

  const startAction = (item, action) => {
    setSelectedItem(item)
    setActionType(action)
    if (action === 'rename') {
      setNewName(item.name)
    }
  }

  const cancelAction = () => {
    setSelectedItem(null)
    setActionType(null)
    setNewName('')
    setDestinationFolder('assets')
  }

  if (!isOpen) return null

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-ide-panel border border-ide-border rounded-lg shadow-lg z-50 w-full max-w-2xl max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-ide-border flex-shrink-0">
            <Dialog.Title className="text-lg font-semibold text-ide-text">
              Manage Assets
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                onClick={onClose}
                className="p-1 hover:bg-ide-bg rounded text-ide-text-muted hover:text-ide-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
              <Tabs.List className="flex border-b border-ide-border px-6 flex-shrink-0">
                <Tabs.Trigger
                  value="create"
                  className="px-4 py-2 text-sm font-medium text-ide-text-muted data-[state=active]:text-ide-text data-[state=active]:border-b-2 data-[state=active]:border-ide-accent bg-transparent hover:bg-ide-bg transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FolderPlus className="w-4 h-4" />
                    <span>Create</span>
                  </div>
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="manage"
                  className="px-4 py-2 text-sm font-medium text-ide-text-muted data-[state=active]:text-ide-text data-[state=active]:border-b-2 data-[state=active]:border-ide-accent bg-transparent hover:bg-ide-bg transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Edit2 className="w-4 h-4" />
                    <span>Manage</span>
                  </div>
                </Tabs.Trigger>
              </Tabs.List>

              <div className="flex-1 overflow-hidden">
                {/* Create Tab */}
                <Tabs.Content value="create" className="h-full overflow-y-auto p-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-ide-text-muted mb-2">
                        Create New Folder
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleCreateFolder()
                            }
                          }}
                          placeholder="Folder name"
                          className="flex-1 px-3 py-2 bg-ide-bg border border-ide-border rounded text-ide-text focus:outline-none focus:ring-2 focus:ring-ide-accent"
                          disabled={isLoading}
                        />
                        <button
                          onClick={handleCreateFolder}
                          disabled={isLoading || !newFolderName.trim()}
                          className="px-4 py-2 bg-ide-accent hover:bg-ide-accent-hover disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
                        >
                          Create
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-ide-text-muted">
                        Current location: {currentPath}
                      </p>
                    </div>
                  </div>
                </Tabs.Content>

                {/* Manage Tab */}
                <Tabs.Content value="manage" className="h-full overflow-y-auto p-6">
                  {actionType ? (
                    // Action form (rename, move, delete)
                    <div className="space-y-4">
                      {actionType === 'rename' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-ide-text-muted mb-2">
                              Rename "{selectedItem?.name}"
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    handleRename()
                                  }
                                }}
                                placeholder="New name"
                                className="flex-1 px-3 py-2 bg-ide-bg border border-ide-border rounded text-ide-text focus:outline-none focus:ring-2 focus:ring-ide-accent"
                                autoFocus
                                disabled={isLoading}
                              />
                              <button
                                onClick={handleRename}
                                disabled={isLoading || !newName.trim()}
                                className="px-4 py-2 bg-ide-accent hover:bg-ide-accent-hover disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
                              >
                                Rename
                              </button>
                              <button
                                onClick={cancelAction}
                                className="px-4 py-2 bg-ide-bg border border-ide-border rounded text-ide-text hover:bg-ide-border transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </>
                      )}

                      {actionType === 'move' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-ide-text-muted mb-2">
                              Move "{selectedItem?.name}" to:
                            </label>
                            <div className="flex gap-2">
                              <select
                                value={destinationFolder}
                                onChange={(e) => setDestinationFolder(e.target.value)}
                                className="flex-1 px-3 py-2 bg-ide-bg border border-ide-border rounded text-ide-text focus:outline-none focus:ring-2 focus:ring-ide-accent"
                                disabled={isLoading}
                              >
                                {availableFolders.map((folder) => (
                                  <option key={folder.path} value={folder.path}>
                                    {folder.displayPath}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={handleMove}
                                disabled={isLoading}
                                className="px-4 py-2 bg-ide-accent hover:bg-ide-accent-hover disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
                              >
                                Move
                              </button>
                              <button
                                onClick={cancelAction}
                                className="px-4 py-2 bg-ide-bg border border-ide-border rounded text-ide-text hover:bg-ide-border transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </>
                      )}

                      {actionType === 'delete' && (
                        <>
                          <div className="bg-red-500/10 border border-red-500/30 rounded p-4">
                            <p className="text-sm text-red-400 mb-4">
                              Are you sure you want to delete "{selectedItem?.name}"? This action cannot be undone.
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={handleDelete}
                                disabled={isLoading}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
                              >
                                Delete
                              </button>
                              <button
                                onClick={cancelAction}
                                className="px-4 py-2 bg-ide-bg border border-ide-border rounded text-ide-text hover:bg-ide-border transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    // Item list
                    <div className="space-y-4">
                      {/* Folders */}
                      {folders.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-ide-text mb-2 flex items-center gap-2">
                            <Folder className="w-4 h-4" />
                            Folders ({folders.length})
                          </h3>
                          <div className="space-y-1">
                            {folders.map((folder) => (
                              <div
                                key={folder.path}
                                className="flex items-center justify-between p-3 bg-ide-bg border border-ide-border rounded hover:bg-ide-border transition-colors"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <Folder className="w-4 h-4 text-ide-accent flex-shrink-0" />
                                  <span className="text-sm text-ide-text truncate">{folder.name}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => startAction(folder, 'rename')}
                                    className="p-1.5 hover:bg-ide-panel rounded text-ide-text-muted hover:text-ide-text transition-colors"
                                    title="Rename"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => startAction(folder, 'move')}
                                    className="p-1.5 hover:bg-ide-panel rounded text-ide-text-muted hover:text-ide-text transition-colors"
                                    title="Move"
                                  >
                                    <Move className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => startAction(folder, 'delete')}
                                    className="p-1.5 hover:bg-red-500/20 rounded text-red-400 hover:text-red-300 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Files */}
                      {files.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-ide-text mb-2 flex items-center gap-2">
                            <File className="w-4 h-4" />
                            Files ({files.length})
                          </h3>
                          <div className="space-y-1">
                            {files.map((file) => (
                              <div
                                key={file.path}
                                className="flex items-center justify-between p-3 bg-ide-bg border border-ide-border rounded hover:bg-ide-border transition-colors"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <File className="w-4 h-4 text-ide-text-muted flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm text-ide-text truncate block">{file.name}</span>
                                    <span className="text-xs text-ide-text-muted">
                                      {file.size ? `${(file.size / 1024).toFixed(2)} KB` : ''} • {file.extension}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => startAction(file, 'rename')}
                                    className="p-1.5 hover:bg-ide-panel rounded text-ide-text-muted hover:text-ide-text transition-colors"
                                    title="Rename"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => startAction(file, 'move')}
                                    className="p-1.5 hover:bg-ide-panel rounded text-ide-text-muted hover:text-ide-text transition-colors"
                                    title="Move"
                                  >
                                    <Move className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => startAction(file, 'delete')}
                                    className="p-1.5 hover:bg-red-500/20 rounded text-red-400 hover:text-red-300 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {folders.length === 0 && files.length === 0 && (
                        <div className="text-center py-8 text-ide-text-muted">
                          <p>No folders or files in this location.</p>
                        </div>
                      )}
                    </div>
                  )}
                </Tabs.Content>
              </div>
            </Tabs.Root>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
