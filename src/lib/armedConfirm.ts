import { ref } from 'vue'

// "Click once to arm, click again to confirm" for destructive/irreversible actions.
// The armed key auto-clears after `timeoutMs` so a stray first click is harmless.
export function useArmedConfirm(timeoutMs = 2500) {
  const armed = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined
  function reset() { armed.value = null; if (timer) clearTimeout(timer) }
  // First click on `key` arms it; a second click on the SAME key runs and resets.
  // Clicking a different key re-arms to that key instead.
  function confirm(key: string, run: () => void) {
    if (armed.value === key) { reset(); run(); return }
    if (timer) clearTimeout(timer)
    armed.value = key
    timer = setTimeout(() => { armed.value = null }, timeoutMs)
  }
  return { armed, confirm, reset }
}
