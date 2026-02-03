/**
 * Centralized API service layer
 * All API calls go through this module
 */

const API_BASE_URL = 'http://localhost:8000/djangoApi/webapp'

/**
 * Get authentication token from localStorage
 */
const getToken = () => {
  const savedUser = localStorage.getItem('earthcode_user')
  return savedUser ? JSON.parse(savedUser).token : null
}

/**
 * Get default headers with authentication
 */
const getHeaders = (includeAuth = true, contentType = 'application/json') => {
  const headers = {}
  
  // Only set Content-Type if provided (don't set for FormData - browser will set it automatically)
  if (contentType) {
    headers['Content-Type'] = contentType
  }
  
  if (includeAuth) {
    const token = getToken()
    if (token) {
      headers['Authorization'] = `Token ${token}`
    }
  }
  
  return headers
}

/**
 * Handle API response
 */
const handleResponse = async (response) => {
  let data
  try {
    const text = await response.text()
    if (!text) {
      throw new Error('Empty response from server')
    }
    data = JSON.parse(text)
  } catch (error) {
    console.error('Error parsing response:', error, 'Response status:', response.status)
    throw new Error(`Failed to parse server response: ${error.message}`)
  }
  
  if (!response.ok) {
    const errorMessage = data.message || data.error || `HTTP error! status: ${response.status}`
    console.error('API error:', { status: response.status, message: errorMessage, data })
    throw new Error(errorMessage)
  }
  
  return data
}

/**
 * API service object
 */
export const api = {
  // Documentation endpoints
  docs: {
    getHelperFunctions: async () => {
      const response = await fetch(`${API_BASE_URL}/helper-functions-docs/`, {
        method: 'GET',
        headers: getHeaders(false), // No auth needed for docs
      })
      return handleResponse(response)
    },
  },
  // Authentication
  auth: {
    login: async (email, password, tool = 'earthcode') => {
      const response = await fetch(`${API_BASE_URL}/login/`, {
        method: 'POST',
        headers: getHeaders(false),
        body: JSON.stringify({ email, password, tool }),
      })
      return handleResponse(response)
    },
    
    sendOtp: async (email, tool = 'earthcode') => {
      const response = await fetch(`${API_BASE_URL}/send-otp/`, {
        method: 'POST',
        headers: getHeaders(false),
        body: JSON.stringify({ email, tool }),
      })
      return handleResponse(response)
    },
    
    verifyOtp: async (email, otp) => {
      const response = await fetch(`${API_BASE_URL}/verify-otp/`, {
        method: 'POST',
        headers: getHeaders(false),
        body: JSON.stringify({ email, otp }),
      })
      return handleResponse(response)
    },
    
    createAccount: async (email, name, password, tool = 'earthcode') => {
      const response = await fetch(`${API_BASE_URL}/create-account/`, {
        method: 'POST',
        headers: getHeaders(false),
        body: JSON.stringify({ email, name, password, tool }),
      })
      return handleResponse(response)
    },
  },
  
  // Scripts
  scripts: {
    getAll: async () => {
      const response = await fetch(`${API_BASE_URL}/scripts/`, {
        method: 'GET',
        headers: getHeaders(),
      })
      return handleResponse(response)
    },
    
    getById: async (scriptId) => {
      const response = await fetch(`${API_BASE_URL}/scripts/${scriptId}/`, {
        method: 'GET',
        headers: getHeaders(),
      })
      return handleResponse(response)
    },
    
    create: async (name, code, description = '') => {
      const response = await fetch(`${API_BASE_URL}/scripts/create/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name, code, description }),
      })
      return handleResponse(response)
    },
    
    update: async (scriptId, name, code, description = '') => {
      const response = await fetch(`${API_BASE_URL}/scripts/${scriptId}/update/`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ name, code, description }),
      })
      return handleResponse(response)
    },
    
    delete: async (scriptId) => {
      const response = await fetch(`${API_BASE_URL}/scripts/${scriptId}/delete/`, {
        method: 'DELETE',
        headers: getHeaders(),
      })
      return handleResponse(response)
    },
    
    togglePublic: async (scriptId) => {
      const response = await fetch(`${API_BASE_URL}/scripts/${scriptId}/toggle-public/`, {
        method: 'POST',
        headers: getHeaders(),
      })
      return handleResponse(response)
    },
  },
  
  // Files
  files: {
    upload: async (file, folderPath = 'assets') => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder_path', folderPath)
      
      const headers = getHeaders(true, null) // Don't set Content-Type for FormData - browser will set it
      
      const response = await fetch(`${API_BASE_URL}/upload-file/`, {
        method: 'POST',
        headers: headers,
        body: formData,
      })
      return handleResponse(response)
    },
    
    uploadGeoJSON: async (file, areaName, folderPath = 'assets') => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('area_name', areaName)
      formData.append('folder_path', folderPath)
      
      const headers = getHeaders(true, null) // Don't set Content-Type for FormData - browser will set it
      
      const response = await fetch(`${API_BASE_URL}/upload-file/`, {
        method: 'POST',
        headers: headers,
        body: formData,
      })
      return handleResponse(response)
    },
    
    createFolder: async (folderName, parentPath = '') => {
      const response = await fetch(`${API_BASE_URL}/create-folder/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ folder_name: folderName, parent_path: parentPath }),
      })
      return handleResponse(response)
    },
    
    list: async (folderPath = 'assets') => {
      const response = await fetch(`${API_BASE_URL}/list-files/?folder_path=${encodeURIComponent(folderPath)}`, {
        method: 'GET',
        headers: getHeaders(),
      })
      return handleResponse(response)
    },
    
    delete: async (filePath) => {
      const response = await fetch(`${API_BASE_URL}/delete-file/`, {
        method: 'DELETE',
        headers: getHeaders(),
        body: JSON.stringify({ file_path: filePath }),
      })
      return handleResponse(response)
    },
    
    rename: async (filePath, newName) => {
      const response = await fetch(`${API_BASE_URL}/rename-file/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ file_path: filePath, new_name: newName }),
      })
      return handleResponse(response)
    },
    
    move: async (sourcePath, destinationFolder) => {
      const response = await fetch(`${API_BASE_URL}/move-file/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ source_path: sourcePath, destination_folder: destinationFolder }),
      })
      return handleResponse(response)
    },
  },
  
  // Code Execution
  code: {
    execute: async (code) => {
      const response = await fetch(`${API_BASE_URL}/execute-code/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ code }),
      })
      return handleResponse(response)
    },
  },
  
  // Areas
  areas: {
    save: async (name, geometry) => {
      const response = await fetch(`${API_BASE_URL}/save-draw-polygon/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name, geom: JSON.stringify(geometry) }),
      })
      return handleResponse(response)
    },
    
    list: async () => {
      const response = await fetch(`${API_BASE_URL}/get-added-area-list/`, {
        method: 'GET',
        headers: getHeaders(),
      })
      return handleResponse(response)
    },
    
    getGeometry: async (areaId) => {
      const response = await fetch(`${API_BASE_URL}/get-area-geom/${areaId}`, {
        method: 'GET',
        headers: getHeaders(),
      })
      return handleResponse(response)
    },
    
    delete: async (areaId) => {
      const response = await fetch(`${API_BASE_URL}/delete-area-geom/${areaId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      })
      return handleResponse(response)
    },
  },
}

export default api
