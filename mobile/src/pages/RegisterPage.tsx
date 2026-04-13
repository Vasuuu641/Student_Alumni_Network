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
import { registerUser } from '../api/auth.api';
import type { RootStackParamList } from '../navigation/root-stack';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export function RegisterPage({ navigation }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(
    () =>
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      email.trim().length > 0 &&
      password.trim().length >= 6,
    [firstName, lastName, email, password],
  );

  async function handleCreateAccount() {
    if (!canSubmit || isSubmitting) {
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await registerUser({
        firstName,
        lastName,
        email,
        password,
      });
      navigation.replace('Login', { registeredEmail: email });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to create account.');
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
            <Text className="mt-3 text-[30px] font-extrabold text-ink">Join UniBridge</Text>
            <Text className="mt-1 text-center text-sm text-muted">
              Create your profile with your university email
            </Text>
          </View>

          <View className="mt-6 rounded-3xl border border-[#dce5f8] bg-white p-4">
            {errorMessage ? (
              <Text className="mb-3 rounded-xl bg-[#ffecef] px-3 py-2 text-sm font-medium text-[#9c2f3f]">
                {errorMessage}
              </Text>
            ) : null}

            <Text className="mb-1 text-sm font-semibold text-[#344867]">First name</Text>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="John"
              autoComplete="name-given"
              className="mb-3 rounded-xl border border-[#d8e1f3] bg-[#f9fbff] px-3 py-3 text-[15px] text-ink"
              placeholderTextColor="#7c8ba3"
              maxLength={50}
            />

            <Text className="mb-1 text-sm font-semibold text-[#344867]">Last name</Text>
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="Doe"
              autoComplete="name-family"
              className="mb-3 rounded-xl border border-[#d8e1f3] bg-[#f9fbff] px-3 py-3 text-[15px] text-ink"
              placeholderTextColor="#7c8ba3"
              maxLength={50}
            />

            <Text className="mb-1 text-sm font-semibold text-[#344867]">University email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="neptun@tr.pte.hu"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              className="rounded-xl border border-[#d8e1f3] bg-[#f9fbff] px-3 py-3 text-[15px] text-ink"
              placeholderTextColor="#7c8ba3"
            />
            <Text className="mb-3 mt-1 text-xs text-[#5f7290]">
              Only pre-approved university emails can register
            </Text>

            <Text className="mb-1 text-sm font-semibold text-[#344867]">Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Create a password"
              autoCapitalize="none"
              autoComplete="new-password"
              secureTextEntry
              className="rounded-xl border border-[#d8e1f3] bg-[#f9fbff] px-3 py-3 text-[15px] text-ink"
              placeholderTextColor="#7c8ba3"
            />

            <Pressable
              onPress={handleCreateAccount}
              disabled={!canSubmit || isSubmitting}
              className={`mt-5 min-h-12 items-center justify-center rounded-xl px-4 ${
                !canSubmit || isSubmitting ? 'bg-[#98b4ff]' : 'bg-primary'
              }`}
            >
              <Text className="text-[15px] font-bold text-white">
                {isSubmitting ? 'Creating account...' : 'Create Account'}
              </Text>
            </Pressable>
          </View>

          <View className="mt-5 flex-row items-center justify-center">
            <Text className="text-sm text-muted">Already have an account? </Text>
            <Pressable onPress={() => navigation.replace('Login')}>
              <Text className="text-sm font-bold text-[#2d63e5]">Sign in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
