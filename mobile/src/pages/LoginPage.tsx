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
import type { RootStackParamList } from '../navigation/root-stack';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginPage({ navigation, route }: Props) {
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
      navigation.replace('Dashboard');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f4f7ff]">
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow px-4 pb-8 pt-4"
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => navigation.goBack()} className="self-start rounded-lg px-2 py-1.5">
            <Text className="text-sm font-semibold text-[#3a5fba]">← Back</Text>
          </Pressable>

          <View className="mt-4 items-center">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary">
              <FontAwesomeIcon icon={faBridge as IconProp} size={24} color="#ffffff" />
            </View>
            <Text className="mt-3 text-[30px] font-extrabold text-ink">Welcome back</Text>
            <Text className="mt-1 text-center text-sm text-muted">Sign in to continue to UniBridge</Text>
          </View>

          <View className="mt-6 rounded-3xl border border-[#dce5f8] bg-white p-4">
            {successMessage ? (
              <Text className="mb-3 rounded-xl bg-[#e9f8ef] px-3 py-2 text-sm font-medium text-[#20653a]">
                {successMessage}
              </Text>
            ) : null}

            {errorMessage ? (
              <Text className="mb-3 rounded-xl bg-[#ffecef] px-3 py-2 text-sm font-medium text-[#9c2f3f]">
                {errorMessage}
              </Text>
            ) : null}

            <Text className="mb-1 text-sm font-semibold text-[#344867]">Email address</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="neptun@tr.pte.hu"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              className="mb-3 rounded-xl border border-[#d8e1f3] bg-[#f9fbff] px-3 py-3 text-[15px] text-ink"
              placeholderTextColor="#7c8ba3"
            />

            <Text className="mb-1 text-sm font-semibold text-[#344867]">Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              autoCapitalize="none"
              autoComplete="current-password"
              secureTextEntry
              className="rounded-xl border border-[#d8e1f3] bg-[#f9fbff] px-3 py-3 text-[15px] text-ink"
              placeholderTextColor="#7c8ba3"
            />

            <Pressable
              onPress={handleSignIn}
              disabled={!canSubmit || isSubmitting}
              className={`mt-5 min-h-12 items-center justify-center rounded-xl px-4 ${
                !canSubmit || isSubmitting ? 'bg-[#98b4ff]' : 'bg-primary'
              }`}
            >
              <Text className="text-[15px] font-bold text-white">
                {isSubmitting ? 'Signing in...' : 'Sign in'}
              </Text>
            </Pressable>

            <Pressable className="mt-3 self-start">
              <Text className="text-sm font-semibold text-[#2d63e5]">Forgot your password?</Text>
            </Pressable>
          </View>

          <View className="mt-5 flex-row items-center justify-center">
            <Text className="text-sm text-muted">Don&apos;t have an account? </Text>
            <Pressable onPress={() => navigation.replace('Register')}>
              <Text className="text-sm font-bold text-[#2d63e5]">Create one</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
