import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Loader2, Play, Square } from 'lucide-react'
import { useToast } from '../hooks/useToast'

export default function ScriptView({ user, onLogin }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [script, setScript] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [code, setCode] = useState('')
  const [jobStatus, setJobStatus] = useState(null)
  const [consoleLogs, setConsoleLogs] = useState([])
  const [abortController, setAbortController] = useState(null)
  const toast = useToast()

  useEffect(() => {
    loadScript()
  }, [id])

  const getToken = () => {
    const savedUser = localStorage.getItem('earthcode_user')
    return savedUser ? JSON.parse(savedUser).token : null
  }

  const loadScript = async () => {
    setIsLoading(true)
    try {
      const token = getToken()
      
      const headers = {}
      if (token) {
        headers['Authorization'] = `Token ${token}`
      }

      const response = await fetch(`http://localhost:8000/djangoApi/webapp/scripts/${id}/`, {
        method: 'GET',
        headers
      })

      const data = await response.json()

      if (data.success) {
        setScript(data.data)
        setCode(data.data.code)
      } else {
        toast.error('Error', data.message || 'Script not found')
        navigate('/')
      }
    } catch (error) {
      console.error('Error loading script:', error)
      toast.error('Error', 'Failed to load script')
      navigate('/')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRunScript = async () => {
    const taskId = `task-${Date.now()}`
    setJobStatus('queued')
    setConsoleLogs([{ type: 'info', message: 'Job queued...', timestamp: new Date() }])
    
    const token = getToken()
    if (!token) {
      setJobStatus('error')
      setConsoleLogs(prev => [...prev, {
        type: 'error',
        message: 'Authentication error: Please login to run scripts.',
        timestamp: new Date()
      }])
      return
    }

    try {
      setJobStatus('running')
      setConsoleLogs(prev => [...prev, 
        { type: 'info', message: 'Executing Python code...', timestamp: new Date() }
      ])

      const controller = new AbortController()
      setAbortController(controller)

      const response = await fetch('http://localhost:8000/djangoApi/webapp/execute-code/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        },
        body: JSON.stringify({ code }),
        signal: controller.signal
      })

      const data = await response.json()

      if (data.success) {
        setJobStatus('completed')
        if (data.output && Array.isArray(data.output)) {
          setConsoleLogs(prev => [...prev, ...data.output])
        }
        setConsoleLogs(prev => [...prev, {
          type: 'success',
          message: 'Script executed successfully!',
          timestamp: new Date()
        }])
      } else {
        setJobStatus('error')
        setConsoleLogs(prev => [...prev, {
          type: 'error',
          message: data.message || 'Script execution failed',
          timestamp: new Date()
        }])
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        setJobStatus(null)
        setConsoleLogs(prev => [...prev, {
          type: 'warning',
          message: 'Script execution cancelled',
          timestamp: new Date()
        }])
        return
      }
      setJobStatus('error')
      setConsoleLogs(prev => [...prev, {
        type: 'error',
        message: `Error: ${error.message}`,
        timestamp: new Date()
      }])
    } finally {
      setAbortController(null)
    }
  }

  const handleStopScript = () => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ide-bg">
        <Loader2 className="w-8 h-8 animate-spin text-ide-accent" />
      </div>
    )
  }

  if (!script) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ide-bg">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-ide-text mb-4">Script not found</h1>
          <Link to="/" className="text-ide-accent hover:underline">
            Go back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ide-bg text-ide-text">
      {/* Header */}
      <div className="border-b border-ide-border bg-ide-panel">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 hover:bg-ide-bg rounded transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-ide-text">{script.name}</h1>
              {script.description && (
                <p className="text-sm text-ide-text-muted mt-1">{script.description}</p>
              )}
              <p className="text-xs text-ide-text-muted mt-1">
                By {script.author} • Updated {new Date(script.updated_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunScript}
              disabled={jobStatus === 'running' || jobStatus === 'queued'}
              className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded flex items-center gap-2 transition-colors"
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
                onClick={handleStopScript}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded flex items-center gap-2 transition-colors"
              >
                <Square className="w-4 h-4" />
                Stop
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Code Editor */}
          <div className="bg-ide-panel border border-ide-border rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-ide-border bg-ide-bg">
              <h2 className="text-sm font-medium text-ide-text">Code</h2>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-96 p-4 bg-ide-bg text-ide-text font-mono text-sm resize-none focus:outline-none"
              readOnly={!script.is_owner}
            />
          </div>

          {/* Console */}
          <div className="bg-ide-panel border border-ide-border rounded-lg overflow-hidden flex flex-col">
            <div className="px-4 py-2 border-b border-ide-border bg-ide-bg">
              <h2 className="text-sm font-medium text-ide-text">Console</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-sm max-h-96">
              {consoleLogs.length === 0 ? (
                <div className="text-ide-text-muted">No output yet. Run the script to see results.</div>
              ) : (
                consoleLogs.map((log, index) => (
                  <div
                    key={index}
                    className={`mb-2 ${
                      log.type === 'error' ? 'text-red-400' :
                      log.type === 'success' ? 'text-green-400' :
                      log.type === 'warning' ? 'text-yellow-400' :
                      'text-ide-text'
                    }`}
                  >
                    <span className="text-ide-text-muted">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>{' '}
                    {log.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
