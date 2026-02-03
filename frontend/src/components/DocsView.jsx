import React, { useState, useEffect } from 'react'
import { Book, Copy, Check, FileText, Folder, Database, MapPin, Loader2, AlertCircle, ChevronDown } from 'lucide-react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import * as Accordion from '@radix-ui/react-accordion'
import { api } from '../services/api'

// Icon mapping
const iconMap = {
  FileText: FileText,
  Folder: Folder,
  Database: Database,
  MapPin: MapPin,
}

export default function DocsView() {
  const [copiedIndex, setCopiedIndex] = useState(null)
  const [docsData, setDocsData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const response = await api.docs.getHelperFunctions()
        if (response.success) {
          setDocsData(response.data)
        } else {
          setError(response.message || 'Failed to load documentation')
        }
      } catch (err) {
        console.error('Error fetching documentation:', err)
        setError(err.message || 'Failed to load documentation')
      } finally {
        setIsLoading(false)
      }
    }

    fetchDocs()
  }, [])

  const copyToClipboard = async (text, index) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Get category info
  const getCategoryInfo = (categoryId) => {
    if (!docsData || !docsData.categories) return null
    return docsData.categories.find(cat => cat.id === categoryId)
  }

  // Get icon component
  const getIcon = (iconName) => {
    return iconMap[iconName] || Book
  }

  // Group functions by category
  const groupFunctionsByCategory = () => {
    if (!docsData || !docsData.functions) return {}
    
    const grouped = {}
    docsData.functions.forEach(func => {
      const categoryId = func.category || 'other'
      if (!grouped[categoryId]) {
        grouped[categoryId] = []
      }
      grouped[categoryId].push(func)
    })
    
    return grouped
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-ide-accent mx-auto" />
          <p className="text-sm text-ide-text-muted">Loading documentation...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center space-y-3 max-w-md">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-sm text-red-400 font-semibold">Error loading documentation</p>
          <p className="text-xs text-ide-text-muted">{error}</p>
        </div>
      </div>
    )
  }

  if (!docsData || !docsData.functions) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-ide-text-muted">No documentation available</p>
      </div>
    )
  }

  const groupedFunctions = groupFunctionsByCategory()

  return (
    <ScrollArea.Root className="h-full w-full overflow-hidden">
      <ScrollArea.Viewport className="h-full w-full p-4 overflow-x-hidden">
        <div className="space-y-4 w-full max-w-full">
          {/* Header */}
          <div className="space-y-2 pb-2 border-b border-ide-border">
            <div className="flex items-center gap-2">
              <Book className="w-5 h-5 text-ide-accent" />
              <h2 className="text-lg font-semibold text-ide-text">Helper Functions Documentation</h2>
            </div>
            <p className="text-sm text-ide-text-muted">
              These helper functions are automatically available in your Python scripts.
            </p>
            {docsData.version && (
              <p className="text-xs text-ide-text-muted">
                Version {docsData.version}
                {docsData.last_updated && ` • Last updated: ${docsData.last_updated}`}
              </p>
            )}
          </div>

          {/* Accordion for Categories */}
          <Accordion.Root type="multiple" className="space-y-2 w-full">
            {docsData.categories && docsData.categories.map((category) => {
              const functions = groupedFunctions[category.id] || []
              if (functions.length === 0) return null

              const CategoryIcon = getIcon(category.icon || 'Book')

              return (
                <Accordion.Item
                  key={category.id}
                  value={category.id}
                  className="bg-ide-bg border border-ide-border rounded-lg overflow-hidden w-full"
                >
                  <Accordion.Header className="w-full">
                    <Accordion.Trigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-ide-panel transition-colors group">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <CategoryIcon className="w-4 h-4 text-ide-accent flex-shrink-0" />
                        <div className="text-left flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-ide-text truncate">{category.name}</h3>
                          <p className="text-xs text-ide-text-muted line-clamp-1">{category.description}</p>
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-ide-text-muted transition-transform duration-200 group-data-[state=open]:rotate-180 flex-shrink-0 ml-2" />
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down w-full">
                    <div className="px-4 pb-4 space-y-3 w-full max-w-full overflow-x-hidden">
                      {functions.map((func, funcIndex) => {
                        const FuncIcon = getIcon(category.icon || 'Book')
                        return (
                          <div
                            key={func.id || func.name}
                            className="bg-ide-panel border border-ide-border rounded-lg p-4 space-y-3 w-full max-w-full overflow-x-hidden"
                          >
                            {/* Function Name and Signature */}
                            <div className="space-y-2 w-full">
                              <div className="flex items-start gap-2 w-full">
                                <FuncIcon className="w-4 h-4 text-ide-accent mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0 w-full">
                                  <h4 className="text-sm font-semibold text-ide-text font-mono mb-1 break-words">
                                    {func.name}
                                  </h4>
                                  <p className="text-xs text-ide-text-muted leading-relaxed mb-2 break-words">
                                    {func.description}
                                  </p>
                                  <div className="bg-ide-bg rounded p-2 border border-ide-border w-full max-w-full">
                                    <div className="flex items-start justify-between gap-2 min-w-0 w-full">
                                      <code className="text-xs text-ide-text font-mono break-words break-all flex-1 min-w-0">
                                        {func.signature}
                                      </code>
                                      <button
                                        onClick={() => copyToClipboard(func.signature, `sig-${category.id}-${funcIndex}`)}
                                        className="p-1 hover:bg-ide-panel rounded transition-colors text-ide-text-muted hover:text-ide-text flex-shrink-0"
                                        title="Copy signature"
                                      >
                                        {copiedIndex === `sig-${category.id}-${funcIndex}` ? (
                                          <Check className="w-3 h-3 text-green-400" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Parameters */}
                            {func.parameters && func.parameters.length > 0 && (
                              <div className="space-y-1.5">
                                <h5 className="text-xs font-semibold text-ide-text">Parameters</h5>
                                <div className="space-y-1.5">
                                  {func.parameters.map((param, paramIndex) => (
                                    <div
                                      key={paramIndex}
                                      className="bg-ide-bg rounded p-2 border border-ide-border"
                                    >
                                      <div className="flex items-start gap-2 mb-0.5">
                                        <code className="text-xs font-semibold text-ide-accent font-mono">
                                          {param.name}
                                        </code>
                                        <span className="text-xs text-ide-text-muted">({param.type})</span>
                                        {param.required && (
                                          <span className="text-xs px-1 py-0.5 bg-red-500/20 text-red-400 rounded">
                                            required
                                          </span>
                                        )}
                                        {param.default !== null && param.default !== undefined && (
                                          <span className="text-xs px-1 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                                            default: {String(param.default)}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-ide-text-muted leading-relaxed">
                                        {param.description}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Returns */}
                            {func.returns && (
                              <div className="space-y-1.5">
                                <h5 className="text-xs font-semibold text-ide-text">Returns</h5>
                                <div className="bg-ide-bg rounded p-2 border border-ide-border">
                                  <code className="text-xs font-semibold text-ide-accent font-mono">
                                    {func.returns.type}
                                  </code>
                                  <p className="text-xs text-ide-text-muted leading-relaxed mt-1">
                                    {func.returns.description}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Examples */}
                            {func.examples && func.examples.length > 0 && (
                              <div className="space-y-1.5">
                                <h5 className="text-xs font-semibold text-ide-text">Examples</h5>
                                <div className="space-y-2">
                                  {func.examples.map((example, exampleIndex) => (
                                    <div
                                      key={exampleIndex}
                                      className="bg-ide-bg rounded border border-ide-border overflow-hidden"
                                    >
                                      {example.title && (
                                        <div className="px-2 py-1.5 bg-ide-panel border-b border-ide-border">
                                          <p className="text-xs font-medium text-ide-text">
                                            {example.title}
                                          </p>
                                          {example.description && (
                                            <p className="text-xs text-ide-text-muted mt-0.5">
                                              {example.description}
                                            </p>
                                          )}
                                        </div>
                                      )}
                                      <div className="relative w-full max-w-full">
                                        <pre className="p-2 text-xs text-ide-text font-mono overflow-x-auto w-full max-w-full break-words whitespace-pre-wrap">
                                          <code className="break-words whitespace-pre-wrap">{example.code}</code>
                                        </pre>
                                        <button
                                          onClick={() => copyToClipboard(example.code, `ex-${category.id}-${funcIndex}-${exampleIndex}`)}
                                          className="absolute top-1.5 right-1.5 p-1 hover:bg-ide-panel rounded transition-colors text-ide-text-muted hover:text-ide-text"
                                          title="Copy code"
                                        >
                                          {copiedIndex === `ex-${category.id}-${funcIndex}-${exampleIndex}` ? (
                                            <Check className="w-3 h-3 text-green-400" />
                                          ) : (
                                            <Copy className="w-3 h-3" />
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Notes */}
                            {func.notes && func.notes.length > 0 && (
                              <div className="space-y-1.5">
                                <h5 className="text-xs font-semibold text-ide-text">Notes</h5>
                                <ul className="space-y-1">
                                  {func.notes.map((note, noteIndex) => (
                                    <li
                                      key={noteIndex}
                                      className="text-xs text-ide-text-muted flex items-start gap-2"
                                    >
                                      <span className="text-ide-accent mt-0.5">•</span>
                                      <span className="leading-relaxed">{note}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Related Functions */}
                            {func.related_functions && func.related_functions.length > 0 && (
                              <div className="space-y-1.5">
                                <h5 className="text-xs font-semibold text-ide-text">Related Functions</h5>
                                <div className="flex flex-wrap gap-1.5">
                                  {func.related_functions.map((relatedFunc, relatedIndex) => (
                                    <code
                                      key={relatedIndex}
                                      className="text-xs px-1.5 py-0.5 bg-ide-bg text-ide-accent rounded border border-ide-border font-mono"
                                    >
                                      {relatedFunc}
                                    </code>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </Accordion.Content>
                </Accordion.Item>
              )
            })}
          </Accordion.Root>

          {/* Environment Variables */}
          {docsData.environment_variables && docsData.environment_variables.length > 0 && (
            <Accordion.Root type="single" collapsible className="space-y-2 w-full">
              <Accordion.Item
                value="env-vars"
                className="bg-ide-bg border border-ide-border rounded-lg overflow-hidden w-full"
              >
                <Accordion.Header className="w-full">
                  <Accordion.Trigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-ide-panel transition-colors group">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Book className="w-4 h-4 text-ide-accent flex-shrink-0" />
                      <div className="text-left flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-ide-text">Environment Variables</h3>
                        <p className="text-xs text-ide-text-muted line-clamp-1">
                          Variables automatically set in your script execution environment
                        </p>
                      </div>
                    </div>
                    <ChevronDown className="w-4 h-4 text-ide-text-muted transition-transform duration-200 group-data-[state=open]:rotate-180 flex-shrink-0 ml-2" />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down w-full">
                  <div className="px-4 pb-4 space-y-2 w-full max-w-full overflow-x-hidden">
                    {docsData.environment_variables.map((env, index) => (
                      <div
                        key={index}
                        className="bg-ide-panel rounded p-2.5 border border-ide-border"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <code className="text-xs font-semibold text-ide-accent font-mono">
                            {env.name}
                          </code>
                          {env.required && (
                            <span className="text-xs px-1 py-0.5 bg-red-500/20 text-red-400 rounded">
                              required
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-ide-text-muted">{env.description}</p>
                      </div>
                    ))}
                  </div>
                </Accordion.Content>
              </Accordion.Item>
            </Accordion.Root>
          )}
        </div>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar
        className="flex select-none touch-none p-0.5 bg-ide-panel transition-colors duration-150 hover:bg-ide-bg data-[orientation=vertical]:w-2.5 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:h-2.5"
        orientation="vertical"
      >
        <ScrollArea.Thumb className="flex-1 bg-ide-border rounded-[10px] relative before:content-[''] before:absolute before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-full before:h-full before:min-w-[44px] before:min-h-[44px]" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  )
}
