import React, { useState, useEffect, useRef } from 'react'
import { X, Map, FileText, Loader2, Copy, Check } from 'lucide-react'
import { Map as OLMap, View } from 'ol'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import OSM from 'ol/source/OSM'
import GeoJSON from 'ol/format/GeoJSON'
import { fromLonLat } from 'ol/proj'
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style'
import Feature from 'ol/Feature'
import Polygon from 'ol/geom/Polygon'
import 'ol/ol.css'

export default function FileViewerModal({ file, isOpen, onClose }) {
  const [fileData, setFileData] = useState(null)
  const [metadata, setMetadata] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('metadata')
  const [copied, setCopied] = useState(false)
  const [isLargeFile, setIsLargeFile] = useState(false)
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  
  // File size threshold: 10MB (10 * 1024 * 1024 bytes)
  const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024

  useEffect(() => {
    if (isOpen && file) {
      console.log('FileViewerModal opened with file:', file)
      console.log('File metadata:', file.metadata)
      console.log('Is GeoJSON in PostGIS:', file.is_geojson_in_postgis)
      
      setIsLoading(false)
      setIsLargeFile(false)
      
      // For files stored in PostGIS, don't try to load the file - use metadata only
      if (file.is_geojson_in_postgis) {
        console.log('File is stored in PostGIS, using metadata only')
        
        // Use metadata from file object or create basic metadata
        const bounds = file.metadata?.bounds || file.metadata?.bbox
        let bbox = null
        if (bounds) {
          if (Array.isArray(bounds)) {
            bbox = bounds
          } else if (bounds.minx !== undefined) {
            bbox = [bounds.minx, bounds.miny, bounds.maxx, bounds.maxy]
          }
        }
        
        const fileMetadata = {
          type: 'geojson',
          ...(file.metadata || {}),
          bbox: bbox || file.metadata?.bbox,
          size: file.metadata?.size || file.size || 0,
          features: file.metadata?.features || 0,
          crs: file.metadata?.crs || 'EPSG:4326',
        }
        
        console.log('Setting metadata for PostGIS file:', fileMetadata)
        setMetadata(fileMetadata)
        
        setFileData({ 
          type: 'FeatureCollection',
          features: [],
          metadata_only: true 
        })
        
        setActiveTab('metadata')
        return
      }
      
      // For other files (GeoTIFF, CSV), try to use metadata from file object first
      if (file.metadata && Object.keys(file.metadata).length > 0) {
        console.log('Using metadata from file object')
        
        // Set metadata immediately
        const bounds = file.metadata.bounds || file.metadata.bbox
        let bbox = null
        if (bounds) {
          if (Array.isArray(bounds)) {
            bbox = bounds
          } else if (bounds.minx !== undefined) {
            bbox = [bounds.minx, bounds.miny, bounds.maxx, bounds.maxy]
          }
        }
        
        const fileMetadata = {
          ...file.metadata,
          bbox: bbox || file.metadata.bbox,
          size: file.metadata.size || file.size || 0,
        }
        
        console.log('Setting metadata:', fileMetadata)
        setMetadata(fileMetadata)
        
        // Set fileData for display
        setFileData({ 
          type: file.asset_type || 'file',
          metadata_only: true 
        })
        
        setActiveTab('metadata')
      } else {
        console.log('No metadata in file object, loading file data')
        // Only try to load file if it's not stored in PostGIS and has a URL
        // Check if file is too large before loading
        const fileSize = file.size || 0
        if (fileSize > LARGE_FILE_THRESHOLD) {
          setIsLargeFile(true)
          setFileData(null)
          // Still set basic metadata from file object
          setMetadata({
            type: file.asset_type || 'file',
            size: file.size || 0,
          })
        } else if (file.url || file.path) {
          // Only load if we have a URL or path
          loadFileData()
        } else {
          // No URL/path and no metadata - show basic info
          setMetadata({
            type: file.asset_type || 'file',
            size: file.size || 0,
          })
          setFileData({ 
            type: file.asset_type || 'file',
            metadata_only: true 
          })
        }
        setActiveTab('metadata')
      }
    } else {
      setFileData(null)
      setMetadata(null)
      setIsLargeFile(false)
      setActiveTab('metadata')
      // Clean up maps when closing
      if (mapRef.current) {
        mapRef.current.setTarget(null)
        mapRef.current = null
      }
    }
  }, [isOpen, file])

  // Initialize map when map tab is active - show GeoJSON features or extent visualization
  useEffect(() => {
    const hasBounds = metadata && !!(metadata.bbox || metadata.bounds)
    const isGeoJSONFile = fileData && (fileData.type === 'FeatureCollection' || fileData.type === 'Feature')
    const shouldShowMap = isGeoJSONFile || hasBounds
    
    console.log('Map tab effect:', { 
      activeTab, 
      hasBounds, 
      isGeoJSONFile, 
      shouldShowMap, 
      containerReady: !!mapContainerRef.current,
      metadata: metadata ? { bbox: metadata.bbox, bounds: metadata.bounds } : null
    })
    
    if (activeTab === 'map' && shouldShowMap) {
      // Wait for container to be ready
      let retryCount = 0
      const maxRetries = 30 // 3 seconds max wait
      
      const initMap = () => {
        if (mapContainerRef.current) {
          const rect = mapContainerRef.current.getBoundingClientRect()
          const isVisible = rect.width > 0 && rect.height > 0
          
          if (isVisible) {
            console.log('Container ready and visible, initializing map')
            if (!mapRef.current) {
              initializeMap()
            } else {
              // Update map size if it already exists
              mapRef.current.setTarget(mapContainerRef.current)
              setTimeout(() => {
                if (mapRef.current) {
                  mapRef.current.updateSize()
                }
              }, 100)
            }
          } else if (retryCount < maxRetries) {
            // Container not visible yet, retry
            retryCount++
            setTimeout(initMap, 100)
          } else {
            console.warn('Container never became visible')
          }
        } else if (retryCount < maxRetries) {
          // Container not ready yet, retry
          retryCount++
          setTimeout(initMap, 100)
        } else {
          console.warn('Container never became available')
        }
      }
      
      // Small delay to ensure DOM is ready
      setTimeout(initMap, 150)
    } else if (activeTab !== 'map' && mapRef.current) {
      // Remove map target when switching away from map tab
      mapRef.current.setTarget(null)
    }
  }, [activeTab, fileData, metadata])

  const loadFileData = async () => {
    if (!file) return

    setIsLoading(true)
    
    // Always use metadata from file object if available (don't load full file)
    if (file.metadata && Object.keys(file.metadata).length > 0) {
      const bounds = file.metadata.bounds || file.metadata.bbox
      let bbox = null
      
      // Handle both formats: {minx, miny, maxx, maxy} or [minx, miny, maxx, maxy]
      if (bounds) {
        if (Array.isArray(bounds)) {
          bbox = bounds
        } else if (bounds.minx !== undefined) {
          bbox = [bounds.minx, bounds.miny, bounds.maxx, bounds.maxy]
        }
      }
      
      // Set metadata from file object with all fields
      const fileMetadata = {
        ...file.metadata,
        bbox: bbox || file.metadata.bbox,
        // Add file size if not in metadata
        size: file.metadata.size || file.size || 0,
      }
      
      setMetadata(fileMetadata)
      
      // For GeoJSON files stored in PostGIS, we don't need to load the full geometry
      if (file.is_geojson_in_postgis) {
        setFileData({ 
          type: 'FeatureCollection',
          features: [],
          metadata_only: true 
        })
        setIsLoading(false)
        return
      }
      
      // For GeoTIFF and CSV, we also don't need to load the full file - metadata is enough
      if (file.asset_type === 'geotiff' || file.asset_type === 'csv') {
        setFileData({ 
          type: file.asset_type,
          metadata_only: true 
        })
        setIsLoading(false)
        return
      }
    }
    
    // If no metadata available, try to load file to extract metadata
    // But only for files that might not have metadata yet
    // Skip if file is stored in PostGIS (no physical file exists)
    if (file.is_geojson_in_postgis) {
      console.log('Skipping file load - stored in PostGIS')
      setIsLoading(false)
      return
    }
    
    try {
      // Construct full URL - handle both url and path properties
      let fileUrl = file.url
      
      // If no URL, construct from path
      if (!fileUrl && file.path) {
        // Ensure path starts with /djangoApi/media/
        if (file.path.startsWith('/djangoApi/media/')) {
          fileUrl = file.path
        } else if (file.path.startsWith('djangoApi/media/')) {
          fileUrl = `/${file.path}`
        } else {
          // Assume it's a relative path from MEDIA_ROOT
          fileUrl = `/djangoApi/media/${file.path}`
        }
      }
      
      // Ensure URL is absolute
      if (fileUrl && !fileUrl.startsWith('http')) {
        // Use the API base URL from environment or default
        const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
        fileUrl = `${apiBase}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`
      }
      
      if (!fileUrl) {
        throw new Error('No file URL or path available')
      }
      
      console.log('Loading file from URL:', fileUrl)
      const response = await fetch(fileUrl)
      
      if (!response.ok) {
        throw new Error(`Failed to load file: ${response.status} ${response.statusText}`)
      }
      
      const text = await response.text()

      // Try to parse as JSON (GeoJSON)
      try {
        const json = JSON.parse(text)
        setFileData(json)
        
        // Extract metadata
        const meta = {
          type: json.type || 'Unknown',
          features: json.features ? json.features.length : 0,
          crs: json.crs?.properties?.name || 'EPSG:4326',
          bbox: json.bbox || null,
        }

        // Calculate bounds from features if bbox not available
        if (!meta.bbox && json.features && json.features.length > 0) {
          let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity
          json.features.forEach(feature => {
            if (feature.geometry) {
              const coords = extractCoordinates(feature.geometry)
              coords.forEach(([lon, lat]) => {
                minLon = Math.min(minLon, lon)
                minLat = Math.min(minLat, lat)
                maxLon = Math.max(maxLon, lon)
                maxLat = Math.max(maxLat, lat)
              })
            }
          })
          if (minLon !== Infinity) {
            meta.bbox = [minLon, minLat, maxLon, maxLat]
          }
        }

        setMetadata(meta)
        
        // Don't touch main map - extent visualization is shown in Map View tab
      } catch (e) {
        // Not JSON, treat as text
        setFileData({ type: 'text', content: text })
        setMetadata({
          type: 'text',
          size: text.length,
        })
      }
    } catch (error) {
      console.error('Error loading file:', error)
      setFileData({ error: error.message })
      setMetadata({ 
        error: error.message,
        type: 'error'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const extractCoordinates = (geometry) => {
    const coords = []
    if (geometry.type === 'Point') {
      coords.push(geometry.coordinates)
    } else if (geometry.type === 'LineString' || geometry.type === 'MultiPoint') {
      coords.push(...geometry.coordinates)
    } else if (geometry.type === 'Polygon' || geometry.type === 'MultiLineString') {
      geometry.coordinates.forEach(ring => coords.push(...ring))
    } else if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach(polygon => {
        polygon.forEach(ring => coords.push(...ring))
      })
    }
    return coords
  }

  const initializeMap = () => {
    if (!mapContainerRef.current) {
      console.log('Map container not ready')
      return
    }
    if (mapRef.current) {
      console.log('Map already initialized')
      return
    }
    
    console.log('Initializing map with metadata:', metadata, 'fileData:', fileData)

    // Create base layer
    const baseLayer = new TileLayer({
      source: new OSM()
    })

    // Create vector source and layer for GeoJSON
    const vectorSource = new VectorSource()
    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: new Style({
        fill: new Fill({
          color: 'rgba(59, 130, 246, 0.3)'
        }),
        stroke: new Stroke({
          color: '#3b82f6',
          width: 2
        }),
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({
            color: '#3b82f6'
          }),
          stroke: new Stroke({
            color: '#fff',
            width: 2
          })
        })
      })
    })

    // Create map
    mapRef.current = new OLMap({
      target: mapContainerRef.current,
      layers: [baseLayer, vectorLayer],
      view: new View({
        center: fromLonLat([0, 0]),
        zoom: 2
      })
    })

    // Load GeoJSON if available
    if (fileData && fileData.type === 'FeatureCollection') {
      const geojsonFormat = new GeoJSON()
      const features = geojsonFormat.readFeatures(fileData, {
        featureProjection: 'EPSG:3857'
      })
      vectorSource.addFeatures(features)

      // Fit map to features
      if (features.length > 0) {
        const extent = vectorSource.getExtent()
        // Wait for map to be fully rendered before fitting
        setTimeout(() => {
          if (mapRef.current && mapRef.current.getView()) {
            mapRef.current.getView().fit(extent, {
              padding: [50, 50, 50, 50],
              duration: 1000,
              maxZoom: 18
            })
          }
        }, 100)
      }
    } else if (metadata && (metadata.bbox || metadata.bounds)) {
      // Show extent visualization from metadata (for files without full geometry)
      let bbox = null
      if (metadata.bbox && Array.isArray(metadata.bbox) && metadata.bbox.length === 4) {
        bbox = metadata.bbox
      } else if (metadata.bounds) {
        // Handle object format {minx, miny, maxx, maxy}
        if (metadata.bounds.minx !== undefined) {
          bbox = [metadata.bounds.minx, metadata.bounds.miny, metadata.bounds.maxx, metadata.bounds.maxy]
        }
      }
      
      if (bbox && bbox.length === 4) {
        const [minLon, minLat, maxLon, maxLat] = bbox
        console.log('Fitting map to bbox:', bbox)
        
        // Add extent rectangle visualization first
        const extentPolygon = new Polygon([[
          fromLonLat([minLon, minLat]),
          fromLonLat([maxLon, minLat]),
          fromLonLat([maxLon, maxLat]),
          fromLonLat([minLon, maxLat]),
          fromLonLat([minLon, minLat])
        ]])
        vectorSource.addFeature(new Feature({ 
          geometry: extentPolygon,
          style: new Style({
            fill: new Fill({
              color: 'rgba(59, 130, 246, 0.1)'
            }),
            stroke: new Stroke({
              color: '#3b82f6',
              width: 2,
              lineDash: [5, 5]
            })
          })
        }))
        
        // Fit map to extent - use the polygon's extent
        const extent = extentPolygon.getExtent()
        console.log('Fitting to extent:', extent)
        
        // Wait for map to be fully rendered before fitting
        setTimeout(() => {
          if (mapRef.current && mapRef.current.getView()) {
            console.log('Fitting map view to extent')
            mapRef.current.getView().fit(extent, {
              padding: [50, 50, 50, 50],
              duration: 1000,
              maxZoom: 18
            })
            // Force update size after fitting
            setTimeout(() => {
              if (mapRef.current) {
                mapRef.current.updateSize()
              }
            }, 200)
          } else {
            console.warn('Map or view not ready for fitting')
          }
        }, 200)
      }
    }
  }


  if (!isOpen) return null

  const isGeoJSON = fileData && (fileData.type === 'FeatureCollection' || fileData.type === 'Feature')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-ide-panel border border-ide-border rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ide-border">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-ide-accent" />
            <div>
              <h2 className="text-lg font-semibold text-ide-text">{file?.name}</h2>
              <p className="text-xs text-ide-text-muted">{file?.extension} • {formatFileSize(file?.size)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-ide-bg rounded transition-colors text-ide-text-muted hover:text-ide-text"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        {fileData && !isLoading && (
          <div className="flex border-b border-ide-border">
            <button
              onClick={() => setActiveTab('metadata')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'metadata'
                  ? 'text-ide-accent border-b-2 border-ide-accent bg-ide-bg/50'
                  : 'text-ide-text-muted hover:text-ide-text hover:bg-ide-bg/30'
              }`}
            >
              Metadata
            </button>
            {(isGeoJSON || (metadata && (metadata.bbox || metadata.bounds))) && (
              <button
                onClick={() => setActiveTab('map')}
                className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'map'
                    ? 'text-ide-accent border-b-2 border-ide-accent bg-ide-bg/50'
                    : 'text-ide-text-muted hover:text-ide-text hover:bg-ide-bg/30'
                }`}
              >
                <Map className="w-4 h-4" />
                Map View
              </button>
            )}
            <button
              onClick={() => setActiveTab('data')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'data'
                  ? 'text-ide-accent border-b-2 border-ide-accent bg-ide-bg/50'
                  : 'text-ide-text-muted hover:text-ide-text hover:bg-ide-bg/30'
              }`}
            >
              Raw Data
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-ide-accent" />
            </div>
          ) : isLargeFile ? (
            /* Large File Warning */
            <div className="absolute inset-0 p-6 overflow-y-auto">
              <div className="flex flex-col items-center justify-center h-full space-y-4">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-yellow-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-ide-text mb-2">Large File Detected</h3>
                  <p className="text-ide-text-muted mb-4">
                    This file is too large ({formatFileSize(file?.size || 0)}) to load metadata.
                    <br />
                    You can still copy the file path to use in your scripts.
                  </p>
                </div>
                
                {/* File Path Section */}
                <div className="w-full max-w-2xl">
                  <h3 className="text-sm font-semibold text-ide-text mb-2">File Path</h3>
                  <div className="bg-ide-bg rounded-lg p-4 space-y-3">
                    {/* Relative Path */}
                    <div>
                      <label className="text-xs text-ide-text-muted mb-1 block">Relative Path:</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm text-ide-text font-mono bg-ide-panel px-3 py-2 rounded border border-ide-border break-all">
                          {file?.path || 'N/A'}
                        </code>
                        <button
                          onClick={async () => {
                            const pathToCopy = file?.path || ''
                            try {
                              await navigator.clipboard.writeText(pathToCopy)
                              setCopied(true)
                              setTimeout(() => setCopied(false), 2000)
                            } catch (err) {
                              console.error('Failed to copy:', err)
                            }
                          }}
                          className="p-2 hover:bg-ide-border rounded transition-colors text-ide-text-muted hover:text-ide-text flex-shrink-0"
                          title="Copy relative path"
                        >
                          {copied ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    
                    {/* Python Usage Example */}
                    <div>
                      <label className="text-xs text-ide-text-muted mb-1 block">Python Usage (Recommended):</label>
                      <div className="flex items-start gap-2">
                        <code className="flex-1 text-xs text-ide-text font-mono bg-ide-panel px-3 py-2 rounded border border-ide-border whitespace-pre-wrap">
                          {file?.path ? `# Helper function get_user_path() is automatically available\nfile_path = get_user_path('${file.path}')` : 'N/A'}
                        </code>
                        <button
                          onClick={async () => {
                            if (!file?.path) return
                            const pythonCode = `# Helper function get_user_path() is automatically available\nfile_path = get_user_path('${file.path}')`
                            
                            try {
                              await navigator.clipboard.writeText(pythonCode)
                              setCopied(true)
                              setTimeout(() => setCopied(false), 2000)
                            } catch (err) {
                              console.error('Failed to copy:', err)
                            }
                          }}
                          className="p-2 hover:bg-ide-border rounded transition-colors text-ide-text-muted hover:text-ide-text flex-shrink-0 mt-0.5"
                          title="Copy Python code"
                        >
                          {copied ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-ide-text-muted mt-2">
                        The <code className="px-1 py-0.5 bg-ide-panel rounded text-xs">get_user_path()</code> helper function is automatically available in your scripts.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Metadata Tab */}
              {activeTab === 'metadata' && (
                <div className="absolute inset-0 p-6 overflow-y-auto">
                  {metadata && metadata.error ? (
                    <div className="text-center text-red-400 space-y-2">
                      <p className="font-semibold">Error loading file metadata</p>
                      <p className="text-sm text-ide-text-muted">{metadata.error}</p>
                      {file?.path && (
                        <div className="mt-4">
                          <p className="text-xs text-ide-text-muted mb-2">File Path:</p>
                          <code className="text-xs text-ide-text font-mono bg-ide-bg px-2 py-1 rounded">
                            {file.path}
                          </code>
                        </div>
                      )}
                    </div>
                  ) : metadata ? (
                    <div className="space-y-4">
                      {/* File Information Section */}
                      <div>
                        <h3 className="text-sm font-semibold text-ide-text mb-2">File Information</h3>
                        <div className="bg-ide-bg rounded-lg p-4 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-ide-text-muted">Name:</span>
                            <span className="text-ide-text">{file?.name || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-ide-text-muted">Type:</span>
                            <span className="text-ide-text">{metadata.type || file?.asset_type || 'Unknown'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-ide-text-muted">File Size:</span>
                            <span className="text-ide-text">{formatFileSize(metadata.size || file?.size || 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-ide-text-muted">Extension:</span>
                            <span className="text-ide-text">{file?.extension || 'N/A'}</span>
                          </div>
                          {metadata.features !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-ide-text-muted">Features:</span>
                              <span className="text-ide-text">{metadata.features}</span>
                            </div>
                          )}
                          {metadata.crs && (
                            <div className="flex justify-between">
                              <span className="text-ide-text-muted">CRS:</span>
                              <span className="text-ide-text">{metadata.crs}</span>
                            </div>
                          )}
                          {metadata.width && metadata.height && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-ide-text-muted">Width:</span>
                                <span className="text-ide-text">{metadata.width} px</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-ide-text-muted">Height:</span>
                                <span className="text-ide-text">{metadata.height} px</span>
                              </div>
                            </>
                          )}
                          {metadata.count && (
                            <div className="flex justify-between">
                              <span className="text-ide-text-muted">Bands:</span>
                              <span className="text-ide-text">{metadata.count}</span>
                            </div>
                          )}
                          {metadata.dtype && (
                            <div className="flex justify-between">
                              <span className="text-ide-text-muted">Data Type:</span>
                              <span className="text-ide-text">{metadata.dtype}</span>
                            </div>
                          )}
                          {(metadata.bbox || metadata.bounds) && (
                            <div className="mt-4 pt-4 border-t border-ide-border space-y-3">
                              <span className="text-ide-text-muted block mb-2 font-medium">Bounding Box / Extent:</span>
                              <div className="bg-ide-panel rounded p-3 font-mono text-xs text-ide-text space-y-1">
                                {metadata.bbox ? (
                                  <>
                                    <div>Min Longitude: {metadata.bbox[0]?.toFixed(6) || metadata.bbox[0]}</div>
                                    <div>Min Latitude: {metadata.bbox[1]?.toFixed(6) || metadata.bbox[1]}</div>
                                    <div>Max Longitude: {metadata.bbox[2]?.toFixed(6) || metadata.bbox[2]}</div>
                                    <div>Max Latitude: {metadata.bbox[3]?.toFixed(6) || metadata.bbox[3]}</div>
                                    <div className="mt-2 pt-2 border-t border-ide-border">
                                      [{metadata.bbox[0]?.toFixed(6) || metadata.bbox[0]}, {metadata.bbox[1]?.toFixed(6) || metadata.bbox[1]}, {metadata.bbox[2]?.toFixed(6) || metadata.bbox[2]}, {metadata.bbox[3]?.toFixed(6) || metadata.bbox[3]}]
                                    </div>
                                  </>
                                ) : metadata.bounds ? (
                                  <>
                                    <div>Min Longitude: {metadata.bounds.minx?.toFixed(6) || metadata.bounds.minx}</div>
                                    <div>Min Latitude: {metadata.bounds.miny?.toFixed(6) || metadata.bounds.miny}</div>
                                    <div>Max Longitude: {metadata.bounds.maxx?.toFixed(6) || metadata.bounds.maxx}</div>
                                    <div>Max Latitude: {metadata.bounds.maxy?.toFixed(6) || metadata.bounds.maxy}</div>
                                    <div className="mt-2 pt-2 border-t border-ide-border">
                                      [{metadata.bounds.minx?.toFixed(6) || metadata.bounds.minx}, {metadata.bounds.miny?.toFixed(6) || metadata.bounds.miny}, {metadata.bounds.maxx?.toFixed(6) || metadata.bounds.maxx}, {metadata.bounds.maxy?.toFixed(6) || metadata.bounds.maxy}]
                                    </div>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          )}
                          
                        </div>
                      </div>

                      {/* PostGIS Data Access (for GeoJSON stored in PostGIS) */}
                      {file?.is_geojson_in_postgis ? (
                        <div>
                          <h3 className="text-sm font-semibold text-ide-text mb-2">Data Access</h3>
                          <div className="bg-ide-bg rounded-lg p-4 space-y-3">
                            <p className="text-xs text-ide-text-muted">
                              This GeoJSON is stored in PostGIS. Access it directly using the helper functions below.
                            </p>
                            
                            {/* Access by Area Name */}
                            <div>
                              <label className="text-xs text-ide-text-muted mb-1 block">Access by Area Name (Recommended):</label>
                              <div className="flex items-start gap-2">
                                <code className="flex-1 text-xs text-ide-text font-mono bg-ide-panel px-3 py-2 rounded border border-ide-border whitespace-pre-wrap">
                                  {`# Helper function get_area_by_name() is automatically available\nimport geopandas as gpd\n\narea = get_area_by_name('${file?.name?.replace('.geojson', '').replace('.json', '') || 'area_name'}')\ngdf = gpd.GeoDataFrame([{'geometry': area.geom}], crs='EPSG:4326')`}
                                </code>
                                <button
                                  onClick={async () => {
                                    const areaName = file?.name?.replace('.geojson', '').replace('.json', '') || 'area_name'
                                    const pythonCode = `# Helper function get_area_by_name() is automatically available\nimport geopandas as gpd\n\narea = get_area_by_name('${areaName}')\ngdf = gpd.GeoDataFrame([{'geometry': area.geom}], crs='EPSG:4326')`
                                    
                                    try {
                                      await navigator.clipboard.writeText(pythonCode)
                                      setCopied(true)
                                      setTimeout(() => setCopied(false), 2000)
                                    } catch (err) {
                                      console.error('Failed to copy:', err)
                                    }
                                  }}
                                  className="p-2 hover:bg-ide-border rounded transition-colors text-ide-text-muted hover:text-ide-text flex-shrink-0 mt-0.5"
                                  title="Copy Python code"
                                >
                                  {copied ? (
                                    <Check className="w-4 h-4 text-green-400" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </div>
                            
                            {/* Access by Area ID */}
                            {file?.postgis_area_id && (
                              <div>
                                <label className="text-xs text-ide-text-muted mb-1 block">Access by Area ID:</label>
                                <div className="flex items-start gap-2">
                                  <code className="flex-1 text-xs text-ide-text font-mono bg-ide-panel px-3 py-2 rounded border border-ide-border whitespace-pre-wrap">
                                    {`# Helper function get_area_by_id() is automatically available\nimport geopandas as gpd\n\narea = get_area_by_id(${file.postgis_area_id})\ngdf = gpd.GeoDataFrame([{'geometry': area.geom}], crs='EPSG:4326')`}
                                  </code>
                                  <button
                                    onClick={async () => {
                                      const pythonCode = `# Helper function get_area_by_id() is automatically available\nimport geopandas as gpd\n\narea = get_area_by_id(${file.postgis_area_id})\ngdf = gpd.GeoDataFrame([{'geometry': area.geom}], crs='EPSG:4326')`
                                      
                                      try {
                                        await navigator.clipboard.writeText(pythonCode)
                                        setCopied(true)
                                        setTimeout(() => setCopied(false), 2000)
                                      } catch (err) {
                                        console.error('Failed to copy:', err)
                                      }
                                    }}
                                    className="p-2 hover:bg-ide-border rounded transition-colors text-ide-text-muted hover:text-ide-text flex-shrink-0 mt-0.5"
                                    title="Copy Python code"
                                  >
                                    {copied ? (
                                      <Check className="w-4 h-4 text-green-400" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                            
                            <p className="text-xs text-ide-text-muted mt-2">
                              Helper functions <code className="px-1 py-0.5 bg-ide-panel rounded text-xs">get_area_by_name()</code> and <code className="px-1 py-0.5 bg-ide-panel rounded text-xs">get_area_by_id()</code> are automatically available in your scripts. They return Area objects with a <code className="px-1 py-0.5 bg-ide-panel rounded text-xs">geom</code> attribute containing the geometry.
                            </p>
                          </div>
                        </div>
                      ) : (
                        /* File Path (for non-PostGIS files) */
                        <div>
                          <h3 className="text-sm font-semibold text-ide-text mb-2">File Path</h3>
                          <div className="bg-ide-bg rounded-lg p-4 space-y-3">
                            {/* Relative Path */}
                            <div>
                              <label className="text-xs text-ide-text-muted mb-1 block">Relative Path:</label>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 text-sm text-ide-text font-mono bg-ide-panel px-3 py-2 rounded border border-ide-border break-all">
                                  {file?.path || 'N/A'}
                                </code>
                                <button
                                  onClick={async () => {
                                    const pathToCopy = file?.path || ''
                                    try {
                                      await navigator.clipboard.writeText(pathToCopy)
                                      setCopied(true)
                                      setTimeout(() => setCopied(false), 2000)
                                    } catch (err) {
                                      console.error('Failed to copy:', err)
                                    }
                                  }}
                                  className="p-2 hover:bg-ide-border rounded transition-colors text-ide-text-muted hover:text-ide-text flex-shrink-0"
                                  title="Copy relative path"
                                >
                                  {copied ? (
                                    <Check className="w-4 h-4 text-green-400" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </div>
                            
                            {/* Python Usage Example - Helper Function */}
                            <div>
                              <label className="text-xs text-ide-text-muted mb-1 block">Python Usage (Recommended - Helper Function):</label>
                              <div className="flex items-start gap-2">
                                <code className="flex-1 text-xs text-ide-text font-mono bg-ide-panel px-3 py-2 rounded border border-ide-border whitespace-pre-wrap">
                                  {file?.path ? `# Helper function get_user_path() is automatically available\nfile_path = get_user_path('${file.path}')` : 'N/A'}
                                </code>
                                <button
                                  onClick={async () => {
                                    if (!file?.path) return
                                    const pythonCode = `# Helper function get_user_path() is automatically available\nfile_path = get_user_path('${file.path}')`
                                    
                                    try {
                                      await navigator.clipboard.writeText(pythonCode)
                                      setCopied(true)
                                      setTimeout(() => setCopied(false), 2000)
                                    } catch (err) {
                                      console.error('Failed to copy:', err)
                                    }
                                  }}
                                  className="p-2 hover:bg-ide-border rounded transition-colors text-ide-text-muted hover:text-ide-text flex-shrink-0 mt-0.5"
                                  title="Copy Python code"
                                >
                                  {copied ? (
                                    <Check className="w-4 h-4 text-green-400" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                              <p className="text-xs text-ide-text-muted mt-2">
                                The <code className="px-1 py-0.5 bg-ide-panel rounded text-xs">get_user_path()</code> helper function is automatically available in your scripts. For assets folder, use <code className="px-1 py-0.5 bg-ide-panel rounded text-xs">get_assets_path()</code>.
                              </p>
                            </div>
                            
                            {/* Alternative Manual Method */}
                            <div>
                              <label className="text-xs text-ide-text-muted mb-1 block">Alternative (Manual):</label>
                              <div className="flex items-start gap-2">
                                <code className="flex-1 text-xs text-ide-text font-mono bg-ide-panel px-3 py-2 rounded border border-ide-border whitespace-pre-wrap">
                                  {file?.path ? (() => {
                                    // Handle both username and user_X formats
                                    const pathWithoutPrefix = file.path.replace(/^(?:[^\/]+\/|user_\d+\/)/, '')
                                    const assetsRelativePath = file.path.includes('/assets/') 
                                      ? file.path.split('/assets/')[1] 
                                      : null
                                    const isInAssets = file.path.includes('/assets/')
                                    
                                    if (isInAssets && assetsRelativePath) {
                                      return `import os\nfile_path = os.path.join(os.getenv('USER_ASSETS_DIR'), '${assetsRelativePath}')`
                                    } else {
                                      return `import os\nfile_path = os.path.join(os.getenv('USER_MEDIA_DIR'), '${pathWithoutPrefix}')`
                                    }
                                  })() : 'N/A'}
                                </code>
                                <button
                                  onClick={async () => {
                                    if (!file?.path) return
                                    // Handle both username and user_X formats
                                    const pathWithoutPrefix = file.path.replace(/^(?:[^\/]+\/|user_\d+\/)/, '')
                                    const assetsRelativePath = file.path.includes('/assets/') 
                                      ? file.path.split('/assets/')[1] 
                                      : null
                                    const isInAssets = file.path.includes('/assets/')
                                    
                                    const pythonCode = isInAssets && assetsRelativePath
                                      ? `import os\nfile_path = os.path.join(os.getenv('USER_ASSETS_DIR'), '${assetsRelativePath}')`
                                      : `import os\nfile_path = os.path.join(os.getenv('USER_MEDIA_DIR'), '${pathWithoutPrefix}')`
                                    
                                    try {
                                      await navigator.clipboard.writeText(pythonCode)
                                      setCopied(true)
                                      setTimeout(() => setCopied(false), 2000)
                                    } catch (err) {
                                      console.error('Failed to copy:', err)
                                    }
                                  }}
                                  className="p-2 hover:bg-ide-border rounded transition-colors text-ide-text-muted hover:text-ide-text flex-shrink-0 mt-0.5"
                                  title="Copy Python code"
                                >
                                  {copied ? (
                                    <Check className="w-4 h-4 text-green-400" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Fallback: Show basic file info even without metadata */}
                      <div>
                        <h3 className="text-sm font-semibold text-ide-text mb-2">File Information</h3>
                        <div className="bg-ide-bg rounded-lg p-4 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-ide-text-muted">Name:</span>
                            <span className="text-ide-text">{file?.name || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-ide-text-muted">Type:</span>
                            <span className="text-ide-text">{file?.asset_type || file?.extension || 'Unknown'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-ide-text-muted">File Size:</span>
                            <span className="text-ide-text">{formatFileSize(file?.size || 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-ide-text-muted">Extension:</span>
                            <span className="text-ide-text">{file?.extension || 'N/A'}</span>
                          </div>
            
                        </div>
                      </div>
                      
                      {/* File Path Section */}
                      <div>
                        <h3 className="text-sm font-semibold text-ide-text mb-2">File Path</h3>
                        <div className="bg-ide-bg rounded-lg p-4 space-y-3">
                          {/* Relative Path */}
                          <div>
                            <label className="text-xs text-ide-text-muted mb-1 block">Relative Path:</label>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 text-sm text-ide-text font-mono bg-ide-panel px-3 py-2 rounded border border-ide-border break-all">
                                {file?.path || 'N/A'}
                              </code>
                              <button
                                onClick={async () => {
                                  const pathToCopy = file?.path || ''
                                  try {
                                    await navigator.clipboard.writeText(pathToCopy)
                                    setCopied(true)
                                    setTimeout(() => setCopied(false), 2000)
                                  } catch (err) {
                                    console.error('Failed to copy:', err)
                                  }
                                }}
                                className="p-2 hover:bg-ide-border rounded transition-colors text-ide-text-muted hover:text-ide-text flex-shrink-0"
                                title="Copy relative path"
                              >
                                {copied ? (
                                  <Check className="w-4 h-4 text-green-400" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-center text-ide-text-muted text-sm py-4">
                        <p>Metadata is being loaded or not available for this file.</p>
                        {file?.metadata && Object.keys(file.metadata).length === 0 && (
                          <p className="text-xs mt-2">Metadata object exists but is empty.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Map Tab - Show for GeoJSON files or files with bounds */}
              {activeTab === 'map' && (isGeoJSON || (metadata && (metadata.bbox || metadata.bounds))) && (
                <div 
                  ref={mapContainerRef} 
                  className="absolute inset-0 w-full h-full"
                  style={{ minHeight: '400px', backgroundColor: '#f3f4f6' }}
                />
              )}

              {/* Raw Data Tab */}
              {activeTab === 'data' && (
                <div className="absolute inset-0 p-6 overflow-y-auto">
                  {fileData && fileData.type === 'FeatureCollection' && fileData.features ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-ide-text">
                          Feature Attributes (Showing first 10 of {fileData.features.length})
                        </h3>
                      </div>
                      
                      {/* Attributes Table */}
                      <div className="bg-ide-bg rounded-lg overflow-hidden border border-ide-border">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-ide-border bg-ide-panel">
                                {fileData.features.length > 0 && fileData.features[0].properties ? (
                                  Object.keys(fileData.features[0].properties).map((key) => (
                                    <th
                                      key={key}
                                      className="px-3 py-2 text-left text-ide-text-muted font-medium"
                                    >
                                      {key}
                                    </th>
                                  ))
                                ) : (
                                  <th className="px-3 py-2 text-left text-ide-text-muted font-medium">
                                    No properties
                                  </th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {fileData.features.slice(0, 10).map((feature, idx) => (
                                <tr
                                  key={idx}
                                  className="border-b border-ide-border/50 hover:bg-ide-panel/50 transition-colors"
                                >
                                  {feature.properties ? (
                                    Object.values(feature.properties).map((value, propIdx) => (
                                      <td
                                        key={propIdx}
                                        className="px-3 py-2 text-ide-text"
                                      >
                                        {typeof value === 'object' ? (
                                          <span className="text-ide-text-muted italic">
                                            {JSON.stringify(value)}
                                          </span>
                                        ) : (
                                          String(value)
                                        )}
                                      </td>
                                    ))
                                  ) : (
                                    <td className="px-3 py-2 text-ide-text-muted italic">
                                      No properties
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Raw JSON Toggle */}
                      <details className="bg-ide-bg rounded-lg border border-ide-border">
                        <summary className="px-4 py-2 cursor-pointer text-sm font-medium text-ide-text hover:bg-ide-panel/50 transition-colors">
                          View Raw JSON
                        </summary>
                        <div className="p-4 border-t border-ide-border">
                          <pre className="text-xs text-ide-text overflow-auto font-mono max-h-96">
                            {JSON.stringify(fileData, null, 2)}
                          </pre>
                        </div>
                      </details>
                    </div>
                  ) : fileData && fileData.type === 'Feature' && fileData.properties ? (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold text-ide-text mb-2">Feature Properties</h3>
                        <div className="bg-ide-bg rounded-lg p-4 border border-ide-border">
                          <div className="space-y-2">
                            {Object.entries(fileData.properties).map(([key, value]) => (
                              <div key={key} className="flex justify-between border-b border-ide-border/30 pb-2 last:border-0">
                                <span className="text-ide-text-muted font-medium">{key}:</span>
                                <span className="text-ide-text">
                                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <details className="bg-ide-bg rounded-lg border border-ide-border">
                        <summary className="px-4 py-2 cursor-pointer text-sm font-medium text-ide-text hover:bg-ide-panel/50 transition-colors">
                          View Raw JSON
                        </summary>
                        <div className="p-4 border-t border-ide-border">
                          <pre className="text-xs text-ide-text overflow-auto font-mono max-h-96">
                            {JSON.stringify(fileData, null, 2)}
                          </pre>
                        </div>
                      </details>
                    </div>
                  ) : (
                    <pre className="bg-ide-bg rounded-lg p-4 text-xs text-ide-text overflow-auto font-mono">
                      {JSON.stringify(fileData, null, 2)}
                    </pre>
                  )}
                </div>
              )}

              {/* Default view for non-GeoJSON files */}
              {!isGeoJSON && fileData && (
                <div className="absolute inset-0 p-6 overflow-y-auto">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-ide-text mb-2">File Content</h3>
                    <pre className="bg-ide-bg rounded-lg p-4 text-xs text-ide-text overflow-auto font-mono">
                      {fileData.content || JSON.stringify(fileData, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}
