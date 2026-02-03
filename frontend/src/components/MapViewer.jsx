import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Map, View } from 'ol'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import OSM from 'ol/source/OSM'
import XYZ from 'ol/source/XYZ'
import { fromLonLat, toLonLat } from 'ol/proj'
import Draw from 'ol/interaction/Draw'
import GeoJSON from 'ol/format/GeoJSON'
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style'
import Polygon from 'ol/geom/Polygon'
import Circle from 'ol/geom/Circle'
import Feature from 'ol/Feature'
import 'ol/ol.css'
import { Maximize2, Minimize2, Square, Hexagon, MapPin, Minus, Satellite, Map as MapIcon, ZoomIn, ZoomOut, Trash2, Save } from 'lucide-react'

export default function MapViewer({ layers, onMapClick, onBoundaryDraw, onClearRef, fitBounds, boundaryGeoJSON, onSaveBoundary }) {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const drawInteractionRef = useRef(null)
  const vectorSourceRef = useRef(null)
  const streetLayerRef = useRef(null)
  const satelliteLayerRef = useRef(null)
  const uploadedLayersRef = useRef(new Map()) // Store uploaded GeoJSON layers
  const extentLayerRef = useRef(null) // Store extent visualization layer
  const [mapLoaded, setMapLoaded] = useState(false)
  const [activeTool, setActiveTool] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [basemapType, setBasemapType] = useState('street') // 'street' or 'satellite'
  
  // Expose map instance for external use
  useEffect(() => {
    if (map.current && typeof window !== 'undefined') {
      window.mapInstance = map.current
    }
  }, [mapLoaded])
  
  // Handle fitBounds prop changes
  useEffect(() => {
    if (!map.current || !fitBounds || !Array.isArray(fitBounds) || fitBounds.length !== 4) return
    
    const [minLon, minLat, maxLon, maxLat] = fitBounds
    const minCoord = fromLonLat([minLon, minLat])
    const maxCoord = fromLonLat([maxLon, maxLat])
    const extent = [
      Math.min(minCoord[0], maxCoord[0]),
      Math.min(minCoord[1], maxCoord[1]),
      Math.max(minCoord[0], maxCoord[0]),
      Math.max(minCoord[1], maxCoord[1])
    ]
    
    // Fit map to bounds
    map.current.getView().fit(extent, {
      padding: [50, 50, 50, 50],
      duration: 1000
    })
    
    // Remove existing extent layer if present
    if (extentLayerRef.current) {
      map.current.removeLayer(extentLayerRef.current)
      extentLayerRef.current = null
    }
    
    // Add extent visualization rectangle
    const extentSource = new VectorSource()
    const extentPolygon = new Polygon([[
      fromLonLat([minLon, minLat]),
      fromLonLat([maxLon, minLat]),
      fromLonLat([maxLon, maxLat]),
      fromLonLat([minLon, maxLat]),
      fromLonLat([minLon, minLat])
    ]])
    
    extentSource.addFeature(new Feature({ geometry: extentPolygon }))
    
    const extentLayer = new VectorLayer({
      source: extentSource,
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
    })
    
    extentLayerRef.current = extentLayer
    map.current.addLayer(extentLayer)
    
    // Cleanup function
    return () => {
      if (extentLayerRef.current && map.current) {
        map.current.removeLayer(extentLayerRef.current)
        extentLayerRef.current = null
      }
    }
  }, [fitBounds])

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    // Create street map layer (OSM)
    const streetLayer = new TileLayer({
      source: new OSM(),
      visible: true
    })
    streetLayerRef.current = streetLayer

    // Create satellite layer
    const satelliteLayer = new TileLayer({
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attributions: '© Esri'
      }),
      visible: false
    })
    satelliteLayerRef.current = satelliteLayer

    // Create vector source for drawings
    const vectorSource = new VectorSource()
    vectorSourceRef.current = vectorSource

    // Create vector layer for drawings
    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: new Style({
        fill: new Fill({
          color: 'rgba(0, 123, 204, 0.2)'
        }),
        stroke: new Stroke({
          color: '#007acc',
          width: 2
        }),
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({
            color: '#007acc'
          }),
          stroke: new Stroke({
            color: '#fff',
            width: 2
          })
        })
      })
    })
    // Mark drawing layer so we don't remove it
    vectorLayer.set('isDrawingLayer', true)

    // Create map
    map.current = new Map({
      target: mapContainer.current,
      layers: [streetLayer, satelliteLayer, vectorLayer],
      view: new View({
        center: fromLonLat([-122.4194, 37.7749]), // San Francisco
        zoom: 10
      }),
      controls: [] // Remove default controls, we'll use custom ones
    })

    // Fullscreen is handled by custom button, no need for OpenLayers control

    // Listen to fullscreen changes
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    // Handle map click (only when not drawing)
    map.current.on('click', (e) => {
      if (!activeTool) {
        const [lng, lat] = toLonLat(e.coordinate)
        onMapClick({
          coordinates: [lng, lat],
          timestamp: new Date()
        })
      }
    })

    setMapLoaded(true)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      if (map.current) {
        map.current.setTarget(null)
        map.current = null
      }
    }
  }, [])

  const handleToolClick = (toolType) => {
    if (!map.current) return

    // Remove existing draw interaction
    if (drawInteractionRef.current) {
      map.current.removeInteraction(drawInteractionRef.current)
      drawInteractionRef.current = null
    }

    // If clicking the same tool, deactivate it
    if (activeTool === toolType) {
      setActiveTool(null)
      return
    }

    // Create new draw interaction based on tool type
    let geometryType
    let geometryFunction = undefined
    
    if (toolType === 'rectangle') {
      // Use Circle with geometryFunction to create a box
      geometryType = 'Circle'
      let rectangleStart = null
      geometryFunction = (coordinates, geometry) => {
        if (!geometry) {
          geometry = new Circle(coordinates[0], 0)
          rectangleStart = coordinates[0]
        }
        if (coordinates.length >= 2 && rectangleStart) {
          const start = rectangleStart
          const end = coordinates[coordinates.length - 1]
          // Calculate box dimensions - use the actual width and height
          const dx = Math.abs(end[0] - start[0])
          const dy = Math.abs(end[1] - start[1])
          // Use the larger dimension for radius to create a square that encompasses the box
          const radius = Math.max(dx, dy) / 2
          const center = [
            (start[0] + end[0]) / 2,
            (start[1] + end[1]) / 2
          ]
          geometry.setCenterAndRadius(center, radius)
        }
        return geometry
      }
    } else {
      switch (toolType) {
        case 'polygon':
          geometryType = 'Polygon'
          break
        case 'line':
          geometryType = 'LineString'
          break
        case 'marker':
          geometryType = 'Point'
          break
        default:
          return
      }
    }

    const drawOptions = {
      source: vectorSourceRef.current,
      type: geometryType,
      style: new Style({
        fill: new Fill({
          color: 'rgba(0, 123, 204, 0.2)'
        }),
        stroke: new Stroke({
          color: '#007acc',
          width: 2,
          lineDash: toolType === 'line' ? [5, 5] : undefined
        }),
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({
            color: '#007acc'
          }),
          stroke: new Stroke({
            color: '#fff',
            width: 2
          })
        })
      })
    }

    if (geometryFunction) {
      drawOptions.geometryFunction = geometryFunction
    }

    const draw = new Draw(drawOptions)

    // Handle rectangle drawing - convert circle to rectangle polygon
    if (toolType === 'rectangle') {
      let rectStart = null
      draw.on('drawstart', (e) => {
        rectStart = e.coordinate
        rectangleStartRef.current = e.coordinate
      })
      
      draw.on('drawend', (e) => {
        const geometry = e.feature.getGeometry()
        if (geometry.getType() === 'Circle' && rectStart) {
          // Get the extent of the circle
          const extent = geometry.getExtent()
          const minX = extent[0]
          const minY = extent[1]
          const maxX = extent[2]
          const maxY = extent[3]
          
          // But we want to use the actual start and end from the draw
          // The circle's center and radius give us the bounding box
          // But we need the actual rectangle from start to end
          const center = geometry.getCenter()
          const radius = geometry.getRadius()
          
          // Calculate actual rectangle corners from start point
          // The circle is drawn from start, so calculate the opposite corner
          const start = rectStart
          const dx = (center[0] - start[0]) * 2
          const dy = (center[1] - start[1]) * 2
          const end = [start[0] + dx, start[1] + dy]
          
          // Create rectangle from actual start and end coordinates
          const minX2 = Math.min(start[0], end[0])
          const maxX2 = Math.max(start[0], end[0])
          const minY2 = Math.min(start[1], end[1])
          const maxY2 = Math.max(start[1], end[1])
          
          // Create rectangle polygon
          const rectangle = new Polygon([
            [
              [minX2, minY2],
              [maxX2, minY2],
              [maxX2, maxY2],
              [minX2, maxY2],
              [minX2, minY2]
            ]
          ])
          e.feature.setGeometry(rectangle)
          rectangleStartRef.current = null
        }
      })
    }

    // Convert drawn feature to GeoJSON for all drawing types
    // Use setTimeout to ensure rectangle conversion happens first
    draw.on('drawend', (e) => {
      console.log('Draw end event fired', { hasFeature: !!e.feature, hasCallback: !!onBoundaryDraw })
      
      if (!e.feature) {
        console.warn('No feature in drawend event')
        return
      }
      
      if (!onBoundaryDraw) {
        console.warn('onBoundaryDraw callback not provided')
        return
      }
      
      // Small delay to ensure rectangle conversion completes
      setTimeout(() => {
        try {
          const geojsonFormat = new GeoJSON()
          const geojson = geojsonFormat.writeFeature(e.feature, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857'
          })
          
          console.log('Raw GeoJSON string:', geojson)
          
          const geojsonObj = JSON.parse(geojson)
          // Wrap in FeatureCollection format
          const featureCollection = {
            type: 'FeatureCollection',
            features: [geojsonObj]
          }
          console.log('Boundary drawn, sending GeoJSON:', featureCollection)
          onBoundaryDraw(featureCollection)
        } catch (error) {
          console.error('Error converting feature to GeoJSON:', error, e.feature)
        }
      }, 100)
      
      // Keep tool active for multiple drawings
      // setActiveTool(null)
    })

    map.current.addInteraction(draw)
    drawInteractionRef.current = draw
    setActiveTool(toolType)
  }

  const handleFullscreen = () => {
    if (!mapContainer.current?.parentElement) return

    if (!document.fullscreenElement) {
      mapContainer.current.parentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  const clearDrawings = useCallback(() => {
    if (vectorSourceRef.current) {
      vectorSourceRef.current.clear()
    }
    if (drawInteractionRef.current) {
      map.current?.removeInteraction(drawInteractionRef.current)
      drawInteractionRef.current = null
    }
    setActiveTool(null)
    // Notify parent that drawings are cleared
    if (onBoundaryDraw) {
      onBoundaryDraw(null)
    }
  }, [onBoundaryDraw])

  // Expose clearDrawings function via ref callback
  useEffect(() => {
    if (onClearRef) {
      onClearRef(clearDrawings)
    }
  }, [onClearRef, clearDrawings])

  const handleZoomIn = () => {
    if (map.current) {
      const view = map.current.getView()
      const zoom = view.getZoom()
      view.animate({ zoom: zoom + 1, duration: 200 })
    }
  }

  const handleZoomOut = () => {
    if (map.current) {
      const view = map.current.getView()
      const zoom = view.getZoom()
      view.animate({ zoom: zoom - 1, duration: 200 })
    }
  }

  // Handle basemap toggle
  useEffect(() => {
    if (!map.current || !mapLoaded || !streetLayerRef.current || !satelliteLayerRef.current) return

    if (basemapType === 'satellite') {
      streetLayerRef.current.setVisible(false)
      satelliteLayerRef.current.setVisible(true)
    } else {
      streetLayerRef.current.setVisible(true)
      satelliteLayerRef.current.setVisible(false)
    }
  }, [basemapType, mapLoaded])

  useEffect(() => {
    if (!map.current || !mapLoaded) return

    // Remove layers that are no longer in the layers array
    const currentLayerIds = new Set(layers.map(l => l.id))
    const layersToRemove = []
    map.current.getLayers().forEach((layer) => {
      // Keep base layers and drawing layer
      if (layer === streetLayerRef.current || 
          layer === satelliteLayerRef.current || 
          layer.get('isDrawingLayer') === true) {
        return
      }
      
      // Check if this is an uploaded layer that should be removed
      const layerId = layer.get('layerId')
      if (layerId && !currentLayerIds.has(layerId)) {
        layersToRemove.push(layer)
        uploadedLayersRef.current.delete(layerId)
      }
    })
    layersToRemove.forEach(layer => {
      map.current.removeLayer(layer)
    })

    // Add or update layers
    layers.forEach((layer) => {
      if (layer.type === 'raster') {
        // Raster layers are handled separately if needed
        // For now, skip as they're not in the current implementation
      } else if (layer.type === 'vector' && layer.geojson) {
        // Handle GeoJSON vector layers
        const existingLayer = uploadedLayersRef.current.get(layer.id)
        
        if (existingLayer) {
          // Update existing layer visibility and opacity
          existingLayer.setVisible(layer.visible !== false)
          existingLayer.setOpacity(layer.opacity !== undefined ? layer.opacity : 0.7)
        } else {
          // Create new vector layer
          const geojsonFormat = new GeoJSON()
          
          // Handle both FeatureCollection and Feature
          let geojsonData = layer.geojson
          if (geojsonData.type === 'Feature') {
            geojsonData = {
              type: 'FeatureCollection',
              features: [geojsonData]
            }
          }
          
          const vectorSource = new VectorSource({
            features: geojsonFormat.readFeatures(geojsonData, {
              dataProjection: 'EPSG:4326',
              featureProjection: 'EPSG:3857'
            })
          })
          
          const vectorLayer = new VectorLayer({
            source: vectorSource,
            visible: layer.visible !== false,
            opacity: layer.opacity !== undefined ? layer.opacity : 0.7,
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
          
          // Store layer reference
          vectorLayer.set('layerId', layer.id)
          uploadedLayersRef.current.set(layer.id, vectorLayer)
          map.current.addLayer(vectorLayer)
          
          // Fit map to features
          if (vectorSource.getFeatures().length > 0) {
            const extent = vectorSource.getExtent()
            map.current.getView().fit(extent, {
              padding: [50, 50, 50, 50],
              duration: 1000
            })
          }
        }
      }
    })
  }, [layers, mapLoaded])

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Left Side Controls - Zoom and Drawing Tools */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        {/* Zoom Controls */}
        <div className="bg-ide-panel border border-ide-border rounded shadow-lg p-0.5 flex flex-col gap-0.5 w-[32px]">
          <button
            onClick={handleZoomIn}
            className="p-1 rounded transition-colors bg-transparent text-ide-text-muted hover:bg-ide-bg hover:text-ide-text w-full h-[28px] flex items-center justify-center min-w-0"
            title="Zoom In"
          >
            <ZoomIn className="w-3 h-3 flex-shrink-0" />
          </button>
          <div className="h-px bg-ide-border my-0.5" />
          <button
            onClick={handleZoomOut}
            className="p-1 rounded transition-colors bg-transparent text-ide-text-muted hover:bg-ide-bg hover:text-ide-text w-full h-[28px] flex items-center justify-center min-w-0"
            title="Zoom Out"
          >
            <ZoomOut className="w-3 h-3 flex-shrink-0" />
          </button>
        </div>

        {/* Fullscreen Button */}
        <div className="bg-ide-panel border border-ide-border rounded shadow-lg p-0.5 w-[32px]">
          <button
            onClick={handleFullscreen}
            className="p-1 rounded transition-colors bg-transparent text-ide-text-muted hover:bg-ide-bg hover:text-ide-text w-full h-[28px] flex items-center justify-center min-w-0"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3 h-3 flex-shrink-0" />
            ) : (
              <Maximize2 className="w-3 h-3 flex-shrink-0" />
            )}
          </button>
        </div>

        {/* Drawing Tools */}
        <div className="bg-ide-panel border border-ide-border rounded shadow-lg p-0.5 flex flex-col gap-0.5 w-[32px]">
          <button
            onClick={() => handleToolClick('marker')}
            className={`p-1 rounded transition-colors w-full h-[28px] flex items-center justify-center min-w-0 ${
              activeTool === 'marker'
                ? 'bg-ide-accent text-white'
                : 'bg-transparent text-ide-text-muted hover:bg-ide-bg hover:text-ide-text'
            }`}
            title="Draw Marker"
          >
            <i className="fg-poi text-sm" />
          </button>
          <button
            onClick={() => handleToolClick('line')}
            className={`p-1 rounded transition-colors w-full h-[28px] flex items-center justify-center min-w-0 ${
              activeTool === 'line'
                ? 'bg-ide-accent text-white'
                : 'bg-transparent text-ide-text-muted hover:bg-ide-bg hover:text-ide-text'
            }`}
            title="Draw Line"
          >
            <i className="fg-polyline-pt text-sm" />
          </button>
          {/* <button
            onClick={() => handleToolClick('rectangle')}
            className={`p-1 rounded transition-colors w-full h-[28px] flex items-center justify-center min-w-0 ${
              activeTool === 'rectangle'
                ? 'bg-ide-accent text-white'
                : 'bg-transparent text-ide-text-muted hover:bg-ide-bg hover:text-ide-text'
            }`}
            title="Draw Rectangle"
          >
            <i className="fg-rectangle-pt text-sm" />
          </button> */}
          <button
            onClick={() => handleToolClick('polygon')}
            className={`p-1 rounded transition-colors w-full h-[28px] flex items-center justify-center min-w-0 ${
              activeTool === 'polygon'
                ? 'bg-ide-accent text-white'
                : 'bg-transparent text-ide-text-muted hover:bg-ide-bg hover:text-ide-text'
            }`}
            title="Draw Polygon"
          >
            <i className="fg-polygon-pt text-sm" />
          </button>
        </div>
        
        {/* Clear All Button - only show when drawing */}
        {activeTool && (
          <div className="bg-ide-panel border border-ide-border rounded shadow-lg p-0.5 w-[32px]">
            <button
              onClick={clearDrawings}
              className="p-1 rounded transition-colors bg-transparent text-ide-text-muted hover:bg-red-500/20 hover:text-red-400 w-full h-[28px] flex items-center justify-center min-w-0"
              title="Clear All Drawings"
            >
              <Trash2 className="w-3 h-3 flex-shrink-0" />
            </button>
          </div>
        )}
      </div>

      {/* Right Side - Basemap Options */}
      <div className="absolute top-4 right-4 z-10">
        <div className="bg-ide-panel border border-ide-border rounded shadow-lg p-1 flex gap-0.5">
          <button
            onClick={() => setBasemapType('street')}
            className={`p-1.5 rounded transition-colors flex items-center gap-1.5 ${
              basemapType === 'street'
                ? 'bg-ide-accent text-white'
                : 'bg-transparent text-ide-text-muted hover:bg-ide-bg hover:text-ide-text'
            }`}
            title="Street Map"
          >
            <span className="text-xs">Street</span>
          </button>
          <div className="w-px bg-ide-border" />
          <button
            onClick={() => setBasemapType('satellite')}
            className={`p-1.5 rounded transition-colors flex items-center gap-1.5 ${
              basemapType === 'satellite'
                ? 'bg-ide-accent text-white'
                : 'bg-transparent text-ide-text-muted hover:bg-ide-bg hover:text-ide-text'
            }`}
            title="Satellite"
          >

            <span className="text-xs">Satellite</span>
          </button>
        </div>
      </div>

      {/* Bottom Center - Save Area Button - only show when boundary is drawn */}
      {boundaryGeoJSON && onSaveBoundary && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
          <button
            onClick={onSaveBoundary}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg shadow-lg flex items-center gap-2 transition-colors font-medium"
            title="Save Area"
          >
            <Save className="w-4 h-4" />
            <span>Save Area</span>
          </button>
        </div>
      )}
    </div>
  )
}
