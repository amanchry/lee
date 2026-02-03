import { useCallback } from 'react'
import * as Toast from '@radix-ui/react-toast'

let toastId = 0

export function useToast() {
  const showToast = useCallback((title, description, variant = 'info') => {
    const id = `toast-${toastId++}`
    const duration = variant === 'error' ? 5000 : 3000

    // Create toast element
    const toast = document.createElement('div')
    toast.className = `ToastRoot ToastRoot--${variant}`
    toast.setAttribute('data-toast-id', id)
    
    const viewport = document.querySelector('.ToastViewport')
    if (!viewport) {
      console.error('ToastViewport not found')
      return
    }

    // Create toast content
    toast.innerHTML = `
      <div class="ToastTitle">${title}</div>
      ${description ? `<div class="ToastDescription">${description}</div>` : ''}
      <button class="ToastClose" aria-label="Close">×</button>
    `

    // Add styles
    toast.style.cssText = `
      background: ${variant === 'error' ? '#ef4444' : variant === 'success' ? '#10b981' : variant === 'warning' ? '#f59e0b' : '#3b82f6'};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: flex-start;
      gap: 12px;
      min-width: 300px;
      max-width: 390px;
      position: relative;
      animation: slideIn 0.3s ease-out;
    `

    // Add close button handler
    const closeBtn = toast.querySelector('.ToastClose')
    closeBtn.style.cssText = `
      background: transparent;
      border: none;
      color: white;
      font-size: 20px;
      cursor: pointer;
      padding: 0;
      margin-left: auto;
      opacity: 0.8;
      transition: opacity 0.2s;
    `
    closeBtn.onmouseover = () => closeBtn.style.opacity = '1'
    closeBtn.onmouseout = () => closeBtn.style.opacity = '0.8'
    closeBtn.onclick = () => {
      toast.style.animation = 'slideOut 0.3s ease-in'
      setTimeout(() => toast.remove(), 300)
    }

    viewport.appendChild(toast)

    // Auto remove after duration
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'slideOut 0.3s ease-in'
        setTimeout(() => toast.remove(), 300)
      }
    }, duration)

    return id
  }, [])

  return {
    toast: showToast,
    success: (title, description) => showToast(title, description, 'success'),
    error: (title, description) => showToast(title, description, 'error'),
    warning: (title, description) => showToast(title, description, 'warning'),
    info: (title, description) => showToast(title, description, 'info'),
  }
}

// Add CSS animations
const style = document.createElement('style')
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`
if (!document.querySelector('style[data-toast-animations]')) {
  style.setAttribute('data-toast-animations', 'true')
  document.head.appendChild(style)
}
