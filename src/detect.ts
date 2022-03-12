import fs from 'fs'
import path from 'path'
import execa from 'execa'
import findUp from 'find-up'
import terminalLink from 'terminal-link'
import prompts from 'prompts'
import { LOCKS, INSTALL_PAGE, Agent, AGENTS } from './agents'
import { cmdExists } from './utils'

export interface DetectOptions {
  autoInstall?: boolean
  cwd?: string
}

// 判断当前项目的包管理工作
export async function detect({ autoInstall, cwd }: DetectOptions) {
  let agent: Agent | null = null

  // 找到项目下的lock文件
  const lockPath = await findUp(Object.keys(LOCKS), { cwd })
  let packageJsonPath: string | undefined

  if (lockPath)
    packageJsonPath = path.resolve(lockPath, '../package.json')
  else
    packageJsonPath = await findUp('package.json', { cwd })

  // read `packageManager` field in package.json
  // 读取package.json，判断是否有packageManager选项
  if (packageJsonPath && fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
      if (typeof pkg.packageManager === 'string') {
        const [name, version] = pkg.packageManager.split('@')
        if (name === 'yarn' && parseInt(version) > 1)
          agent = 'yarn@berry'
        else if (name in AGENTS)
          agent = name
        else
          console.warn('[ni] Unknown packageManager:', pkg.packageManager)
      }
    }
    catch {}
  }

  // detect based on lock
  // 如果package.json中没有packageManager选项，则通过lock文件判断包管理器
  if (!agent && lockPath)
    agent = LOCKS[path.basename(lockPath)]

  // auto install
  // 判断该包管理器是否存在
  if (agent && !cmdExists(agent.split('@')[0])) {
    if (!autoInstall) {
      console.warn(`[ni] Detected ${agent} but it doesn't seem to be installed.\n`)

      if (process.env.CI)
        process.exit(1)

      const link = terminalLink(agent, INSTALL_PAGE[agent])
      // 提问是否要尝试安装该包管理工具
      const { tryInstall } = await prompts({
        name: 'tryInstall',
        type: 'confirm',
        message: `Would you like to globally install ${link}?`,
      })
      if (!tryInstall)
        process.exit(1)
    }

    // 自动安装该包管理工具
    await execa.command(`npm i -g ${agent}`, { stdio: 'inherit', cwd })
  }

  return agent
}
