/**
 * Custom hook for script management
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'

export function useScripts() {
  const [scripts, setScripts] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadScripts = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.scripts.getAll()
      if (response.success && response.data) {
        const formattedScripts = response.data.map(script => ({
          id: script.id.toString(),
          name: script.name,
          code: script.code,
          description: script.description,
          backendId: script.id,
          is_public: script.is_public || false,
        }))
        setScripts(formattedScripts)
        return formattedScripts
      }
      return []
    } catch (err) {
      setError(err.message)
      console.error('Error loading scripts:', err)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createScript = useCallback(async (name, code, description = '') => {
    try {
      const response = await api.scripts.create(name, code, description)
      if (response.success) {
        await loadScripts()
        return response.data
      }
      throw new Error(response.message || 'Failed to create script')
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [loadScripts])

  const updateScript = useCallback(async (scriptId, name, code, description = '') => {
    try {
      const backendId = scripts.find(s => s.id === scriptId)?.backendId || scriptId
      const response = await api.scripts.update(backendId, name, code, description)
      if (response.success) {
        await loadScripts()
        return response.data
      }
      throw new Error(response.message || 'Failed to update script')
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [scripts, loadScripts])

  const deleteScript = useCallback(async (scriptId) => {
    try {
      const backendId = scripts.find(s => s.id === scriptId)?.backendId || scriptId
      const response = await api.scripts.delete(backendId)
      if (response.success) {
        await loadScripts()
        return true
      }
      throw new Error(response.message || 'Failed to delete script')
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [scripts, loadScripts])

  const getScriptById = useCallback(async (scriptId) => {
    try {
      const response = await api.scripts.getById(scriptId)
      if (response.success) {
        return response.data
      }
      throw new Error(response.message || 'Script not found')
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  useEffect(() => {
    loadScripts()
  }, [loadScripts])

  return {
    scripts,
    isLoading,
    error,
    loadScripts,
    createScript,
    updateScript,
    deleteScript,
    getScriptById,
  }
}
