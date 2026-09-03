import { execFileSync } from 'node:child_process'

export const ENV_ID = 'planshare-d4gi9p3web9f2c235'
export const SERVICE_NAME = 'planshare'
export const API_BASE = 'https://planshare-264988-8-1387201447.sh.run.tcloudbase.com'

export function describeCloudRunServer() {
  const raw = execFileSync('tcb', [
    'api',
    'tcbr',
    'DescribeCloudRunServerDetail',
    '--api-version',
    '2022-02-17',
    '--body',
    JSON.stringify({ EnvId: ENV_ID, ServerName: SERVICE_NAME }),
    '--json',
  ], { encoding: 'utf8' })
  return JSON.parse(raw.slice(raw.indexOf('{'))).data
}

export function getRemoteEnvParams() {
  const detail = describeCloudRunServer()
  return JSON.parse(detail.ServerConfig.EnvParams || '{}')
}

export function getAdminPassword() {
  const envParams = getRemoteEnvParams()
  if (!envParams.ADMIN_PASSWORD) {
    throw new Error('远端未配置 ADMIN_PASSWORD，无法自动导出/导入/部署')
  }
  return envParams.ADMIN_PASSWORD
}
