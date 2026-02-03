import React, { useState } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { FileCode, Folder, Book } from 'lucide-react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import ScriptsView from './ScriptsView'
import AssetsView from './AssetsView'
import DocsView from './DocsView'

export default function LeftPanel({ 
  scripts, 
  assets, 
  activeScriptId, 
  onSelectScript, 
  onCreateScript,
  onDeleteScript,
  onRenameScript,
  onUpdateScript,
  onAddLayer,
  onFitBounds,
  assetsRefreshTrigger
}) {
  const [activeTab, setActiveTab] = useState('script')

  return (
    <div className="h-full flex flex-col bg-ide-panel">
      <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <Tabs.List className="flex border-b border-ide-border flex-shrink-0">
          <Tabs.Trigger
            value="script"
            className="flex-1 px-2 py-2 text-xs font-medium text-ide-text-muted data-[state=active]:text-ide-text data-[state=active]:border-b-2 data-[state=active]:border-ide-accent bg-transparent hover:bg-ide-bg transition-colors flex items-center justify-center gap-1.5"
          >
            <FileCode className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Script</span>
          </Tabs.Trigger>
          <Tabs.Trigger
            value="assets"
            className="flex-1 px-2 py-2 text-xs font-medium text-ide-text-muted data-[state=active]:text-ide-text data-[state=active]:border-b-2 data-[state=active]:border-ide-accent bg-transparent hover:bg-ide-bg transition-colors flex items-center justify-center gap-1.5"
          >
            <Folder className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Assets</span>
          </Tabs.Trigger>
          <Tabs.Trigger
            value="docs"
            className="flex-1 px-2 py-2 text-xs font-medium text-ide-text-muted data-[state=active]:text-ide-text data-[state=active]:border-b-2 data-[state=active]:border-ide-accent bg-transparent hover:bg-ide-bg transition-colors flex items-center justify-center gap-1.5"
          >
            <Book className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Docs</span>
          </Tabs.Trigger>
        </Tabs.List>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          <Tabs.Content value="script" className="absolute inset-0 flex flex-col min-h-0 overflow-hidden data-[state=inactive]:hidden">
            <ScriptsView
              scripts={scripts}
              activeScriptId={activeScriptId}
              onSelectScript={onSelectScript}
              onCreateScript={onCreateScript}
              onDeleteScript={onDeleteScript}
              onRenameScript={onRenameScript}
              onUpdateScript={onUpdateScript}
            />
          </Tabs.Content>

          <Tabs.Content value="assets" className="absolute inset-0 flex flex-col min-h-0 overflow-hidden data-[state=inactive]:hidden">
            <AssetsView onAddLayer={onAddLayer} onFitBounds={onFitBounds} refreshTrigger={assetsRefreshTrigger} />
          </Tabs.Content>

          <Tabs.Content value="docs" className="absolute inset-0 flex flex-col min-h-0 overflow-hidden data-[state=inactive]:hidden">
            <DocsView />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  )
}
