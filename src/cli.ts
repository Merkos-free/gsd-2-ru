import {
  AuthStorage,
  ModelRegistry,
  SettingsManager,
  SessionManager,
  createAgentSession,
  InteractiveMode,
} from '@mariozechner/pi-coding-agent'
import { agentDir, sessionsDir, authFilePath } from './app-paths.js'
import { buildResourceLoader, initResources } from './resource-loader.js'
import { loadStoredEnvKeys, runWizardIfNeeded } from './wizard.js'

const authStorage = AuthStorage.create(authFilePath)
loadStoredEnvKeys(authStorage)
await runWizardIfNeeded(authStorage)

const modelRegistry = new ModelRegistry(authStorage)
const settingsManager = SettingsManager.create(agentDir)

// Auto-select a default model if none is configured.
// This prevents the "No model configured" error for users who logged in
// but never explicitly ran /model to pick one.
if (!settingsManager.getDefaultModel()) {
  const availableModels = modelRegistry.getAvailable()
  if (availableModels.length > 0) {
    // Prefer Anthropic's claude-sonnet-4-6, then any Anthropic model, then first available
    const preferred =
      availableModels.find((m) => m.provider === 'anthropic' && m.id === 'claude-sonnet-4-6') ||
      availableModels.find((m) => m.provider === 'anthropic') ||
      availableModels[0]
    settingsManager.setDefaultModelAndProvider(preferred.provider, preferred.id)
  }
}

// GSD always uses quiet startup — the gsd extension renders its own branded header
if (!settingsManager.getQuietStartup()) {
  settingsManager.setQuietStartup(true)
}

// Collapse changelog by default — avoid wall of text on updates
if (!settingsManager.getCollapseChangelog()) {
  settingsManager.setCollapseChangelog(true)
}

const sessionManager = SessionManager.create(process.cwd(), sessionsDir)

initResources(agentDir)
const resourceLoader = buildResourceLoader(agentDir)
await resourceLoader.reload()

const { session, extensionsResult } = await createAgentSession({
  authStorage,
  modelRegistry,
  settingsManager,
  sessionManager,
  resourceLoader,
})

if (extensionsResult.errors.length > 0) {
  for (const err of extensionsResult.errors) {
    process.stderr.write(`[gsd] Extension load error: ${err.error}\n`)
  }
}

const interactiveMode = new InteractiveMode(session)
await interactiveMode.run()
