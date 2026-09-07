import { useMemo, useState, useEffect } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  BackHandler,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faBridge } from '@fortawesome/free-solid-svg-icons';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { requestPasswordReset } from '../api/auth.api';
import type { RootStackParamList } from '../navigation/root-stack';
import { useTheme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export function ForgotPasswordPage({ navigation }: Props) {
  const { tokens } = useTheme();
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => email.trim().length > 0, [email]);

  async function handleSubmit() {
    if (!canSubmit || isSubmitting) {
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await requestPasswordReset({ email });
      navigation.replace('ResetPassword', { email });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to send reset code.');
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    const onBackPress = () => {
      try {
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('Login');
        }
      } catch (e) {
        navigation.navigate('Login');
      }
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [navigation]);

  const inputStyle = {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: tokens.text,
  };

  const labelStyle = {
    marginBottom: 4,
    fontSize: 14,
    fontWeight: '600' as const,
    color: tokens.muted,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.background }}>
      <StatusBar style={tokens.name === 'midnight' ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingBottom: 32, paddingTop: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            onPress={() => {
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.navigate('Login');
            }}
            style={{ alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.primaryStrong }}>← Back</Text>
          </Pressable>

          <View style={{ marginTop: 16, alignItems: 'center' }}>
            <View style={{ height: 56, width: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: tokens.primary }}>
              <FontAwesomeIcon icon={faBridge as IconProp} size={24} color="#ffffff" />
            </View>
            <Text style={{ marginTop: 12, fontSize: 30, fontWeight: '800', color: tokens.text }}>Forgot your password?</Text>
            <Text style={{ marginTop: 4, textAlign: 'center', fontSize: 14, color: tokens.muted }}>
              Enter your email and we'll send you a reset code
            </Text>
          </View>

          <View style={{ marginTop: 24, borderRadius: 24, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, padding: 16 }}>
            {errorMessage ? (
              <Text style={{ marginBottom: 12, borderRadius: 12, backgroundColor: tokens.name === 'midnight' ? '#3a1a1e' : '#ffecef', paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, fontWeight: '500', color: tokens.danger }}>
                {errorMessage}
              </Text>
            ) : null}

            <Text style={labelStyle}>Email address</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="neptun@tr.pte.hu"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              style={inputStyle}
              placeholderTextColor={tokens.muted}
            />

            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              style={{
                marginTop: 12,
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                paddingHorizontal: 16,
                backgroundColor: !canSubmit || isSubmitting ? tokens.primarySoft : tokens.primary,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: !canSubmit || isSubmitting ? tokens.primary : '#fff' }}>
                {isSubmitting ? 'Sending...' : 'Send reset code'}
              </Text>
            </Pressable>
          </View>

          <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 14, color: tokens.muted }}>Remembered your password? </Text>
            <Pressable onPress={() => navigation.replace('Login')}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.primary }}>Sign in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}