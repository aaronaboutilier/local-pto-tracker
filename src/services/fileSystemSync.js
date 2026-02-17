const FILE_PICKER_TYPES = [
  {
    description: 'PTO Tracker Backup',
    accept: {
      'application/json': ['.json'],
    },
  },
]
const DEFAULT_SYNC_FILE_NAME = 'pto-sync.json'
const FILE_SYNC_DB_NAME = 'local-pto-file-sync'
const FILE_SYNC_DB_VERSION = 1
const FILE_SYNC_STORE_NAME = 'handles'
const FILE_SYNC_HANDLE_KEY = 'primary'

function getSupportSnapshot() {
  const hasWindow = typeof window !== 'undefined'
  const secureContext = hasWindow ? Boolean(window.isSecureContext) : false
  const hasSaveFilePicker = hasWindow && typeof window.showSaveFilePicker === 'function'
  const hasOpenFilePicker = hasWindow && typeof window.showOpenFilePicker === 'function'
  const supported = secureContext && (hasSaveFilePicker || hasOpenFilePicker)

  let message = ''
  if (!secureContext) {
    message = 'File sync requires a secure context (HTTPS or localhost).'
  } else if (!hasSaveFilePicker && !hasOpenFilePicker) {
    message = 'File sync is not available in this browser profile.'
  }

  return {
    supported,
    message,
    hasSaveFilePicker,
    hasOpenFilePicker,
  }
}

function normalizeError(error, fallbackMessage) {
  const name = error?.name || ''

  if (name === 'AbortError') {
    return new Error('File selection was canceled.')
  }

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new Error('Permission denied for selected file.')
  }

  return new Error(error?.message || fallbackMessage)
}

export function canUseFileSystemSync() {
  return getSupportSnapshot().supported
}

export function getFileSystemSyncSupportMessage() {
  return getSupportSnapshot().message
}

function openFileSyncDb() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(FILE_SYNC_DB_NAME, FILE_SYNC_DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(FILE_SYNC_STORE_NAME)) {
        db.createObjectStore(FILE_SYNC_STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('Unable to open sync storage.'))
  })
}

function runDbWrite(operation) {
  return openFileSyncDb().then((db) =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(FILE_SYNC_STORE_NAME, 'readwrite')
      const store = tx.objectStore(FILE_SYNC_STORE_NAME)
      operation(store)

      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        db.close()
        reject(new Error('Unable to update sync storage.'))
      }
      tx.onabort = () => {
        db.close()
        reject(new Error('Sync storage update was aborted.'))
      }
    }),
  )
}

function runDbRead(operation) {
  return openFileSyncDb().then((db) =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(FILE_SYNC_STORE_NAME, 'readonly')
      const store = tx.objectStore(FILE_SYNC_STORE_NAME)
      const request = operation(store)

      request.onsuccess = () => {
        db.close()
        resolve(request.result || null)
      }
      request.onerror = () => {
        db.close()
        reject(new Error('Unable to read sync storage.'))
      }
    }),
  )
}

export async function persistSyncFileHandle(fileHandle) {
  if (!fileHandle) {
    throw new Error('Cannot persist an empty file handle.')
  }

  await runDbWrite((store) => {
    store.put(fileHandle, FILE_SYNC_HANDLE_KEY)
  })
}

export async function loadPersistedSyncFileHandle() {
  return runDbRead((store) => store.get(FILE_SYNC_HANDLE_KEY))
}

export async function clearPersistedSyncFileHandle() {
  await runDbWrite((store) => {
    store.delete(FILE_SYNC_HANDLE_KEY)
  })
}

export async function hasFileReadWritePermission(fileHandle) {
  if (!fileHandle || typeof fileHandle.queryPermission !== 'function') {
    return false
  }

  try {
    const permission = await fileHandle.queryPermission({ mode: 'readwrite' })
    return permission === 'granted'
  } catch {
    return false
  }
}

export async function ensureFileReadPermission(fileHandle) {
  if (!fileHandle || typeof fileHandle.queryPermission !== 'function') {
    return false
  }

  try {
    const current = await fileHandle.queryPermission({ mode: 'read' })
    if (current === 'granted') {
      return true
    }

    if (typeof fileHandle.requestPermission !== 'function') {
      return false
    }

    const requested = await fileHandle.requestPermission({ mode: 'read' })
    return requested === 'granted'
  } catch {
    return false
  }
}

export async function ensureFileReadWritePermission(fileHandle) {
  if (!fileHandle || typeof fileHandle.queryPermission !== 'function') {
    return false
  }

  try {
    const current = await fileHandle.queryPermission({ mode: 'readwrite' })
    if (current === 'granted') {
      return true
    }

    if (typeof fileHandle.requestPermission !== 'function') {
      return false
    }

    const requested = await fileHandle.requestPermission({ mode: 'readwrite' })
    return requested === 'granted'
  } catch {
    return false
  }
}

export async function openBackupFileForSync(defaultFileName = DEFAULT_SYNC_FILE_NAME) {
  const support = getSupportSnapshot()
  if (!support.supported) {
    throw new Error(support.message || 'File system sync is not supported in this browser.')
  }

  try {
    if (support.hasSaveFilePicker) {
      return await window.showSaveFilePicker({
        suggestedName: defaultFileName,
        types: FILE_PICKER_TYPES,
        excludeAcceptAllOption: false,
      })
    }

    const [fileHandle] = await window.showOpenFilePicker({
      multiple: false,
      types: FILE_PICKER_TYPES,
      excludeAcceptAllOption: false,
    })

    if (!fileHandle) {
      throw new Error('No file was selected.')
    }

    return fileHandle
  } catch (error) {
    throw normalizeError(error, 'Unable to select a backup file.')
  }
}

export async function openExistingBackupFileForRestore() {
  const support = getSupportSnapshot()
  if (!support.supported) {
    throw new Error(support.message || 'File system sync is not supported in this browser.')
  }

  if (!support.hasOpenFilePicker) {
    throw new Error('This browser profile cannot open an existing file directly for restore.')
  }

  try {
    const [fileHandle] = await window.showOpenFilePicker({
      multiple: false,
      types: FILE_PICKER_TYPES,
      excludeAcceptAllOption: false,
    })

    if (!fileHandle) {
      throw new Error('No file was selected.')
    }

    return fileHandle
  } catch (error) {
    throw normalizeError(error, 'Unable to select a backup file to restore.')
  }
}

export async function writeBackupPayloadToFile(fileHandle, payload) {
  if (!fileHandle) {
    throw new Error('No file selected for sync.')
  }

  try {
    const writable = await fileHandle.createWritable()
    await writable.write(JSON.stringify(payload, null, 2))
    await writable.close()
  } catch (error) {
    throw normalizeError(error, 'Unable to write backup file.')
  }
}

export async function readBackupPayloadFromFile(fileHandle) {
  if (!fileHandle) {
    throw new Error('No file selected for restore.')
  }

  try {
    const file = await fileHandle.getFile()
    const text = await file.text()
    if (!text.trim()) {
      throw new Error('Selected sync file is empty.')
    }

    return JSON.parse(text)
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Sync file is not valid JSON.')
    }

    throw normalizeError(error, 'Unable to read backup file.')
  }
}
