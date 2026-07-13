<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
// Reusable custom overlay scrollbar. Give it the scroll element (`view`, a div OR a
// <textarea>); it renders a thumb that is hidden until the scroll area is hovered and is
// drag-scrollable. Used app-wide instead of native ::-webkit-scrollbar, whose state-driven
// styling (reveal-on-hover) is unreliable in the app's WKWebView (see CLAUDE.md).
//
// Consumer contract: the `view` must sit in a `position:relative` wrapper, and this
// component must be a SIBLING of the view inside that same wrapper (so the thumb positions
// over the view and the wrapper is the hover zone). The view carries `.no-native-scrollbar`.
const props = defineProps<{ view: HTMLElement | null }>()
const thumb = ref({ h: 0, top: 0, visible: false })
const hovered = ref(false)
const dragging = ref(false)
let dragScroll = 0, dragY = 0
let ro: ResizeObserver | null = null
let mo: MutationObserver | null = null
let host: HTMLElement | null = null

function update() {
  const el = props.view
  if (!el) { thumb.value = { h: 0, top: 0, visible: false }; return }
  const { scrollHeight, clientHeight, scrollTop } = el
  if (scrollHeight <= clientHeight + 1) { thumb.value = { h: 0, top: 0, visible: false }; return }
  const h = Math.max(24, (clientHeight / scrollHeight) * clientHeight)
  const maxTop = clientHeight - h
  const top = maxTop <= 0 ? 0 : (scrollTop / (scrollHeight - clientHeight)) * maxTop
  thumb.value = { h, top, visible: true }
}
function onDown(e: PointerEvent) {
  if (!props.view) return
  dragging.value = true; dragY = e.clientY; dragScroll = props.view.scrollTop
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  e.preventDefault(); e.stopPropagation()
}
function onMove(e: PointerEvent) {
  if (!dragging.value || !props.view) return
  const el = props.view
  const maxTop = el.clientHeight - thumb.value.h
  if (maxTop <= 0) return
  el.scrollTop = dragScroll + ((e.clientY - dragY) / maxTop) * (el.scrollHeight - el.clientHeight)
}
function onUp(e: PointerEvent) {
  dragging.value = false
  try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* ignore */ }
}
const onEnter = () => { hovered.value = true }
const onLeave = () => { hovered.value = false }
function attach(el: HTMLElement) {
  el.addEventListener('scroll', update, { passive: true })
  el.addEventListener('input', update) // textareas: typing changes scrollHeight w/o a DOM mutation
  ro = new ResizeObserver(update); ro.observe(el)
  mo = new MutationObserver(update); mo.observe(el, { childList: true, subtree: true, characterData: true })
  host = el.parentElement
  host?.addEventListener('pointerenter', onEnter)
  host?.addEventListener('pointerleave', onLeave)
  update()
}
function detach(el: HTMLElement) {
  el.removeEventListener('scroll', update)
  el.removeEventListener('input', update)
  ro?.disconnect(); ro = null
  mo?.disconnect(); mo = null
  host?.removeEventListener('pointerenter', onEnter)
  host?.removeEventListener('pointerleave', onLeave)
  host = null
}
onMounted(() => { if (props.view) attach(props.view) })
watch(() => props.view, (el, old) => { if (old) detach(old); if (el) attach(el) })
onBeforeUnmount(() => { if (props.view) detach(props.view) })
</script>
<template>
  <div v-if="thumb.visible" class="osb-thumb" :class="{ show: hovered || dragging, dragging }" data-overlay-thumb
    :style="{ height: thumb.h + 'px', transform: `translateY(${thumb.top}px)` }"
    @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" />
</template>
<style scoped>
/* Hidden (and non-interactive) until the scroll area is hovered; violet while active. */
.osb-thumb{position:absolute;top:0;right:1px;width:6px;border-radius:3px;background:var(--up-border-strong);
  opacity:0;pointer-events:none;transition:opacity .15s;cursor:grab;touch-action:none;will-change:transform;z-index:6}
.osb-thumb.show{opacity:1;pointer-events:auto}
.osb-thumb:hover,.osb-thumb.dragging{background:var(--up-violet)}
.osb-thumb.dragging{cursor:grabbing}
</style>
