import React, { useState, useEffect } from 'react'
import LeftPanel from '../components/LeftPanel'
import CenterPanel from '../components/CenterPanel'
import RightPanel from '../components/RightPanel'
import Navbar from '../components/Navbar'
import ResizableSplitter from '../components/ResizableSplitter'
import ConfirmationModal from '../components/ConfirmationModal'
import { ToastProvider } from '@radix-ui/react-toast'
import { Toaster } from '../components/Toaster'
import { useScripts } from '../hooks/useScripts'
import { useCodeExecution } from '../hooks/useCodeExecution'
import { useToast } from '../hooks/useToast'

export default function Dashboard({ user, theme, onThemeToggle, onLogout }) {
  // Use custom hooks for data management
  const {
    scripts,
    isLoading: isLoadingScripts,
    loadScripts,
    createScript,
    updateScript,
    deleteScript,
  } = useScripts()

  const {
    isExecuting,
    output: executionOutput,
    executeCode: executeCodeHook,
    stopExecution,
    clearOutput,
  } = useCodeExecution()

  const [assets] = useState([
    { id: '1', name: 'Landsat 8 Collection', type: 'ImageCollection', path: 'LANDSAT/LC08/C01/T1_SR' },
    { id: '2', name: 'US States', type: 'FeatureCollection', path: 'TIGER/2018/States' },
    { id: '3', name: 'SRTM DEM', type: 'Image', path: 'USGS/SRTMGL1_003' },
  ])
  const [activeScriptId, setActiveScriptId] = useState(null)
  const [layers, setLayers] = useState([])
  const [fitBounds, setFitBounds] = useState(null)
  const [inspectorData, setInspectorData] = useState(null)
  const [tasks, setTasks] = useState([])
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ isOpen: false, scriptId: null, scriptName: '' })
  const toast = useToast()

  const activeScript = scripts.find(s => s.id === activeScriptId)

  // Set first script as active when scripts load
  useEffect(() => {
    if (scripts.length > 0 && !activeScriptId) {
      setActiveScriptId(scripts[0].id)
    }
  }, [scripts, activeScriptId])

  const handleRunScript = async (code) => {
    try {
      await executeCodeHook(code)
    } catch (error) {
      console.error('Error executing code:', error)
    }
  }

  const handleStopScript = () => {
    stopExecution()
  }

  // Sync execution output to console logs
  useEffect(() => {
    if (executionOutput && executionOutput.length > 0) {
      // Output is already formatted by the hook
    }
  }, [executionOutput])

  const handleUpdateScript = (id, code) => {
    // Update local state immediately for UI responsiveness
    // Backend sync happens on save
  }

  const handleCreateScript = async (scriptName) => {
    try {
      // Create blank script immediately
      await createScript(scriptName, '')
      // Reload scripts to get the new one (createScript already calls loadScripts internally)
      // Wait a bit for state to update, then find the new script
      setTimeout(() => {
        const newScript = scripts.find(s => s.name === scriptName)
        if (newScript) {
          setActiveScriptId(newScript.id)
        } else if (scripts.length > 0) {
          // Fallback to first script if name match fails
          setActiveScriptId(scripts[0].id)
        }
      }, 100)
      toast.success('Script created', `"${scriptName}" has been created successfully`)
    } catch (error) {
      console.error('Error creating script:', error)
      toast.error('Create failed', error.message || 'Failed to create script')
    }
  }

  const handleDeleteScript = (id) => {
    const script = scripts.find(s => s.id === id)
    if (script) {
      setDeleteConfirmModal({
        isOpen: true,
        scriptId: id,
        scriptName: script.name || 'Untitled Script'
      })
    }
  }

  const confirmDeleteScript = async () => {
    const { scriptId } = deleteConfirmModal
    if (!scriptId) return

    try {
      await deleteScript(scriptId)
      
      // Update active script if needed
      if (activeScriptId === scriptId) {
        const remaining = scripts.filter(s => s.id !== scriptId)
        setActiveScriptId(remaining.length > 0 ? remaining[0].id : null)
      }
      
      toast.success('Script deleted', `"${deleteConfirmModal.scriptName}" has been deleted successfully`)
      setDeleteConfirmModal({ isOpen: false, scriptId: null, scriptName: '' })
    } catch (error) {
      console.error('Error deleting script:', error)
      toast.error('Delete failed', error.message || 'Failed to delete script')
      setDeleteConfirmModal({ isOpen: false, scriptId: null, scriptName: '' })
    }
  }

  const handleRenameScript = async (id, newName) => {
    const script = scripts.find(s => s.id === id)
    if (script) {
      try {
        await updateScript(id, newName, script.code, '')
        await loadScripts()
        toast.success('Script renamed', `Script has been renamed to "${newName}"`)
      } catch (error) {
        console.error('Error renaming script:', error)
        toast.error('Rename failed', error.message || 'Failed to rename script')
      }
    }
  }

  const handleScriptSettingsUpdate = async (updatedScriptData) => {
    // Reload scripts to sync with backend
    await loadScripts()
  }

  const handleSaveScript = async (scriptWithCode) => {
    if (!scriptWithCode || !scriptWithCode.id) {
      console.warn('Invalid script data for saving:', scriptWithCode)
      toast.warning('Save failed', 'Invalid script data')
      return
    }
    
    try {
      const currentScript = scripts.find(s => s.id === scriptWithCode.id)
      if (!currentScript) {
        console.warn('Script not found in scripts list:', scriptWithCode.id, 'Available scripts:', scripts.map(s => s.id))
        toast.error('Save failed', 'Script not found')
        return
      }
      
      // Use the code from the parameter (current editor content)
      const scriptCode = scriptWithCode.code !== undefined ? scriptWithCode.code : ''
      const scriptName = currentScript.name
      
      console.log('Saving script:', { 
        id: scriptWithCode.id, 
        backendId: currentScript.backendId,
        name: scriptName, 
        codeLength: scriptCode.length,
        codePreview: scriptCode.substring(0, 50)
      })
      
      // Update script with current code
      await updateScript(scriptWithCode.id, scriptName, scriptCode, '')
      
      // Reload scripts to ensure sync
      await loadScripts()
      
      toast.success('Script saved', `"${scriptName}" has been saved successfully`)
    } catch (error) {
      console.error('Error saving script:', error)
      toast.error('Save failed', error.message || 'Failed to save script')
      throw error // Re-throw so UI can show error
    }
  }

  const handleToggleLayer = (layerId) => {
    setLayers(layers.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l))
  }

  const handleDeleteLayer = (layerId) => {
    setLayers(layers.filter(l => l.id !== layerId))
  }

  const handleUpdateLayerOpacity = (layerId, opacity) => {
    setLayers(layers.map(l => l.id === layerId ? { ...l, opacity } : l))
  }

  const handleAddLayer = (layer) => {
    setLayers([...layers, layer])
  }
  
  const handleFitBounds = (bounds) => {
    setFitBounds(bounds)
    // Clear after a short delay to allow re-triggering
    setTimeout(() => setFitBounds(null), 100)
  }

  const [assetsRefreshTrigger, setAssetsRefreshTrigger] = useState(0)

  const handleAreaSaved = () => {
    // Trigger assets refresh
    setAssetsRefreshTrigger(prev => prev + 1)
  }

  return (
    <ToastProvider>
      <div className="flex flex-col h-screen bg-ide-bg text-ide-text overflow-hidden">
        <Navbar theme={theme} onThemeToggle={onThemeToggle} user={user} onLogout={onLogout} />
        <div className="flex-1 flex min-h-0">
          <ResizableSplitter direction="horizontal" defaultSize={20} minSize={15} maxSize={35}>
            {/* Left Panel */}
            <div className="h-full border-r border-ide-border">
              <LeftPanel
                scripts={scripts}
                assets={assets}
                activeScriptId={activeScriptId}
                onSelectScript={setActiveScriptId}
                onCreateScript={handleCreateScript}
                onDeleteScript={handleDeleteScript}
                onRenameScript={handleRenameScript}
                onUpdateScript={handleScriptSettingsUpdate}
                onAddLayer={handleAddLayer}
                onFitBounds={handleFitBounds}
              />
            </div>

            {/* Center and Right Panels */}
            <ResizableSplitter direction="horizontal" defaultSize={70} minSize={40} maxSize={85}>
              {/* Center Panel */}
              <div className="h-full flex flex-col min-w-0">
                <CenterPanel
                  script={activeScript}
                  onUpdateScript={handleUpdateScript}
                  onRunScript={handleRunScript}
                  onStopScript={handleStopScript}
                  onSaveScript={(scriptWithCode) => handleSaveScript(scriptWithCode)}
                  consoleLogs={executionOutput || []}
                  jobStatus={isExecuting ? 'running' : null}
                  layers={layers}
                  onMapClick={(data) => setInspectorData(data)}
                  fitBounds={fitBounds}
                  onAreaSaved={handleAreaSaved}
                />
              </div>

              {/* Right Panel */}
              <div className="h-full border-l border-ide-border flex flex-col">
                <RightPanel
                  consoleLogs={executionOutput || []}
                  inspectorData={inspectorData}
                  tasks={tasks}
                />
              </div>
            </ResizableSplitter>
          </ResizableSplitter>
        </div>
      </div>
      <Toaster />
      
      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmModal.isOpen}
        onClose={() => setDeleteConfirmModal({ isOpen: false, scriptId: null, scriptName: '' })}
        onConfirm={confirmDeleteScript}
        title="Delete Script"
        message={`Are you sure you want to delete "${deleteConfirmModal.scriptName}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </ToastProvider>
  )
}
