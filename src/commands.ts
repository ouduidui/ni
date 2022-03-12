import { version } from '../package.json'
import { Agent, AGENTS, Command } from './agents'
import { exclude } from './utils'
import { Runner } from './runner'

// 获取命令行
export function getCommand(
  agent: Agent,
  command: Command,
  args: string[] = [],
) {
  if (!(agent in AGENTS))
    throw new Error(`Unsupported agent "${agent}"`)

  // 找到该适配器的命令
  const c = AGENTS[agent][command]

  // 如果是函数，直接执行
  if (typeof c === 'function')
    return c(args)

  if (!c)
    throw new Error(`Command "${command}" is not support by agent "${agent}"`)
  // 返回命令行
  return c.replace('{0}', args.join(' ')).trim()
}

// install命令
export const parseNi = <Runner>((agent, args, ctx) => {
  if (args.length === 1 && args[0] === '-v') {
    // eslint-disable-next-line no-console
    console.log(`@antfu/ni v${version}`)
    process.exit(0)
  }

  if (args.length === 0)
    return getCommand(agent, 'install')

  if (args.includes('-g'))
    return getCommand(agent, 'global', exclude(args, '-g'))

  if (args.length === 1 && args[0] === '-f')
    return getCommand(agent, 'install', args)

  if (args.includes('--frozen-if-present')) {
    args = exclude(args, '--frozen-if-present')
    return getCommand(agent, ctx?.hasLock ? 'frozen' : 'install', args)
  }

  if (args.includes('--frozen'))
    return getCommand(agent, 'frozen', exclude(args, '--frozen'))

  return getCommand(agent, 'add', args)
})

export const parseNr = <Runner>((agent, args) => {
  if (args.length === 0)
    args.push('start')

  if (args.includes('--if-present')) {
    args = exclude(args, '--if-present')
    args[0] = `--if-present ${args[0]}`
  }

  return getCommand(agent, 'run', args)
})

export const parseNu = <Runner>((agent, args) => {
  if (args.includes('-i'))
    return getCommand(agent, 'upgrade-interactive', exclude(args, '-i'))

  return getCommand(agent, 'upgrade', args)
})

export const parseNrm = <Runner>((agent, args) => {
  if (args.includes('-g'))
    return getCommand(agent, 'global_uninstall', exclude(args, '-g'))
  return getCommand(agent, 'uninstall', args)
})

export const parseNx = <Runner>((agent, args) => {
  return getCommand(agent, 'execute', args)
})
