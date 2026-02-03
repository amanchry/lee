import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Upload, Folder, File, FolderPlus, Trash2, ChevronRight, ChevronLeft, Loader2, Image, Map, Table } from 'lucide-react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { useToast } from '../hooks/useToast'
import { api } from '../services/api'
import FileViewerModal from './FileViewerModal'
import ConfirmationModal from './ConfirmationModal'
import AreaNameModal from './AreaNameModal'
import UploadFileModal from './UploadFileModal'

export default function AssetsView({ onAddLayer, onFitBounds, refreshTrigger }) {
  const [files, setFiles] = useState([])
  const [folders, setFolders] = useState([])
  const [currentPath, setCurrentPath] = useState('assets')
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ isOpen: false, item: null })
  const [areaNameModal, setAreaNameModal] = useState({ isOpen: false, file: null })
  const [uploadModal, setUploadModal] = useState(false)
  const fileInputRef = useRef(null)
  const toast = useToast()

  // Ref to prevent concurrent calls
  const isLoadingRef = useRef(false)
  const lastLoadedPathRef = useRef('')

  // Load files and folders - stable function that doesn't depend on state
  const loadFiles = useRef(async (folderPath = 'assets') => {
    // Prevent concurrent calls or duplicate calls for same path
    if (isLoadingRef.current || lastLoadedPathRef.current === folderPath) {
      return
    }
    
    isLoadingRef.current = true
    lastLoadedPathRef.current = folderPath
    setIsLoading(true)
    
    try {
      const response = await api.files.list(folderPath)
      
      if (response.success) {
        const filesList = response.data?.files || []
        const foldersList = response.data?.folders || []
        const path = response.data?.current_path || folderPath
        
        setFiles(filesList)
        setFolders(foldersList)
        // Only update path if it's different to prevent loops
        setCurrentPath(prevPath => {
          if (prevPath !== path) {
            return path
          }
          return prevPath
        })
      } else {
        toast.error('Load failed', response.message || 'Failed to load files')
      }
    } catch (error) {
      console.error('Error loading files:', error)
      toast.error('Error', error.message || 'Error loading files')
    } finally {
      setIsLoading(false)
      isLoadingRef.current = false
    }
  }).current

  // Load files on mount and when path changes - only depend on currentPath
  useEffect(() => {
    if (currentPath && currentPath !== lastLoadedPathRef.current) {
      loadFiles(currentPath)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath])

  // Refresh when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger) {
      loadFiles(currentPath)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger])

  // Handle file upload from modal
  const handleFileUploadFromModal = async (file, areaName = null) => {
    if (!file) {
      toast.warning('No file selected', 'Please select a file to upload')
      return
    }

    // Check if it's a GeoJSON file
    const fileExt = file.name.split('.').pop().toLowerCase()
    const isGeoJSON = fileExt === 'geojson' || fileExt === 'json'

    // For GeoJSON files, if areaName is provided (from UploadFileModal), upload directly
    // Otherwise, show AreaNameModal (for legacy direct file input)
    if (isGeoJSON) {
      if (areaName) {
        // Upload directly with the name from UploadFileModal
        setIsUploading(true)
        setUploadModal(false)
        
        try {
          console.log('Uploading GeoJSON to PostGIS:', { fileName: file.name, areaName })
          
          const response = await api.files.uploadGeoJSON(file, areaName, currentPath)

          if (response.success) {
            console.log('GeoJSON saved to PostGIS:', response.data)
            toast.success('Area saved', `"${areaName}" saved to PostGIS successfully!`)
            
            // Fetch the geometry and add to map
            if (response.data && response.data.id && onAddLayer) {
              try {
                const geomResponse = await api.areas.getGeometry(response.data.id)
                if (geomResponse.success && geomResponse.data && geomResponse.data.geometry) {
                  // Create layer for the uploaded area
                  const layer = {
                    id: `area_${response.data.id}`,
                    name: areaName,
                    type: 'vector',
                    geojson: geomResponse.data.geometry,
                    visible: true,
                    opacity: 0.7
                  }
                  onAddLayer(layer)
                }
              } catch (error) {
                console.error('Error fetching geometry for map:', error)
              }
            }
            
            // Reset last loaded path and reload files
            lastLoadedPathRef.current = ''
            await loadFiles(currentPath)
          } else {
            console.error('Upload failed:', response.message)
            toast.error('Upload failed', response.message || 'Failed to save GeoJSON')
          }
        } catch (error) {
          console.error('Error uploading GeoJSON:', error)
          toast.error('Upload error', error.message || 'Error saving GeoJSON')
        } finally {
          setIsUploading(false)
        }
      } else {
        // Legacy flow: show AreaNameModal
        const extractedAreaName = file.name.replace(/\.(geojson|json)$/i, '')
        setUploadModal(false)
        setAreaNameModal({ isOpen: true, file, areaName: extractedAreaName })
      }
    } else {
      // Regular file upload
      setIsUploading(true)
      setUploadModal(false)
      
      try {
        console.log('Uploading file:', { fileName: file.name, fileSize: file.size, folderPath: currentPath })
        
        const response = await api.files.upload(file, currentPath)

        if (response.success) {
          console.log('File uploaded successfully:', response.data)
          toast.success('File uploaded', `"${file.name}" uploaded successfully!`)
          // Reset last loaded path and reload files
          lastLoadedPathRef.current = ''
          await loadFiles(currentPath)
        } else {
          console.error('Upload failed:', response.message)
          toast.error('Upload failed', response.message || 'Failed to upload file')
        }
      } catch (error) {
        console.error('Error uploading file:', error)
        toast.error('Upload error', error.message || 'Error uploading file')
      } finally {
        setIsUploading(false)
      }
    }
  }

  // Legacy handler for direct file input (kept for backward compatibility)
  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) {
      toast.warning('No file selected', 'Please select a file to upload')
      return
    }
    // Open upload modal instead
    setUploadModal(true)
  }

  // Handle GeoJSON upload with area name
  const handleGeoJSONUpload = async (areaName) => {
    const file = areaNameModal.file
    if (!file) return

    setIsUploading(true)
    setAreaNameModal({ isOpen: false, file: null })

    try {
      console.log('Uploading GeoJSON to PostGIS:', { fileName: file.name, areaName })
      
      const response = await api.files.uploadGeoJSON(file, areaName, currentPath)

      if (response.success) {
        console.log('GeoJSON saved to PostGIS:', response.data)
        toast.success('Area saved', `"${areaName}" saved to PostGIS successfully!`)
        
        // Fetch the geometry and add to map
        if (response.data && response.data.id && onAddLayer) {
          try {
            const geomResponse = await api.areas.getGeometry(response.data.id)
            if (geomResponse.success && geomResponse.data && geomResponse.data.geometry) {
              // Create layer for the uploaded area
              const layer = {
                id: `area_${response.data.id}`,
                name: areaName,
                type: 'vector',
                geojson: geomResponse.data.geometry,
                visible: true,
                opacity: 0.7
              }
              onAddLayer(layer)
            }
          } catch (error) {
            console.error('Error fetching geometry for map:', error)
          }
        }
        
        // Reset last loaded path and reload files
        lastLoadedPathRef.current = ''
        await loadFiles(currentPath)
      } else {
        console.error('Upload failed:', response.message)
        toast.error('Upload failed', response.message || 'Failed to save GeoJSON')
      }
    } catch (error) {
      console.error('Error uploading GeoJSON:', error)
      toast.error('Upload error', error.message || 'Error saving GeoJSON')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = '' // Reset file input
      }
    }
  }

  // Handle create folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.warning('Invalid input', 'Please enter a folder name')
      return
    }

    const folderName = newFolderName.trim()
    console.log('Creating folder:', { folderName, parentPath: currentPath })

    try {
      const response = await api.files.createFolder(folderName, currentPath)

      if (response.success) {
        console.log('Folder created successfully:', response.data)
        toast.success('Folder created', `"${folderName}" created successfully!`)
        setNewFolderName('')
        setShowCreateFolder(false)
        // Reset last loaded path and reload files
        lastLoadedPathRef.current = ''
        await loadFiles(currentPath)
      } else {
        console.error('Failed to create folder:', response.message)
        toast.error('Failed to create folder', response.message || 'Error creating folder')
      }
    } catch (error) {
      console.error('Error creating folder:', error)
      toast.error('Error', error.message || 'Error creating folder')
    }
  }

  // Handle delete file/folder - show confirmation modal
  const handleDelete = (item, e) => {
    e.stopPropagation() // Prevent file click when deleting
    setDeleteConfirmModal({
      isOpen: true,
      item: item
    })
  }

  // Confirm delete action
  const confirmDelete = async () => {
    const { item } = deleteConfirmModal
    if (!item) return

    try {
      // Use original_path if available (for backend compatibility), otherwise use path
      const pathToDelete = item.original_path || item.path
      const response = await api.files.delete(pathToDelete)

      if (response.success) {
        toast.success('Deleted', `"${item.name}" has been deleted successfully`)
        setDeleteConfirmModal({ isOpen: false, item: null })
        // Reset last loaded path and reload files
        lastLoadedPathRef.current = ''
        await loadFiles(currentPath)
      } else {
        toast.error('Delete failed', response.message || 'Error deleting file/folder')
        setDeleteConfirmModal({ isOpen: false, item: null })
      }
    } catch (error) {
      console.error('Error deleting:', error)
      toast.error('Error', error.message || 'Error deleting file/folder')
      setDeleteConfirmModal({ isOpen: false, item: null })
    }
  }

  // Handle file click - open viewer modal (don't touch main map)
  const handleFileClick = (file) => {
    console.log('File clicked:', file)
    console.log('File metadata:', file.metadata)
    setSelectedFile(file)
    setIsModalOpen(true)
    // Extent visualization is shown in the metadata tab map, not on main map
  }

  // Navigate to folder
  const navigateToFolder = (folder) => {
    // Extract relative path from username-based path
    // folder.path might be like "username_earthcode/assets/folder" or "user_1/assets/folder"
    // We need to extract just the part after "username/assets" or "user_X/assets"
    let relativePath = folder.path
    
    // Remove username or user_X prefix and keep only relative part
    if (relativePath.includes('/assets/')) {
      // Extract everything after "/assets/"
      relativePath = relativePath.split('/assets/')[1] || ''
      
      // Build the new path relative to assets
      if (relativePath) {
        setCurrentPath(`assets/${relativePath}`)
      } else {
        // Fallback: extract folder name from full path
        const folderName = folder.path.split('/').pop()
        setCurrentPath(`assets/${folderName}`)
      }
    } else if (relativePath.startsWith('assets/')) {
      // Path already starts with assets/, use as is
      setCurrentPath(relativePath)
    } else {
      // Fallback: extract folder name and append to current path
      const folderName = folder.path.split('/').pop()
      setCurrentPath(currentPath === 'assets' ? `assets/${folderName}` : `${currentPath}/${folderName}`)
    }
  }

  // Navigate back
  const navigateBack = () => {
    if (currentPath === 'assets') return
    
    const pathParts = currentPath.split('/')
    pathParts.pop()
    setCurrentPath(pathParts.join('/') || 'assets')
  }

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="h-full flex flex-col bg-ide-panel min-h-0 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-ide-border flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-ide-text">Assets</h3>
        </div>
        <div className="flex items-center gap-1">
          {currentPath !== 'assets' && (
            <button
              onClick={navigateBack}
              className="p-1 hover:bg-ide-bg rounded text-ide-text-muted hover:text-ide-text transition-colors"
              title="Go back"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setShowCreateFolder(!showCreateFolder)}
            className="p-1 hover:bg-ide-bg rounded text-ide-text-muted hover:text-ide-text transition-colors"
            title="Create folder"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
            <button
              onClick={() => setUploadModal(true)}
              disabled={isUploading}
              className="p-1 hover:bg-ide-bg rounded text-ide-text-muted hover:text-ide-text transition-colors disabled:opacity-50"
              title="Upload file"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
            </button>
          </div>
        <p className="text-xs text-ide-text-muted">
          Path: {currentPath}
        </p>
        
        {/* Create Folder Input */}
        {showCreateFolder && (
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="flex-1 px-2 py-1 text-xs bg-ide-bg border border-ide-border rounded text-ide-text focus:outline-none focus:ring-1 focus:ring-ide-accent"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCreateFolder()
                }
              }}
              autoFocus
            />
            <button
              onClick={handleCreateFolder}
              className="px-2 py-1 text-xs bg-ide-accent text-white rounded hover:opacity-90"
            >
              Create
            </button>
            <button
              onClick={() => {
                setShowCreateFolder(false)
                setNewFolderName('')
              }}
              className="px-2 py-1 text-xs bg-ide-bg border border-ide-border rounded text-ide-text hover:bg-ide-border"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          accept=".geojson,.json,.shp,.shx,.dbf,.prj,.cpg,.sbn,.sbx"
          className="hidden"
        />
      </div>

      {/* Files and Folders List */}
      <ScrollArea.Root className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea.Viewport className="h-full w-full">
          <div className="p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-ide-text-muted" />
              </div>
            ) : folders.length === 0 && files.length === 0 ? (
              <div className="text-center py-8 text-ide-text-muted text-sm">
                No files or folders. Upload files or create folders to get started.
              </div>
            ) : (
              <>
                {/* Folders */}
                {folders.map((folder) => (
                  <div
                    key={folder.path}
                    className="flex items-center gap-2 px-3 py-2 rounded hover:bg-ide-bg cursor-pointer mb-1 group"
                  >
                    <Folder className="w-4 h-4 text-ide-accent flex-shrink-0" />
                    <div
                      className="flex-1 min-w-0"
                      onClick={() => navigateToFolder(folder)}
                    >
                      <div className="text-sm font-medium truncate text-ide-text">{folder.name}</div>
                      <div className="text-xs text-ide-text-muted truncate">Folder</div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(folder, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-red-400 transition-opacity"
                      title="Delete folder"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {/* Files */}
                {files.map((file) => {
                  // Determine asset type for icon
                  const getAssetIcon = () => {
                    const assetType = file.asset_type || file.extension?.toLowerCase()
                    
                    // Raster data (GeoTIFF)
                    if (assetType === 'geotiff' || assetType === 'tif' || assetType === 'tiff') {
                      return <Image className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    }
                    
                    // Vector data (GeoJSON)
                    if (assetType === 'geojson' || assetType === 'json' || file.is_geojson_in_postgis) {
                      return <Map className="w-4 h-4 text-green-400 flex-shrink-0" />
                    }
                    
                    // Tabular data (CSV)
                    if (assetType === 'csv') {
                      return <Table className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    }
                    
                    // Default icon
                    return <File className="w-4 h-4 text-ide-text-muted flex-shrink-0" />
                  }
                  
                  return (
                    <div
                      key={file.path}
                      className="flex items-center gap-2 px-3 py-2 rounded hover:bg-ide-bg cursor-pointer mb-1 group"
                      onClick={() => handleFileClick(file)}
                    >
                      {getAssetIcon()}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate text-ide-text">{file.name}</div>
                        <div className="text-xs text-ide-text-muted truncate">
                          {formatFileSize(file.size)} • {file.extension}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDelete(file, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-red-400 transition-opacity"
                        title="Delete file"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar className="flex touch-none select-none transition-colors bg-ide-bg data-[orientation=vertical]:w-2.5 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:h-2.5">
          <ScrollArea.Thumb className="flex-1 bg-ide-border rounded-[10px] relative before:content-[''] before:absolute before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-full before:h-full before:min-w-[44px] before:min-h-[44px]" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>

      {/* File Viewer Modal */}
      <FileViewerModal
        file={selectedFile}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedFile(null)
        }}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmModal.isOpen}
        onClose={() => setDeleteConfirmModal({ isOpen: false, item: null })}
        onConfirm={confirmDelete}
        title="Delete Item"
        message={deleteConfirmModal.item ? `Are you sure you want to delete "${deleteConfirmModal.item.name}"? This action cannot be undone.` : ''}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Area Name Modal for GeoJSON uploads */}
      <AreaNameModal
        isOpen={areaNameModal.isOpen}
        onClose={() => {
          setAreaNameModal({ isOpen: false, file: null })
          fileInputRef.current.value = '' // Reset file input
        }}
        onSubmit={handleGeoJSONUpload}
        fileName={areaNameModal.file?.name}
      />

      {/* Upload File Modal */}
      <UploadFileModal
        isOpen={uploadModal}
        onClose={() => setUploadModal(false)}
        onUpload={handleFileUploadFromModal}
        currentPath={currentPath}
        isUploading={isUploading}
      />
    </div>
  )
}
