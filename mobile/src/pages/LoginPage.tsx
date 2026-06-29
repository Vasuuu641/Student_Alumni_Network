import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faBridge } from '@fortawesome/free-solid-svg-icons';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { loginUser } from '../api/auth.api';
import { storeTokens, storeUserEmail } from '../lib/auth-storage';
import { getRoleFromAccessToken } from '../lib/jwt';
import type { RootStackParamList } from '../navigation/root-stack';
import { useTheme, useThemePicker } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginPage({ navigation, route }: Props) {
  const { tokens } = useTheme();
  const { openThemePicker } = useThemePicker();
  const [email, setEmail] = useState(route.params?.registeredEmail ?? '');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState(
    route.params?.registeredEmail ? 'Account created successfully. Please sign in.' : '',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(
    () => email.trim().length > 0 && password.trim().length >= 6,
    [email, password],
  );

  async function handleSignIn() {
    if (!canSubmit || isSubmitting) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const response = await loginUser({ email, password });
      await storeTokens(response.accessToken, response.refreshToken);
      await storeUserEmail(email.trim().toLowerCase());
      navigation.replace(getRoleFromAccessToken(response.accessToken) === 'ADMIN' ? 'AdminLayout' : 'Dashboard');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  }

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
          <Pressable onPress={() => navigation.goBack()} style={{ alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.primaryStrong }}>← Back</Text>
          </Pressable>

          <Pressable onPress={openThemePicker} style={{ marginTop: 8, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2, color: tokens.primary }}>Theme</Text>
          </Pressable>

          <View style={{ marginTop: 16, alignItems: 'center' }}>
            <View style={{ height: 56, width: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: tokens.primary }}>
              <FontAwesomeIcon icon={faBridge as IconProp} size={24} color="#ffffff" />
            </View>
            <Text style={{ marginTop: 12, fontSize: 30, fontWeight: '800', color: tokens.text }}>Welcome back</Text>
            <Text style={{ marginTop: 4, textAlign: 'center', fontSize: 14, color: tokens.muted }}>Sign in to continue to UniBridge</Text>
          </View>

          <View style={{ marginTop: 24, borderRadius: 24, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, padding: 16 }}>
            {successMessage ? (
              <Text style={{ marginBottom: 12, borderRadius: 12, backgroundColor: tokens.name === 'midnight' ? '#0d2e1e' : '#e9f8ef', paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, fontWeight: '500', color: tokens.success }}>
                {successMessage}
              </Text>
            ) : null}

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

            <Text style={labelStyle}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              autoCapitalize="none"
              autoComplete="current-password"
              secureTextEntry
              style={inputStyle}
              placeholderTextColor={tokens.muted}
            />

            <Pressable
              onPress={handleSignIn}
              disabled={!canSubmit || isSubmitting}
              style={{
                marginTop: 20,
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                paddingHorizontal: 16,
                backgroundColor: !canSubmit || isSubmitting ? tokens.primarySoft : tokens.primary,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: !canSubmit || isSubmitting ? tokens.primary : '#fff' }}>
                {isSubmitting ? 'Signing in...' : 'Sign in'}
              </Text>
            </Pressable>

            <Pressable style={{ marginTop: 12, alignSelf: 'flex-start' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.primary }}>Forgot your password?</Text>
            </Pressable>
          </View>

          <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 14, color: tokens.muted }}>Don't have an account? </Text>
            <Pressable onPress={() => navigation.replace('Register')}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.primary }}>Create one</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
