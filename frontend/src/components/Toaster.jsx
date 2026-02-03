import React from 'react'
import * as Toast from '@radix-ui/react-toast'
import './Toaster.css'

export function Toaster() {
  return (
    <Toast.Provider>
      <Toast.Viewport className="ToastViewport" />
    </Toast.Provider>
  )
}
