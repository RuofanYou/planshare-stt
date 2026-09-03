export const constants = {
  O_CREAT: 0,
  O_EXCL: 0,
  O_RDWR: 0,
}

function unsupported() {
  throw new Error('fs is unavailable in the browser')
}

export const unlinkSync = unsupported
export const renameSync = unsupported

export default {
  constants,
  unlinkSync,
  renameSync,
}
