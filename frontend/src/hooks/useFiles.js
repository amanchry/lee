/**
 * Custom hook for file management
 */
import { useState, useCallback } from 'react'
import { api } from '../services/api'

export function useFiles() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const uploadFile = useCallback(async (file, folderPath = 'assets') => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.files.upload(file, folderPath)
      if (response.success) {
        return response.data
      }
      throw new Error(response.message || 'Failed to upload file')
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createFolder = useCallback(async (folderName, parentPath = '') => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.files.createFolder(folderName, parentPath)
      if (response.success) {
        return response.data
      }
      throw new Error(response.message || 'Failed to create folder')
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const listFiles = useCallback(async (folderPath = 'assets') => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.files.list(folderPath)
      if (response.success) {
        return response.data || []
      }
      throw new Error(response.message || 'Failed to list files')
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const deleteFile = useCallback(async (filePath) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.files.delete(filePath)
      if (response.success) {
        return true
      }
      throw new Error(response.message || 'Failed to delete file')
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    isLoading,
    error,
    uploadFile,
    createFolder,
    listFiles,
    deleteFile,
  }
}
