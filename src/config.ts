import fs from 'fs'
import path from 'path'
import ini from 'ini'
import findUp from 'find-up'
import { Agent, LOCKS } from './agents'

const customRcPath = process.env.NI_CONFIG_FILE

const home = process.platform === 'win32'
  ? process.env.USERPROFILE
  : process.env.HOME

const defaultRcPath = path.join(home || '~/', '.nirc')

const rcPath = customRcPath || defaultRcPath

interface Config {
  defaultAgent: Agent | 'prompt'
  globalAgent: Agent
}

const defaultConfig: Config = {
  defaultAgent: 'prompt',
  globalAgent: 'npm',
}

let config: Config | undefined

export async function getConfig(): Promise<Config> {
  if (!config) {
    // 向上递归找到package.json文件路径
    const result = await findUp('package.json') || ''
    let packageManager = ''
    if (result)
      packageManager = JSON.parse(fs.readFileSync(result, 'utf8')).packageManager ?? '' // 解析package.json中的packageManager选项
    const [, agent, version] = packageManager.match(new RegExp(`^(${Object.values(LOCKS).join('|')})@(\d).*?$`)) || []
    if (agent)
      config = Object.assign({}, defaultConfig, { defaultAgent: (agent === 'yarn' && parseInt(version) > 1) ? 'yarn@berry' : agent })
    else if (!fs.existsSync(rcPath))
      config = defaultConfig // 默认配置
    else
      config = Object.assign({}, defaultConfig, ini.parse(fs.readFileSync(rcPath, 'utf-8')))
  }
  return config
}

// 获取默认包管理器，通过package.json的packageManager选项判断，没有的话就返回npm
export async function getDefaultAgent() {
  const { defaultAgent } = await getConfig()
  if (defaultAgent === 'prompt' && process.env.CI)
    return 'npm'
  return defaultAgent
}

// 获取全局的包管理器
export async function getGlobalAgent() {
  const { globalAgent } = await getConfig()
  return globalAgent
}
