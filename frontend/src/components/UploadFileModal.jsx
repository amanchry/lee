import React, { useState, useRef, useEffect } from 'react'
import { X, Upload, File as FileIcon, Loader2 } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'

export default function UploadFileModal({ isOpen, onClose, onUpload, currentPath, isUploading }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileName, setFileName] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)
  const dropZoneRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setSelectedFile(null)
      setFileName('')
      setIsDragging(false)
    }
  }, [isOpen])

  // Auto-fill filename when file is selected
  useEffect(() => {
    if (selectedFile && !fileName) {
      // Remove extension for naming
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '')
      setFileName(nameWithoutExt)
    }
  }, [selectedFile, fileName])

  const handleFileSelect = (file) => {
    if (!file) return
    
    // Validate file type
    const fileExt = file.name.split('.').pop().toLowerCase()
    const allowedExts = ['geojson', 'json', 'tif', 'tiff', 'geotiff', 'csv']
    
    if (!allowedExts.includes(fileExt)) {
      alert(`Invalid file type. Only GeoJSON, GeoTIFF, and CSV files are allowed.`)
      return
    }
    
    setSelectedFile(file)
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
    setFileName(nameWithoutExt)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleFileInputChange = (e) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleUpload = () => {
    if (!selectedFile || !fileName.trim()) {
      return
    }

    // For GeoJSON files, pass the name directly (it will be used as area name)
    // For other files, rename the file
    const fileExt = selectedFile.name.split('.').pop().toLowerCase()
    const isGeoJSON = fileExt === 'geojson' || fileExt === 'json'
    
    if (isGeoJSON) {
      // For GeoJSON, pass the original file and the area name
      onUpload(selectedFile, fileName.trim())
    } else {
      // For other files, create a new File object with the custom name
      const newFileName = `${fileName.trim()}.${fileExt}`
      const renamedFile = new File([selectedFile], newFileName, {
        type: selectedFile.type,
        lastModified: selectedFile.lastModified
      })
      onUpload(renamedFile)
    }
    
    // Reset state
    setSelectedFile(null)
    setFileName('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCancel = () => {
    setSelectedFile(null)
    setFileName('')
    setIsDragging(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onClose()
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const isGeoJSON = selectedFile && (
    selectedFile.name.toLowerCase().endsWith('.geojson') ||
    selectedFile.name.toLowerCase().endsWith('.json')
  )
  
  const isValidFileType = selectedFile && (
    selectedFile.name.toLowerCase().endsWith('.geojson') ||
    selectedFile.name.toLowerCase().endsWith('.json') ||
    selectedFile.name.toLowerCase().endsWith('.tif') ||
    selectedFile.name.toLowerCase().endsWith('.tiff') ||
    selectedFile.name.toLowerCase().endsWith('.geotiff') ||
    selectedFile.name.toLowerCase().endsWith('.csv')
  )

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-ide-panel border border-ide-border rounded-lg shadow-lg z-50 w-full max-w-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold text-ide-text">
              Upload File
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                onClick={handleCancel}
                className="p-1 hover:bg-ide-bg rounded text-ide-text-muted hover:text-ide-text transition-colors"
                disabled={isUploading}
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {!selectedFile ? (
            // File selection area
            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-ide-accent bg-ide-accent/10'
                  : 'border-ide-border hover:border-ide-accent/50'
              }`}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-ide-text-muted" />
              <p className="text-ide-text mb-2">
                {isDragging ? 'Drop file here' : 'Drag and drop a file here'}
              </p>
              <p className="text-sm text-ide-text-muted mb-4">or</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-ide-accent hover:bg-ide-accent-hover text-white rounded transition-colors"
                disabled={isUploading}
              >
                Browse Files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileInputChange}
                accept=".geojson,.json,.tif,.tiff,.geotiff,.csv"
                className="hidden"
              />
            </div>
          ) : (
            // File info and naming
            <div className="space-y-4">
              {/* File preview */}
              <div className="flex items-center gap-3 p-3 bg-ide-bg rounded border border-ide-border">
                <FileIcon className="w-8 h-8 text-ide-accent flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ide-text truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-ide-text-muted">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedFile(null)
                    setFileName('')
                    if (fileInputRef.current) {
                      fileInputRef.current.value = ''
                    }
                  }}
                  className="p-1 hover:bg-ide-border rounded text-ide-text-muted hover:text-ide-text transition-colors"
                  disabled={isUploading}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* File name input */}
              <div>
                <label className="block text-sm font-medium text-ide-text-muted mb-2">
                  File Name {isGeoJSON && <span className="text-xs">(for GeoJSON, this will be the area name)</span>}
                </label>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="Enter file name"
                  className="w-full px-3 py-2 bg-ide-bg border border-ide-border rounded text-ide-text focus:outline-none focus:ring-2 focus:ring-ide-accent"
                  autoFocus
                  disabled={isUploading}
                />
                <p className="mt-1 text-xs text-ide-text-muted">
                  Original: {selectedFile.name}
                </p>
              </div>

              {/* Upload button */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm bg-ide-bg border border-ide-border rounded text-ide-text hover:bg-ide-border transition-colors"
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={!fileName.trim() || isUploading}
                  className="px-4 py-2 text-sm bg-ide-accent hover:bg-ide-accent-hover disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors flex items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      {isGeoJSON ? 'Save to PostGIS' : isValidFileType ? 'Upload File' : 'Invalid File Type'}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
