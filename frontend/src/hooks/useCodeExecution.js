/**
 * Custom hook for code execution
 */
import { useState, useCallback, useRef } from 'react'
import { api } from '../services/api'

export function useCodeExecution() {
  const [isExecuting, setIsExecuting] = useState(false)
  const [output, setOutput] = useState([])
  const [error, setError] = useState(null)
  const abortControllerRef = useRef(null)

  const executeCode = useCallback(async (code) => {
    setIsExecuting(true)
    setError(null)
    setOutput([])

    // Create abort controller for cancellation
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const response = await api.code.execute(code)
      if (response.success) {
        if (response.data && response.data.output) {
          setOutput(response.data.output)
        }
        return response.data
      }
      throw new Error(response.message || 'Code execution failed')
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Execution cancelled')
        return null
      }
      setError(err.message)
      throw err
    } finally {
      setIsExecuting(false)
      abortControllerRef.current = null
    }
  }, [])

  const stopExecution = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsExecuting(false)
    }
  }, [])

  const clearOutput = useCallback(() => {
    setOutput([])
    setError(null)
  }, [])

  return {
    isExecuting,
    output,
    error,
    executeCode,
    stopExecution,
    clearOutput,
  }
}
