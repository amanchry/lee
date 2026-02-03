import React, { useState, useEffect, useRef } from 'react'
import { Play, Square, Loader2, Save, Copy, Check, X } from 'lucide-react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import ResizableSplitter from './ResizableSplitter'
import MapViewer from './MapViewer'
import Editor from '@monaco-editor/react'
import AreaNameModal from './AreaNameModal'
import { api } from '../services/api'
import { useToast } from '../hooks/useToast'

export default function CenterPanel({ 
  script, 
  onUpdateScript, 
  onRunScript,
  onStopScript,
  onSaveScript,
  consoleLogs, 
  jobStatus,
  layers,
  onMapClick,
  fitBounds,
  onAreaSaved
}) {
  const [code, setCode] = useState(script?.code || '')
  const [boundaryGeoJSON, setBoundaryGeoJSON] = useState(null)
  const [copied, setCopied] = useState(false)
  const [areaNameModalOpen, setAreaNameModalOpen] = useState(false)
  const clearMapDrawingsRef = useRef(null)
  const editorRef = useRef(null)
  const toast = useToast()

  useEffect(() => {
    if (script) {
      setCode(script.code || '')
    } else {
      setCode('')
    }
  }, [script])

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor
    // Store monaco globally for use in handleInsertBoundary
    window.monaco = monaco
    
    // Configure Python-specific settings
    monaco.languages.setLanguageConfiguration('python', {
      comments: {
        lineComment: '#',
        blockComment: ['"""', '"""']
      },
      brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')']
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"', notIn: ['string'] },
        { open: "'", close: "'", notIn: ['string', 'comment'] }
      ],
      surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" }
      ],
      indentationRules: {
        increaseIndentPattern: /^\s*(def|class|if|elif|else|for|while|try|except|finally|with|async\s+def|async\s+for|async\s+with).*:\s*$/,
        decreaseIndentPattern: /^\s*(elif|else|except|finally).*$/
      }
    })

    // Define custom dark theme matching IDE colors
    monaco.editor.defineTheme('ide-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569CD6' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'type', foreground: '4EC9B0' },
        { token: 'function', foreground: 'DCDCAA' },
        { token: 'variable', foreground: '9CDCFE' }
      ],
      colors: {
        'editor.background': '#1E1E1E',
        'editor.foreground': '#D4D4D4',
        'editor.lineHighlightBackground': '#2A2D2E',
        'editor.selectionBackground': '#264F78',
        'editor.inactiveSelectionBackground': '#3A3D41',
        'editorCursor.foreground': '#AEAFAD',
        'editorWhitespace.foreground': '#3B3A32',
        'editorIndentGuide.background': '#404040',
        'editorIndentGuide.activeBackground': '#707070',
        'editor.lineNumber.foreground': '#858585',
        'editor.lineNumber.activeForeground': '#C6C6C6',
        // Widget colors
        'editorWidget.background': '#252526',
        'editorWidget.border': '#3e3e42',
        'editorWidget.foreground': '#cccccc',
        'editorWidget.resizeBorder': '#3e3e42',
        // Find widget colors
        'editorFindMatch.background': '#515C6A',
        'editorFindMatchHighlight.background': '#EA5C0055',
        'editorFindRangeHighlight.background': '#3A3D4166',
        'editorHoverWidget.background': '#252526',
        'editorHoverWidget.border': '#3e3e42',
        'editorHoverWidget.foreground': '#cccccc',
        'editorHoverWidget.statusBarBackground': '#2c2c2d'
      }
    })

    monaco.editor.setTheme('ide-dark')
  }

  const handleEditorChange = (value) => {
    setCode(value || '')
    if (script) {
      onUpdateScript(script.id, value || '')
    }
  }

  const handleRun = () => {
    if (code.trim()) {
      onRunScript(code)
    }
  }

  const handleStop = () => {
    if (onStopScript) {
      onStopScript()
    }
  }

  const handleBoundaryDraw = (geojson) => {
    console.log('Received boundary GeoJSON:', geojson)
    setBoundaryGeoJSON(geojson)
  }

  const handleSaveBoundary = () => {
    console.log('handleSaveBoundary called', { boundaryGeoJSON: !!boundaryGeoJSON })
    if (!boundaryGeoJSON) {
      console.warn('No boundary GeoJSON to save')
      return
    }
    console.log('Opening area name modal')
    setAreaNameModalOpen(true)
  }

  const handleAreaNameSubmit = async (areaName) => {
    if (!boundaryGeoJSON || !areaName.trim()) return

    try {
      const response = await api.areas.save(areaName.trim(), boundaryGeoJSON)
      if (response.success) {
        toast.success('Area saved', `"${areaName}" saved to PostGIS successfully!`)
        setBoundaryGeoJSON(null)
        setAreaNameModalOpen(false)
        // Clear drawings from map
        if (clearMapDrawingsRef.current) {
          clearMapDrawingsRef.current()
        }
        // Notify parent to refresh areas/assets list if callback provided
        if (onAreaSaved) {
          onAreaSaved()
        }
      } else {
        toast.error('Save failed', response.message || 'Failed to save area')
      }
    } catch (error) {
      console.error('Error saving area:', error)
      toast.error('Save failed', error.message || 'Failed to save area')
    }
  }

  const handleClearBoundary = () => {
    setBoundaryGeoJSON(null)
    // Also clear drawings from the map
    if (clearMapDrawingsRef.current) {
      clearMapDrawingsRef.current()
    }
  }

  return (
    <div className="flex flex-col h-full bg-ide-bg">
      {/* Toolbar */}
      <div className="h-12 border-b border-ide-border flex items-center justify-between px-4 bg-ide-panel flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={handleRun}
            disabled={jobStatus === 'running' || jobStatus === 'queued'}
            className="px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded flex items-center gap-2 transition-colors"
          >
            {jobStatus === 'running' || jobStatus === 'queued' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {jobStatus === 'queued' ? 'Queued...' : 'Running...'}
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run
              </>
            )}
          </button>
          {jobStatus === 'running' && (
            <button
              onClick={handleStop}
              className="px-4 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded flex items-center gap-2 transition-colors"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          )}
          {onSaveScript && script && (
            <button
              onClick={() => {
                const scriptToSave = {
                  ...script,
                  code: code // Use current code from editor state
                }
                console.log('Saving script from editor:', { id: scriptToSave.id, codeLength: code.length })
                onSaveScript(scriptToSave)
              }}
              className="px-4 py-1.5 text-sm bg-ide-accent hover:bg-ide-accent-hover text-white rounded flex items-center gap-2 transition-colors"
              title="Save script"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          )}
        </div>
        {jobStatus && (
          <div className="text-xs text-ide-text-muted">
            Status: <span className="capitalize">{jobStatus}</span>
          </div>
        )}
      </div>

      {/* Resizable Editor and Map */}
      <ResizableSplitter direction="vertical" defaultSize={60} minSize={20} maxSize={80}>
        {/* Code Editor */}
        <div className="flex flex-col h-full bg-ide-bg">
          <div className="h-8 border-b border-ide-border flex items-center px-4 bg-ide-panel flex-shrink-0">
            <span className="text-xs font-medium text-ide-text-muted">Editor</span>
          </div>
          <div className="flex-1 relative min-h-0">
            <Editor
              height="100%"
              language="python"
              value={code}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              theme="ide-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace",
                lineNumbers: 'on',
                lineNumbersMinChars: 3,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                insertSpaces: true,
                detectIndentation: false,
                wordWrap: 'off',
                wrappingIndent: 'indent',
                renderWhitespace: 'selection',
                bracketPairColorization: { enabled: true },
                guides: {
                  indentation: true,
                  bracketPairs: true
                },
                suggest: {
                  showKeywords: true,
                  showSnippets: true
                },
                quickSuggestions: {
                  other: true,
                  comments: false,
                  strings: true
                },
                formatOnPaste: true,
                formatOnType: true,
                autoIndent: 'full',
                matchBrackets: 'always',
                colorDecorators: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
                padding: { top: 16, bottom: 16 }
              }}
            />
          </div>
        </div>

        {/* Map Viewer */}
        <div className="flex flex-col h-full bg-ide-panel">

          <div className="flex-1 min-h-0">
            <MapViewer 
              layers={layers.filter(l => l.visible)} 
              onMapClick={onMapClick}
              onBoundaryDraw={handleBoundaryDraw}
              onClearRef={(clearFn) => { clearMapDrawingsRef.current = clearFn }}
              fitBounds={fitBounds}
              boundaryGeoJSON={boundaryGeoJSON}
              onSaveBoundary={handleSaveBoundary}
            />
          </div>
        </div>
      </ResizableSplitter>

      {/* Area Name Modal */}
      <AreaNameModal
        isOpen={areaNameModalOpen}
        onClose={() => setAreaNameModalOpen(false)}
        onSubmit={handleAreaNameSubmit}
      />
    </div>
  )
}
