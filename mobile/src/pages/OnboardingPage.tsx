import { useEffect, useMemo, useState } from 'react';
import {
  Image,
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
import {
  faArrowLeft,
  faBridge,
  faChevronLeft,
  faImage,
  faPlus,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { getOnboardingProfile, updateOnboardingProfile } from '../api/onboarding.api';
import { getValidAccessToken } from '../lib/auth-session';
import { getRoleFromAccessToken, type UserRole } from '../lib/jwt';
import type { RootStackParamList } from '../navigation/root-stack';
import { useTheme, useThemePicker } from '../theme/theme';

type EditableRole = Exclude<UserRole, 'ADMIN'>;

type OnboardingFormState = {
  firstName: string;
  lastName: string;
  major: string;
  yearOfGraduation: string;
  company: string;
  jobTitle: string;
  faculty: string;
  bio: string;
  interests: string[];
  isAnonymous: boolean;
  anonymousName: string;
};

const initialState: OnboardingFormState = {
  firstName: '',
  lastName: '',
  major: '',
  yearOfGraduation: '',
  company: '',
  jobTitle: '',
  faculty: '',
  bio: '',
  interests: [],
  isAnonymous: false,
  anonymousName: '',
};

const TOTAL_STEPS = 4;

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export function OnboardingPage({ navigation, route }: Props) {
  const { tokens } = useTheme();
  const { openThemePicker } = useThemePicker();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [role, setRole] = useState<EditableRole | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(route.params?.step ?? 1);
  const [form, setForm] = useState<OnboardingFormState>(initialState);
  const [interestInput, setInterestInput] = useState('');
  const [profilePicture, setProfilePicture] = useState<{ uri: string; name: string; type: string } | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const progressPercent = Math.round((currentStep / TOTAL_STEPS) * 100);
  const roleTitle = role ? role.charAt(0) + role.slice(1).toLowerCase() : 'Student';
  const isEditMode = route.params?.mode === 'edit';

  useEffect(() => {
    if (!route.params?.step) {
      return;
    }

    if (Number.isInteger(route.params.step) && route.params.step >= 1 && route.params.step <= TOTAL_STEPS) {
      setCurrentStep(route.params.step);
    }
  }, [route.params?.step]);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      const token = await getValidAccessToken();
      if (cancelled) {
        return;
      }

      if (!token) {
        navigation.replace('Login');
        return;
      }

      const roleFromToken = getRoleFromAccessToken(token);
      if (!roleFromToken || roleFromToken === 'ADMIN') {
        navigation.replace(roleFromToken === 'ADMIN' ? 'Dashboard' : 'Login');
        return;
      }

      setAccessToken(token);
      setRole(roleFromToken);
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [navigation]);

  useEffect(() => {
    const activeToken = accessToken;
    const activeRole = role;

    if (activeToken == null || activeRole == null) {
      return;
    }

    const token: string = activeToken;
    const currentRole: EditableRole = activeRole;

    let cancelled = false;

    async function loadProfile() {
      setIsLoadingProfile(true);
      try {
        const profile = await getOnboardingProfile(token, currentRole);

        if (cancelled) {
          return;
        }

        const hasExistingProfile =
          Boolean(profile.bio?.trim()) ||
          Boolean(profile.major?.trim()) ||
          Boolean(profile.faculty?.trim()) ||
          (profile.interests?.length ?? 0) > 0 ||
          Boolean(profile.company?.trim());

        if (hasExistingProfile && !isEditMode) {
          navigation.replace('Dashboard');
          return;
        }

        setForm({
          firstName: profile.firstName ?? '',
          lastName: profile.lastName ?? '',
          major: profile.major ?? '',
          yearOfGraduation:
            profile.yearOfGraduation !== undefined && profile.yearOfGraduation !== null
              ? String(profile.yearOfGraduation)
              : profile.yearofGraduation !== undefined && profile.yearofGraduation !== null
                ? String(profile.yearofGraduation)
                : '',
          company: profile.company ?? '',
          jobTitle: profile.jobTitle ?? '',
          faculty: profile.faculty ?? '',
          bio: profile.bio ?? '',
          interests: profile.interests ?? [],
          isAnonymous: Boolean(profile.isAnonymous),
          anonymousName: profile.anonymousName ?? '',
        });
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load current profile data.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProfile(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [accessToken, isEditMode, navigation, role]);

  function setField<K extends keyof OnboardingFormState>(key: K, value: OnboardingFormState[K]) {
    setSuccessMessage('');
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function nextStep() {
    setCurrentStep((previous) => Math.min(TOTAL_STEPS, previous + 1));
  }

  function previousStep() {
    setCurrentStep((previous) => Math.max(1, previous - 1));
  }

  function goToStep(step: number) {
    setCurrentStep(Math.max(1, Math.min(TOTAL_STEPS, step)));
  }

  async function handlePictureSelection() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage('Permission to access photos is required to upload a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 900 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );

      setProfilePicture({
        uri: manipulated.uri,
        name: 'profile.jpg',
        type: 'image/jpeg',
      });
      setSuccessMessage('');
    } catch {
      setErrorMessage('Unable to choose a profile picture.');
    }
  }

  async function handleSubmit() {
    const activeToken = accessToken;
    const activeRole = role;

    if (activeToken == null || activeRole == null) {
      return;
    }

    const token: string = activeToken;
    const currentRole: EditableRole = activeRole;

    if (currentStep !== TOTAL_STEPS) {
      return;
    }

    if (currentRole === 'ALUMNI' && form.isAnonymous && !form.anonymousName.trim()) {
      setErrorMessage('Anonymous nickname is required when anonymous mode is enabled.');
      setCurrentStep(3);
      return;
    }

    const payload: Record<string, unknown> = {};

    if (form.firstName.trim()) payload.firstName = form.firstName.trim();
    if (form.lastName.trim()) payload.lastName = form.lastName.trim();
    if (form.bio.trim()) payload.bio = form.bio.trim();
    if (form.interests.length > 0) payload.interests = form.interests;

    if (currentRole === 'ALUMNI') {
      if (form.yearOfGraduation.trim()) payload.yearOfGraduation = Number(form.yearOfGraduation);
      if (form.major.trim()) payload.major = form.major.trim();
      if (form.company.trim()) payload.company = form.company.trim();
      if (form.jobTitle.trim()) payload.jobTitle = form.jobTitle.trim();
      payload.isAnonymous = form.isAnonymous;
      if (form.isAnonymous && form.anonymousName.trim()) {
        payload.anonymousName = form.anonymousName.trim();
      }
    }

    if (currentRole === 'STUDENT') {
      if (form.major.trim()) payload.major = form.major.trim();
      if (form.yearOfGraduation.trim()) payload.yearOfGraduation = Number(form.yearOfGraduation);
      if (form.faculty.trim()) payload.faculty = form.faculty.trim();
      if (form.jobTitle.trim()) payload.jobTitle = form.jobTitle.trim();
      if (form.company.trim()) payload.company = form.company.trim();
    }

    if (currentRole === 'PROFESSOR') {
      if (form.faculty.trim()) payload.faculty = form.faculty.trim();
      if (form.jobTitle.trim()) payload.jobTitle = form.jobTitle.trim();
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      await updateOnboardingProfile({
        token,
        role: currentRole,
        payload,
        profilePicture,
      });
      setSuccessMessage('Profile saved. Continue to dashboard when you are ready.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save onboarding information.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function addInterest() {
    const trimmed = interestInput.trim().replace(/,+$/, '');
    if (!trimmed) {
      return;
    }
    if (!form.interests.includes(trimmed)) {
      setField('interests', [...form.interests, trimmed]);
    }
    setInterestInput('');
  }

  if (!accessToken || !role) {
    return null;
  }

  if (isLoadingProfile) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.background }}>
        <StatusBar style={tokens.name === 'midnight' ? 'light' : 'dark'} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Text style={{ color: tokens.muted, fontSize: 16, fontWeight: '600' }}>Loading your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const stepTitle =
    currentStep === 1 ? 'Tell us about yourself' :
    currentStep === 2 ? 'Academic information' :
    currentStep === 3 ? 'Interests, media, and privacy' :
    'Review and finish';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.background }}>
      <StatusBar style={tokens.name === 'midnight' ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingBottom: 40, paddingTop: 12 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <FontAwesomeIcon icon={faChevronLeft as any} size={14} color={tokens.primaryStrong} />
              <Text style={{ color: tokens.primaryStrong, fontSize: 14, fontWeight: '700' }}>
                {isEditMode ? 'Back' : 'Skip'}
              </Text>
            </Pressable>

            <Pressable onPress={openThemePicker} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: tokens.primarySoft }}>
              <Text style={{ color: tokens.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' }}>
                Theme
              </Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: tokens.primary, alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesomeIcon icon={faBridge as any} size={24} color="#ffffff" />
            </View>
          </View>

          <View
            style={{
              borderRadius: 28,
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: tokens.surface,
              padding: 16,
              shadowColor: tokens.primaryStrong,
              shadowOpacity: 0.08,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 10 },
              elevation: 3,
            }}
          >
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: tokens.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' }}>
                {`Step ${currentStep} of ${TOTAL_STEPS}`}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ color: tokens.text, fontSize: 20, fontWeight: '800' }}>{stepTitle}</Text>
                <Text style={{ color: tokens.primary, fontSize: 12, fontWeight: '700' }}>{progressPercent}%</Text>
              </View>
              <View style={{ height: 8, borderRadius: 999, backgroundColor: tokens.primarySoft, overflow: 'hidden', marginTop: 12 }}>
                <View style={{ height: '100%', width: `${progressPercent}%`, borderRadius: 999, backgroundColor: tokens.primary }} />
              </View>
            </View>

            {errorMessage ? (
              <Text style={{ marginBottom: 12, borderRadius: 12, backgroundColor: tokens.name === 'midnight' ? '#3a1a1e' : '#ffecef', paddingHorizontal: 12, paddingVertical: 10, color: tokens.danger, fontSize: 14, fontWeight: '600' }}>
                {errorMessage}
              </Text>
            ) : null}

            {successMessage ? (
              <Text style={{ marginBottom: 12, borderRadius: 12, backgroundColor: tokens.name === 'midnight' ? '#0d2e1e' : '#e9f8ef', paddingHorizontal: 12, paddingVertical: 10, color: tokens.success, fontSize: 14, fontWeight: '600' }}>
                {successMessage}
              </Text>
            ) : null}

            {currentStep === 1 ? (
              <View style={{ gap: 12 }}>
                <View>
                  <Text style={{ marginBottom: 6, color: tokens.muted, fontSize: 13, fontWeight: '700' }}>First name</Text>
                  <TextInput
                    value={form.firstName}
                    onChangeText={(value) => setField('firstName', value)}
                    placeholder="John"
                    placeholderTextColor={tokens.muted}
                    style={{ borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 12, paddingVertical: 12, color: tokens.text, fontSize: 15 }}
                  />
                </View>

                <View>
                  <Text style={{ marginBottom: 6, color: tokens.muted, fontSize: 13, fontWeight: '700' }}>Last name</Text>
                  <TextInput
                    value={form.lastName}
                    onChangeText={(value) => setField('lastName', value)}
                    placeholder="Doe"
                    placeholderTextColor={tokens.muted}
                    style={{ borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 12, paddingVertical: 12, color: tokens.text, fontSize: 15 }}
                  />
                </View>

                <View>
                  <Text style={{ marginBottom: 6, color: tokens.muted, fontSize: 13, fontWeight: '700' }}>Bio</Text>
                  <TextInput
                    value={form.bio}
                    onChangeText={(value) => setField('bio', value)}
                    placeholder="Share a bit about yourself"
                    placeholderTextColor={tokens.muted}
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                    style={{ minHeight: 120, borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 12, paddingVertical: 12, color: tokens.text, fontSize: 15 }}
                  />
                </View>
              </View>
            ) : null}

            {currentStep === 2 ? (
              <View style={{ gap: 12 }}>
                {role !== 'PROFESSOR' ? (
                  <View style={{ gap: 12 }}>
                    <View>
                      <Text style={{ marginBottom: 6, color: tokens.muted, fontSize: 13, fontWeight: '700' }}>Department / Major</Text>
                      <TextInput
                        value={form.major}
                        onChangeText={(value) => setField('major', value)}
                        placeholder="Computer Science"
                        placeholderTextColor={tokens.muted}
                        style={{ borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 12, paddingVertical: 12, color: tokens.text, fontSize: 15 }}
                      />
                    </View>

                    <View>
                      <Text style={{ marginBottom: 6, color: tokens.muted, fontSize: 13, fontWeight: '700' }}>Graduation year</Text>
                      <TextInput
                        value={form.yearOfGraduation}
                        onChangeText={(value) => setField('yearOfGraduation', value)}
                        placeholder="2026"
                        placeholderTextColor={tokens.muted}
                        keyboardType="number-pad"
                        style={{ borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 12, paddingVertical: 12, color: tokens.text, fontSize: 15 }}
                      />
                    </View>
                  </View>
                ) : null}

                {role !== 'PROFESSOR' ? (
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ marginBottom: 6, color: tokens.muted, fontSize: 13, fontWeight: '700' }}>Current company</Text>
                      <TextInput
                        value={form.company}
                        onChangeText={(value) => setField('company', value)}
                        placeholder="Optional"
                        placeholderTextColor={tokens.muted}
                        style={{ borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 12, paddingVertical: 12, color: tokens.text, fontSize: 15 }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ marginBottom: 6, color: tokens.muted, fontSize: 13, fontWeight: '700' }}>Job title</Text>
                      <TextInput
                        value={form.jobTitle}
                        onChangeText={(value) => setField('jobTitle', value)}
                        placeholder="Optional"
                        placeholderTextColor={tokens.muted}
                        style={{ borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 12, paddingVertical: 12, color: tokens.text, fontSize: 15 }}
                      />
                    </View>
                  </View>
                ) : null}

                {(role === 'STUDENT' || role === 'PROFESSOR') && (
                  <View>
                    <Text style={{ marginBottom: 6, color: tokens.muted, fontSize: 13, fontWeight: '700' }}>Faculty</Text>
                    <TextInput
                      value={form.faculty}
                      onChangeText={(value) => setField('faculty', value)}
                      placeholder="Engineering Faculty"
                      placeholderTextColor={tokens.muted}
                      style={{ borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 12, paddingVertical: 12, color: tokens.text, fontSize: 15 }}
                    />
                  </View>
                )}

                {role === 'PROFESSOR' ? (
                  <View>
                    <Text style={{ marginBottom: 6, color: tokens.muted, fontSize: 13, fontWeight: '700' }}>Job title</Text>
                    <TextInput
                      value={form.jobTitle}
                      onChangeText={(value) => setField('jobTitle', value)}
                      placeholder="Associate Professor"
                      placeholderTextColor={tokens.muted}
                      style={{ borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 12, paddingVertical: 12, color: tokens.text, fontSize: 15 }}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            {currentStep === 3 ? (
              <View style={{ gap: 14 }}>
                <View>
                  <Text style={{ marginBottom: 8, color: tokens.muted, fontSize: 13, fontWeight: '700' }}>Interests</Text>
                  {form.interests.length > 0 ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                      {form.interests.map((interest, index) => (
                        <View key={`${interest}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tokens.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: tokens.border }}>
                          <Text style={{ color: tokens.primary, fontSize: 12, fontWeight: '700', marginRight: 6 }}>{interest}</Text>
                          <Pressable onPress={() => setField('interests', form.interests.filter((_item, itemIndex) => itemIndex !== index))}>
                            <FontAwesomeIcon icon={faTimes as any} size={10} color={tokens.primary} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                      value={interestInput}
                      onChangeText={setInterestInput}
                      placeholder="Type an interest"
                      placeholderTextColor={tokens.muted}
                      style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 12, paddingVertical: 12, color: tokens.text, fontSize: 15 }}
                    />
                    <Pressable onPress={addInterest} style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: tokens.primary, alignItems: 'center', justifyContent: 'center' }}>
                      <FontAwesomeIcon icon={faPlus as any} size={15} color="#ffffff" />
                    </Pressable>
                  </View>
                  <Text style={{ marginTop: 8, color: tokens.muted, fontSize: 12 }}>Press the plus button or add a comma-separated interest.</Text>
                </View>

                <View>
                  <Text style={{ marginBottom: 8, color: tokens.muted, fontSize: 13, fontWeight: '700' }}>Profile picture</Text>
                  <Pressable onPress={handlePictureSelection} style={{ borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingVertical: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <FontAwesomeIcon icon={faImage as any} size={16} color={tokens.primary} />
                    <Text style={{ color: tokens.text, fontSize: 14, fontWeight: '600' }}>
                      {profilePicture ? 'Change profile picture' : 'Upload a profile picture'}
                    </Text>
                  </Pressable>
                  {profilePicture ? (
                    <Image source={{ uri: profilePicture.uri }} style={{ width: 88, height: 88, borderRadius: 18, marginTop: 12 }} />
                  ) : null}
                </View>

                {role === 'ALUMNI' ? (
                  <View style={{ borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.primarySoft, padding: 12 }}>
                    <Pressable
                      onPress={() => setField('isAnonymous', !form.isAnonymous)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                    >
                      <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: form.isAnonymous ? tokens.primary : tokens.border, backgroundColor: form.isAnonymous ? tokens.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                        {form.isAnonymous ? <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text> : null}
                      </View>
                      <Text style={{ color: tokens.text, fontSize: 14, fontWeight: '700' }}>Show my profile anonymously</Text>
                    </Pressable>

                    {form.isAnonymous ? (
                      <View style={{ marginTop: 12 }}>
                        <Text style={{ marginBottom: 6, color: tokens.muted, fontSize: 13, fontWeight: '700' }}>Anonymous nickname</Text>
                        <TextInput
                          value={form.anonymousName}
                          onChangeText={(value) => setField('anonymousName', value)}
                          placeholder="Campus Mentor 42"
                          placeholderTextColor={tokens.muted}
                          style={{ borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 12, paddingVertical: 12, color: tokens.text, fontSize: 15 }}
                        />
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}

            {currentStep === 4 ? (
              <View style={{ gap: 10 }}>
                <Text style={{ color: tokens.muted, fontSize: 14, fontWeight: '600' }}>Review and save your profile details.</Text>
                <View style={{ borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, padding: 12 }}>
                  <Text style={{ color: tokens.text, fontSize: 14, marginBottom: 4 }}>{`Name: ${form.firstName || '-'} ${form.lastName || ''}`.trim()}</Text>
                  <Text style={{ color: tokens.text, fontSize: 14, marginBottom: 4 }}>{`Bio: ${form.bio || '-'}`}</Text>
                  <Text style={{ color: tokens.text, fontSize: 14, marginBottom: 4 }}>{`Major: ${form.major || '-'}`}</Text>
                  <Text style={{ color: tokens.text, fontSize: 14, marginBottom: 4 }}>{`Graduation year: ${form.yearOfGraduation || '-'}`}</Text>
                  <Text style={{ color: tokens.text, fontSize: 14, marginBottom: 4 }}>{`Faculty: ${form.faculty || '-'}`}</Text>
                  <Text style={{ color: tokens.text, fontSize: 14, marginBottom: 4 }}>{`Company: ${form.company || '-'}`}</Text>
                  <Text style={{ color: tokens.text, fontSize: 14, marginBottom: 4 }}>{`Job title: ${form.jobTitle || '-'}`}</Text>
                  <Text style={{ color: tokens.text, fontSize: 14, marginBottom: 4 }}>{`Interests: ${form.interests.length > 0 ? form.interests.join(', ') : '-'}`}</Text>
                  <Text style={{ color: tokens.text, fontSize: 14 }}>{`Profile picture selected: ${profilePicture ? 'Yes' : 'No'}`}</Text>
                  {role === 'ALUMNI' ? (
                    <Text style={{ color: tokens.text, fontSize: 14, marginTop: 4 }}>{`Anonymous: ${form.isAnonymous ? 'Yes' : 'No'}`}</Text>
                  ) : null}
                </View>

                <View style={{ gap: 8 }}>
                  <Pressable onPress={() => goToStep(1)} style={{ borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingVertical: 12, alignItems: 'center' }}>
                    <Text style={{ color: tokens.text, fontSize: 14, fontWeight: '700' }}>Edit basic info</Text>
                  </Pressable>
                  <Pressable onPress={() => goToStep(2)} style={{ borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingVertical: 12, alignItems: 'center' }}>
                    <Text style={{ color: tokens.text, fontSize: 14, fontWeight: '700' }}>Edit academics</Text>
                  </Pressable>
                  <Pressable onPress={() => goToStep(3)} style={{ borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingVertical: 12, alignItems: 'center' }}>
                    <Text style={{ color: tokens.text, fontSize: 14, fontWeight: '700' }}>Edit interests</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <Pressable
                onPress={currentStep === 1 ? () => navigation.navigate(isEditMode ? 'Profile' : 'Dashboard') : previousStep}
                style={{ flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: tokens.primaryStrong, fontSize: 15, fontWeight: '700' }}>
                  {currentStep === 1 ? (isEditMode ? 'Back to profile' : 'Skip for now') : 'Back'}
                </Text>
              </Pressable>

              {currentStep < TOTAL_STEPS ? (
                <Pressable onPress={nextStep} style={{ flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: tokens.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Continue</Text>
                </Pressable>
              ) : successMessage ? (
                <Pressable
                  onPress={() => navigation.replace(isEditMode ? 'Profile' : 'Dashboard')}
                  style={{ flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: tokens.primary, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                    {isEditMode ? 'Return to profile' : 'Continue to dashboard'}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => void handleSubmit()}
                  disabled={isSubmitting}
                  style={{ flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: isSubmitting ? tokens.primarySoft : tokens.primary, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: isSubmitting ? tokens.primary : '#fff', fontSize: 15, fontWeight: '700' }}>
                    {isSubmitting ? 'Saving...' : 'Finish'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          <Text style={{ marginTop: 18, textAlign: 'center', color: tokens.muted, fontSize: 12 }}>
            {isEditMode ? `${roleTitle} profile editor` : `${roleTitle} onboarding (all fields are optional)`}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
