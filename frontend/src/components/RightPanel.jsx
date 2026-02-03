import React, { useState } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { Terminal, Info, ClipboardList } from 'lucide-react'
import Console from './Console'
import Inspector from './Inspector'
import TasksView from './TasksView'

export default function RightPanel({ 
  consoleLogs,
  inspectorData,
  tasks
}) {
  const [activeTab, setActiveTab] = useState('console')

  return (
    <div className="flex flex-col h-full bg-ide-panel">
      <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <Tabs.List className="flex border-b border-ide-border bg-ide-panel flex-shrink-0">
          <Tabs.Trigger
            value="inspector"
            className="flex-1 px-3 py-2 text-xs font-medium text-ide-text-muted data-[state=active]:text-ide-text data-[state=active]:border-b-2 data-[state=active]:border-ide-accent bg-transparent hover:bg-ide-bg transition-colors flex items-center justify-center gap-1.5"
          >
            <Info className="w-3.5 h-3.5" />
            Inspector
          </Tabs.Trigger>
          <Tabs.Trigger
            value="console"
            className="flex-1 px-3 py-2 text-xs font-medium text-ide-text-muted data-[state=active]:text-ide-text data-[state=active]:border-b-2 data-[state=active]:border-ide-accent bg-transparent hover:bg-ide-bg transition-colors flex items-center justify-center gap-1.5"
          >
            <Terminal className="w-3.5 h-3.5" />
            Console
            {consoleLogs.length > 0 && (
              <span className="ml-1 px-1 py-0.5 text-xs bg-ide-accent rounded text-white">
                {consoleLogs.length}
              </span>
            )}
          </Tabs.Trigger>
          <Tabs.Trigger
            value="tasks"
            className="flex-1 px-3 py-2 text-xs font-medium text-ide-text-muted data-[state=active]:text-ide-text data-[state=active]:border-b-2 data-[state=active]:border-ide-accent bg-transparent hover:bg-ide-bg transition-colors flex items-center justify-center gap-1.5"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Tasks
            {tasks && tasks.length > 0 && (
              <span className="ml-1 px-1 py-0.5 text-xs bg-ide-accent rounded text-white">
                {tasks.length}
              </span>
            )}
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="inspector" className="flex-1 min-h-0">
          <Inspector data={inspectorData} />
        </Tabs.Content>

        <Tabs.Content value="console" className="flex-1 min-h-0">
          <Console logs={consoleLogs} />
        </Tabs.Content>

        <Tabs.Content value="tasks" className="flex-1 min-h-0">
          <TasksView tasks={tasks} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
