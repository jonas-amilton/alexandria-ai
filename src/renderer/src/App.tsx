import { useState, useEffect, useCallback, type ReactNode } from 'react'

import type { SettingsStatus as SettingsStatusType } from '../../shared/chat'
import type { ProjectRecord, ProjectsState } from '../../shared/projects'
import { PROVIDERS } from '../../shared/providers'
import type { RagIndexStats } from '../../shared/rag'

import useChat from './features/chat/hooks/useChat'
import Sidebar from './features/chat/components/Sidebar'
import MobileDrawer from './features/chat/components/MobileDrawer'
import ChatHeader from './features/chat/components/ChatHeader'
import MessageList from './features/chat/components/MessageList'
import ChatComposer from './features/chat/components/ChatComposer'
import SettingsModal from './features/settings/components/SettingsModal'
import MemoryModal from './features/chat/components/MemoryModal'
import SkillsModal from './features/chat/components/SkillsModal'
import CodeGraphModal from './features/chat/components/CodeGraphModal'

const MODEL_NAME = 'Alexandria.AI'

// ── App ─────────────────────────────────────────────────────────────────────

function App(): ReactNode {
  // ── Modals & Drawer State ───────────────────────────────────────────────

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [memoryModalOpen, setMemoryModalOpen] = useState(false)
  const [skillsModalOpen, setSkillsModalOpen] = useState(false)
  const [graphModalOpen, setGraphModalOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState<'openrouter' | 'deepseek' | 'mcp'>(
    'openrouter'
  )

  // ── Settings & Projects state ───────────────────────────────────────────

  const [settingsStatus, setSettingsStatus] = useState<SettingsStatusType | null>(null)
  const [projectsState, setProjectsState] = useState<ProjectsState | null>(null)
  const [ragStats, setRagStats] = useState<RagIndexStats | null>(null)

  const activeProjectId = projectsState?.activeProjectId
  const activeProject = projectsState?.activeProject ?? null
  const projectsList = projectsState?.projects ?? []

  // ── Chat hook (scoped to active project) ────────────────────────────────

  const chat = useChat(activeProjectId)

  // ── Load Settings, Projects & RAG status on mount ───────────────────────

  const refreshRagStats = useCallback(async (projId: string): Promise<void> => {
    try {
      const stats = await window.deepdesk.rag.stats(projId)
      setRagStats(stats)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    let disposed = false

    const loadInitialState = async (): Promise<void> => {
      try {
        const [settings, pState] = await Promise.all([
          window.deepdesk.settings.status(),
          window.deepdesk.projects.getState()
        ])

        if (!disposed) {
          setSettingsStatus(settings)
          setProjectsState(pState)
          if (pState.activeProjectId) {
            void refreshRagStats(pState.activeProjectId)
          }
        }
      } catch {
        // ignore
      }
    }

    void loadInitialState()

    return () => {
      disposed = true
    }
  }, [refreshRagStats])

  // ── Project Handlers ────────────────────────────────────────────────────

  const handleOpenProjectDialog = async (): Promise<void> => {
    try {
      const project: ProjectRecord | null = await window.deepdesk.projects.openDialog()
      if (project) {
        const nextState = await window.deepdesk.projects.getState()
        setProjectsState(nextState)
        chat.handleNewChat()
        void refreshRagStats(project.id)
      }
    } catch (err) {
      alert(`Erro ao abrir pasta: ${String(err)}`)
    }
  }

  const handleSwitchProject = async (projectId: string): Promise<void> => {
    try {
      const project = await window.deepdesk.projects.switch(projectId)
      if (project) {
        const nextState = await window.deepdesk.projects.getState()
        setProjectsState(nextState)
        chat.handleNewChat()
        void refreshRagStats(project.id)
      }
    } catch (err) {
      alert(`Erro ao alternar projeto: ${String(err)}`)
    }
  }

  const handleRemoveProject = async (projectId: string): Promise<void> => {
    try {
      const nextState = await window.deepdesk.projects.remove(projectId)
      setProjectsState(nextState)
      if (nextState.activeProjectId) {
        void refreshRagStats(nextState.activeProjectId)
      }
    } catch (err) {
      alert(`Erro ao remover projeto: ${String(err)}`)
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────

  const displayError = chat.error

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="w-full flex h-screen overflow-hidden bg-[var(--app-bg)] text-[var(--app-text)]">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar
          currentSessionId={chat.currentSessionId}
          activeTitle={chat.conversationTitle}
          sessions={chat.sessions}
          activeProject={activeProject}
          projects={projectsList}
          ragStats={ragStats}
          onSelectSession={(id) => {
            void chat.handleSelectSession(id)
          }}
          onDeleteSession={(id) => {
            void chat.handleDeleteSession(id)
          }}
          onNewChat={chat.handleNewChat}
          onOpenProjectDialog={() => {
            void handleOpenProjectDialog()
          }}
          onSwitchProject={(id) => {
            void handleSwitchProject(id)
          }}
          onRemoveProject={(id) => {
            void handleRemoveProject(id)
          }}
          onOpenMemoryModal={() => setMemoryModalOpen(true)}
          onOpenSkillsModal={() => setSkillsModalOpen(true)}
          onOpenGraphModal={() => setGraphModalOpen(true)}
          onOpenSettingsModal={() => setSettingsModalOpen(true)}
        />
      </div>

      {/* Mobile drawer */}
      <MobileDrawer open={mobileDrawerOpen} onClose={() => setMobileDrawerOpen(false)}>
        <Sidebar
          currentSessionId={chat.currentSessionId}
          activeTitle={chat.conversationTitle}
          sessions={chat.sessions}
          activeProject={activeProject}
          projects={projectsList}
          ragStats={ragStats}
          onSelectSession={(id) => {
            void chat.handleSelectSession(id)
          }}
          onDeleteSession={(id) => {
            void chat.handleDeleteSession(id)
          }}
          onNewChat={chat.handleNewChat}
          onToggleMobile={() => setMobileDrawerOpen(false)}
          onOpenProjectDialog={() => {
            void handleOpenProjectDialog()
          }}
          onSwitchProject={(id) => {
            void handleSwitchProject(id)
          }}
          onRemoveProject={(id) => {
            void handleRemoveProject(id)
          }}
          onOpenMemoryModal={() => setMemoryModalOpen(true)}
          onOpenSkillsModal={() => setSkillsModalOpen(true)}
          onOpenGraphModal={() => setGraphModalOpen(true)}
          onOpenSettingsModal={() => setSettingsModalOpen(true)}
        />
      </MobileDrawer>

      {/* Main area */}
      <main className="flex min-w-0 flex-1 flex-col bg-[var(--app-bg)]">
        {/* Header */}
        <ChatHeader
          projectName={activeProject?.name || 'Projeto'}
          sessionTitle={chat.conversationTitle}
          onOpenCodeGraph={() => setGraphModalOpen(true)}
          onOpenSkills={() => setSkillsModalOpen(true)}
          onOpenMemory={() => setMemoryModalOpen(true)}
          onOpenMcp={() => {
            setSettingsInitialTab('mcp')
            setSettingsModalOpen(true)
          }}
          onOpenSettings={() => {
            setSettingsInitialTab('openrouter')
            setSettingsModalOpen(true)
          }}
          onToggleMobileMenu={() => setMobileDrawerOpen(true)}
        />

        {/* Error banner */}
        {displayError !== null && (
          <div className="flex-shrink-0 border-b border-(--color-accent-red) bg-red-950/30 px-5 py-2 font-mono text-(length:--text-xs) text-(--color-accent-red) lg:px-6">
            {displayError}
            <button
              type="button"
              className="ml-3 text-(--color-text) underline hover:text-(--color-accent-red)"
              onClick={() => {
                chat.clearError()
              }}
            >
              Dispensar
            </button>
          </div>
        )}

        {/* Messages */}
        <MessageList
          messages={chat.messages}
          streamingContent={chat.streamingContent}
          toolActivity={chat.toolActivity}
          isStreaming={chat.isLoading}
          onFillInput={(text) => {
            chat.setMessageInput(text)
          }}
        />

        {/* Composer */}
        <ChatComposer
          value={chat.messageInput}
          onChange={chat.setMessageInput}
          onSubmit={() => {
            void chat.handleSend()
          }}
          onCancel={() => {
            void chat.handleCancel()
          }}
          agentMode={chat.agentMode}
          onToggleAgentMode={chat.toggleAgentMode}
          isStreaming={chat.isLoading}
          isLoading={chat.isLoading}
          disabled={chat.isLoading}
          isProjectOpen={Boolean(activeProject)}
          modelLabel={settingsStatus?.model ?? MODEL_NAME}
          contextWindowLabel={
            settingsStatus?.provider ? PROVIDERS[settingsStatus.provider].label : 'OpenRouter'
          }
          onKeyDown={chat.handleKeyDown}
        />
      </main>

      {/* Memory modal (USER.md & MEMORY.md) */}
      <MemoryModal
        open={memoryModalOpen}
        activeProjectPath={activeProject?.path}
        activeProjectName={activeProject?.name}
        onClose={() => setMemoryModalOpen(false)}
      />

      {/* Skills modal (SKILL.md catalog & editor) */}
      <SkillsModal open={skillsModalOpen} onClose={() => setSkillsModalOpen(false)} />

      {/* CodeGraph modal */}
      <CodeGraphModal
        open={graphModalOpen}
        onClose={() => setGraphModalOpen(false)}
        targetDir={activeProject?.path}
      />

      {/* Settings & Models modal */}
      <SettingsModal
        key={`${settingsModalOpen ? 'open' : 'closed'}-${settingsInitialTab}`}
        open={settingsModalOpen}
        status={settingsStatus}
        activeProjectPath={activeProject?.path}
        initialTab={settingsInitialTab}
        onClose={() => setSettingsModalOpen(false)}
        onUpdateSettings={async (provider, model) => {
          const res = await window.deepdesk.settings.update({ provider, model })
          setSettingsStatus(res)
          return res
        }}
        onSaveApiKey={async (provider, apiKey) => {
          const res = await window.deepdesk.settings.saveApiKey(provider, apiKey)
          setSettingsStatus(res)
          return res
        }}
        onClearApiKey={async (provider) => {
          const res = await window.deepdesk.settings.clearApiKey(provider)
          setSettingsStatus(res)
          return res
        }}
      />
    </div>
  )
}

export default App
