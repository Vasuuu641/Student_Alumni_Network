// hooks/useAnimatedKeyboardHeight.ts
//
// Tracks live keyboard height via native show/hide events and exposes it as
// an Animated.Value, plus a plain boolean for "is the keyboard up right now".
//
// Replaces KeyboardAvoidingView for toolbar positioning: KAV's "padding"
// behavior only works reliably on iOS, and Android's adjustResize already
// resizes the window, so combining both caused either double-adjustment or
// (when KAV was disabled on Android) no adjustment for views outside the
// resized WebView, leaving the toolbar pinned below the keyboard.
//
// This hook sidesteps that entirely — same code path on both platforms,
// driven by the keyboard's own reported height + animation duration.

import { useEffect, useRef, useState } from 'react'
import { Animated, Keyboard, Platform, type KeyboardEvent } from 'react-native'

export function useAnimatedKeyboardHeight() {
  const heightAnim = useRef(new Animated.Value(0)).current
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // iOS: keyboardWill* fires before the keyboard finishes animating in,
    // so our Animated.timing can run in lockstep with the system animation.
    // Android: keyboardWill* isn't reliably available, so we use
    // keyboardDid* — it fires after the resize, but since we're not
    // depending on window resize for this layout, that's fine.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const onShow = (e: KeyboardEvent) => {
      setIsVisible(true)
      const toValue = e.endCoordinates?.height ?? 0
      const duration = e.duration && e.duration > 0 ? e.duration : 250
      Animated.timing(heightAnim, {
        toValue,
        duration,
        useNativeDriver: false, // marginBottom isn't a transform/opacity prop
      }).start()
    }

    const onHide = (e: KeyboardEvent) => {
      const duration = e?.duration && e.duration > 0 ? e.duration : 200
      Animated.timing(heightAnim, {
        toValue: 0,
        duration,
        useNativeDriver: false,
      }).start(() => {
        // Flip the visibility flag only after the collapse animation
        // finishes, so bottomInset doesn't snap back to insets.bottom while
        // the toolbar is still sliding down.
        setIsVisible(false)
      })
    }

    const showSub = Keyboard.addListener(showEvent, onShow)
    const hideSub = Keyboard.addListener(hideEvent, onHide)

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [heightAnim])

  return { heightAnim, isVisible }
}