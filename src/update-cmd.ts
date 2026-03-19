import { execSync } from 'node:child_process'
import { compareSemver } from './update-check.js'

const NPM_PACKAGE = 'gsd-pi'

export async function runUpdate(): Promise<void> {
  const current = process.env.GSD_VERSION || '0.0.0'
  const bold = '\x1b[1m'
  const dim = '\x1b[2m'
  const green = '\x1b[32m'
  const yellow = '\x1b[33m'
  const reset = '\x1b[0m'

  process.stdout.write(`${dim}Текущая версия:${reset} v${current}\n`)
  process.stdout.write(`${dim}Проверка реестра npm...${reset}\n`)

  // Fetch latest version
  let latest: string
  try {
    latest = execSync(`npm view ${NPM_PACKAGE} version`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    process.stderr.write(`${yellow}Не удалось обратиться к реестру npm.${reset}\n`)
    process.exit(1)
  }

  if (compareSemver(latest, current) <= 0) {
    process.stdout.write(`${green}Уже используется актуальная версия.${reset}\n`)
    return
  }

  process.stdout.write(`${dim}Обновление:${reset} v${current} → ${bold}v${latest}${reset}\n`)

  try {
    execSync(`npm install -g ${NPM_PACKAGE}@latest`, {
      stdio: 'inherit',
    })
    process.stdout.write(`\n${green}${bold}Обновлено до v${latest}${reset}\n`)
  } catch {
    process.stderr.write(`\n${yellow}Обновление не удалось. Попробуйте вручную: npm install -g ${NPM_PACKAGE}@latest${reset}\n`)
    process.exit(1)
  }
}
