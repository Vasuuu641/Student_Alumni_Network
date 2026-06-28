// hooks/useKeyboardHeight.ts
import { useEffect, useRef, useState } from 'react'
import { Keyboard, Platform, type KeyboardEvent } from 'react-native'

/**
 * Tracks live keyboard height via native show/hide/frame events.
 * Returns 0 when the keyboard is hidden.
 *
 * Android: uses keyboardDidShow/Hide — fires after the resize already
 * happened under `adjustResize`, which is fine since we're not relying on
 * window resize for layout, only reading the final height.
 *
 * iOS: uses keyboardWillShow/Hide so the toolbar animates in lockstep with
 * the keyboard instead of lagging a frame behind.
 */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0)
  // Mirrors `height` but read synchronously inside the duration-based
  // Animated tween below, avoiding a stale-closure read of `height`.
  const heightRef = useRef(0)

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const onShow = (e: KeyboardEvent) => {
      const h = e.endCoordinates?.height ?? 0
      heightRef.current = h
      setHeight(h)
    }
    const onHide = () => {
      heightRef.current = 0
      setHeight(0)
    }

    const showSub = Keyboard.addListener(showEvent, onShow)
    const hideSub = Keyboard.addListener(hideEvent, onHide)

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  return height
}