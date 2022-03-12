import { resolve } from 'path'
import prompts from 'prompts'
import execa from 'execa'
import { Agent, agents } from './agents'
import { getDefaultAgent, getGlobalAgent } from './config'
import { detect, DetectOptions } from './detect'
import { remove, getVoltaPrefix } from './utils'

const DEBUG_SIGN = '?'

export interface RunnerContext {
  hasLock?: boolean
  cwd?: string
}

export type Runner = (agent: Agent, args: string[], ctx?: RunnerContext) => Promise<string | undefined> | string | undefined

// 执行CLI
export async function runCli(fn: Runner, options: DetectOptions = {}) {
  // process.argv：返回一个数组，成员是当前进程的所有命令行参数
  // 其中 process.argv 的第一和第二个元素是Node可执行文件和被执行JavaScript文件的完全限定的文件系统路径，无论你是否这样输入他们
  const args = process.argv.slice(2).filter(Boolean)
  try {
    await run(fn, args, options)
  }
  catch (error) {
    // 结束进程
    process.exit(1)
  }
}

// 执行动作
export async function run(fn: Runner, args: string[], options: DetectOptions = {}) {
  const debug = args.includes(DEBUG_SIGN)
  // 调试模式
  if (debug)
    remove(args, DEBUG_SIGN)

  // cwd 方法返回进程的当前目录（绝对路径）
  let cwd = process.cwd()
  let command

  // 指定路径
  if (args[0] === '-C') {
    cwd = resolve(cwd, args[1])
    args.splice(0, 2)
  }

  // 全局安装
  const isGlobal = args.includes('-g')
  if (isGlobal) {
    command = await fn(await getGlobalAgent(), args)
  }
  else {
    // 获取当前的包管理器，如果找不到则使用默认的
    let agent = await detect({ ...options, cwd }) || await getDefaultAgent()
    if (agent === 'prompt') {
      agent = (await prompts({
        name: 'agent',
        type: 'select',
        message: 'Choose the agent',
        choices: agents.filter(i => !i.includes('@')).map(value => ({ title: value, value })),
      })).agent
      if (!agent)
        return
    }
    // 调用解析函数，传入包管理器，生成对应的命令行
    command = await fn(agent as Agent, args, {
      hasLock: Boolean(agent),
      cwd,
    })
  }

  if (!command)
    return

  const voltaPrefix = getVoltaPrefix()
  if (voltaPrefix)
    command = voltaPrefix.concat(' ').concat(command)

  if (debug) {
    // eslint-disable-next-line no-console
    console.log(command)
    return
  }

  // 执行命令行
  await execa.command(command, { stdio: 'inherit', encoding: 'utf-8', cwd })
}
