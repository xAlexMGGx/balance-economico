/** Asks the browser not to evict the app's data when the device runs low on space. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    // Not supported or refused: the data still works, it is just not guaranteed to persist.
  }
}
