export function execSync() {
  throw new Error('child_process is unavailable in the browser')
}

export default {
  execSync,
}
