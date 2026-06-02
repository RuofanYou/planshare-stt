#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { describeCloudRunServer } from './cloudbase-runtime.mjs'

const command = process.argv[2]

if (command !== 'preflight') {
  console.error('用法：node scripts/cloudrun-persistent.mjs preflight')
  process.exit(1)
}

const detail = describeCloudRunServer()
const config = JSON.parse(readFileSync('cloudbaserc.json', 'utf8'))
const serverConfig = detail.ServerConfig
const envParams = JSON.parse(serverConfig.EnvParams || '{}')
const frameworkInputs = config.framework?.plugins?.server?.inputs ?? {}

console.log(JSON.stringify({
  remote: {
    serviceName: serverConfig.ServerName,
    cpu: serverConfig.Cpu,
    mem: serverConfig.Mem,
    minNum: serverConfig.MinNum,
    maxNum: serverConfig.MaxNum,
    port: serverConfig.Port,
    hasAdminPassword: Boolean(envParams.ADMIN_PASSWORD),
    databasePath: envParams.DATABASE_PATH ?? null,
    volumes: serverConfig.VolumesConf ?? [],
  },
  expected: {
    mode: frameworkInputs.mode,
    cpu: frameworkInputs.cpu,
    mem: frameworkInputs.mem,
    minNum: frameworkInputs.minNum,
    maxNum: frameworkInputs.maxNum,
    databasePath: frameworkInputs.envVariables?.DATABASE_PATH,
    volumeMounts: frameworkInputs.volumeMounts,
  },
  note: '本地 CloudBase Framework CLI 暂不支持可靠创建/挂载 CFS addon；先在控制台创建 planshare-data 并挂载 /data，再执行数据回灌。',
}, null, 2))
