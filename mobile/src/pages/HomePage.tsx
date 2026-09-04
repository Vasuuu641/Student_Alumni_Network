import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LandingHeader } from '../components/LandingHeader';
import { InfoCard } from '../components/InfoCard';
import { getValidAccessToken } from '../lib/auth-session';
import { getRoleFromAccessToken } from '../lib/jwt';
import type { RootStackParamList } from '../navigation/root-stack';
import { useTheme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const purposeCards = [
  { icon: '🎓', title: 'Students',   description: 'Full access to notes, groups, campus resources, and mentorship.' },
  { icon: '📚', title: 'Professors', description: 'Lead discussions, collaborate on notes, and advise study groups.' },
  { icon: '🧑‍💼', title: 'Alumni',    description: 'Mentor students, share career advice, and stay connected.' },
];

const featureCards = [
  { icon: '📝', title: 'Collaborative Notes',    description: 'Write and edit notes together in real time with your classmates and professors.' },
  { icon: '💬', title: 'Discussion Threads',     description: 'Join course and campus conversations in organized, topic-based discussion spaces.' },
  { icon: '👥', title: 'Study Groups',           description: 'Find peers with shared courses and build effective study groups quickly.' },
  { icon: '✨', title: 'AI-Powered Insights',    description: 'Get smart suggestions for notes, mentors, and relevant campus resources.' },
  { icon: '📍', title: 'Campus Resources',       description: 'Discover study spaces, labs, and key facilities with location-aware guidance.' },
  { icon: '🤝', title: 'Alumni Mentorship',      description: 'Connect with alumni for guidance, career advice, and practical insights.' },
];

const privacyCards = [
  { icon: '🔒', title: 'End-to-End Security',      description: 'Data is encrypted in transit and at rest to keep your notes and profile secure.' },
  { icon: '📖', title: 'Transparent Data Use',     description: 'We do not sell your data. AI features are used only with your explicit consent.' },
  { icon: '🛡️', title: 'Institutional Control',    description: 'Access is limited to approved university members under admin and policy controls.' },
];

export function HomePage({ navigation }: Props) {
  const { tokens } = useTheme();

  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      const token = await getValidAccessToken();
      if (cancelled) return;
      if (!token) return;
      navigation.replace(getRoleFromAccessToken(token) === 'ADMIN' ? 'AdminLayout' : 'Dashboard');
    }
    void checkSession();
    return () => { cancelled = true; };
  }, [navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.surface }}>
      <StatusBar style={tokens.name === 'midnight' ? 'light' : 'dark'} />

      <LandingHeader
        onPressSignIn={() => navigation.navigate('Login')}
        onPressGetStarted={() => navigation.navigate('Register')}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: tokens.background }}
      >
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <View style={{ backgroundColor: tokens.primarySoft, paddingHorizontal: 16, paddingVertical: 30 }}>
          <View
            style={{
              alignSelf: 'flex-start',
              borderRadius: 999,
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: tokens.surface,
              paddingHorizontal: 12,
              paddingVertical: 6,
              marginBottom: 14,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.primaryStrong }}>
              ✨ Built for universities
            </Text>
          </View>

          <Text style={{ fontSize: 34, fontWeight: '900', lineHeight: 42, color: tokens.text }}>
            Where academics{' '}
            <Text style={{ color: tokens.primary }}>connect</Text>
            {', '}collaborate, and grow
          </Text>

          <Text style={{ marginTop: 14, fontSize: 15, lineHeight: 23, color: tokens.muted }}>
            UniBridge is the all-in-one platform for students, professors, and alumni. Share notes,
            discuss ideas, find mentors, and access campus resources — all in one place.
          </Text>

          <View style={{ marginTop: 22, gap: 10 }}>
            <Pressable
              style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: tokens.primary, paddingHorizontal: 16 }}
              onPress={() => navigation.navigate('Register')}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Create Your Account →</Text>
            </Pressable>
            <Pressable
              style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, paddingHorizontal: 16 }}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: tokens.text }}>Sign In</Text>
            </Pressable>
          </View>

          <View style={{ marginTop: 18, flexDirection: 'row', gap: 8 }}>
            {['🎓 Students', '📚 Professors', '🧑‍💼 Alumni'].map((label) => (
              <View
                key={label}
                style={{ flex: 1, borderRadius: 999, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, paddingVertical: 8, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.text }}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Our Purpose ──────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 30, backgroundColor: tokens.background }}>
          <Text style={{ marginBottom: 10, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', color: tokens.primary }}>
            Our Purpose
          </Text>
          <Text style={{ marginBottom: 12, fontSize: 28, fontWeight: '900', lineHeight: 34, color: tokens.text }}>
            Bridging the gap between academic life and community
          </Text>
          <Text style={{ marginBottom: 18, fontSize: 15, lineHeight: 23, color: tokens.muted }}>
            Universities are full of brilliant minds — but too often, knowledge stays siloed.
            UniBridge creates one shared space where students collaborate, professors guide, and
            alumni give back.
          </Text>
          {purposeCards.map((card) => (
            <InfoCard key={card.title} icon={card.icon} title={card.title} description={card.description} />
          ))}
        </View>

        {/* ── Features ─────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 30, backgroundColor: tokens.primarySoft }}>
          <Text style={{ marginBottom: 10, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', color: tokens.primary }}>
            Features
          </Text>
          <Text style={{ marginBottom: 12, fontSize: 28, fontWeight: '900', lineHeight: 34, color: tokens.text }}>
            Everything your campus needs
          </Text>
          {featureCards.map((card) => (
            <InfoCard key={card.title} icon={card.icon} title={card.title} description={card.description} row />
          ))}
        </View>

        {/* ── Privacy ──────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 30, backgroundColor: tokens.background }}>
          <View
            style={{
              borderRadius: 20,
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: tokens.surface,
              padding: 18,
            }}
          >
            <Text style={{ textAlign: 'center', fontSize: 28, marginBottom: 8 }}>🔒</Text>
            <Text style={{ textAlign: 'center', fontSize: 25, fontWeight: '900', lineHeight: 30, color: tokens.text }}>
              Your Privacy Matters
            </Text>
            <Text style={{ textAlign: 'center', fontSize: 14, color: tokens.muted, marginTop: 8, marginBottom: 14 }}>
              How we protect your data and respect your rights
            </Text>
            {privacyCards.map((card) => (
              <InfoCard key={card.title} icon={card.icon} title={card.title} description={card.description} />
            ))}
            <Text style={{ marginTop: 8, fontSize: 13, lineHeight: 20, color: tokens.muted }}>
              UniBridge follows institutional privacy practices and collects only what is needed to
              deliver services securely.
            </Text>
          </View>
        </View>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <View style={{ alignItems: 'center', backgroundColor: tokens.primarySoft, paddingHorizontal: 16, paddingVertical: 30 }}>
          <Text style={{ fontSize: 32, marginBottom: 10 }}>📍</Text>
          <Text style={{ textAlign: 'center', fontSize: 30, fontWeight: '900', lineHeight: 36, color: tokens.text, marginBottom: 10 }}>
            Ready to bridge the gap?
          </Text>
          <Text style={{ textAlign: 'center', fontSize: 15, lineHeight: 23, color: tokens.muted, marginBottom: 14 }}>
            Join your university's community on UniBridge. It takes less than a minute to get started.
          </Text>
          <Pressable
            style={{ minHeight: 48, width: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: tokens.primary, paddingHorizontal: 16, marginBottom: 12 }}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Get Started Free →</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Login')}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.primary }}>
              Already have an account? Sign in
            </Text>
          </Pressable>
        </View>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <View style={{ alignItems: 'center', borderTopWidth: 1, borderTopColor: tokens.border, paddingHorizontal: 16, paddingVertical: 28, backgroundColor: tokens.surface }}>
          <Text style={{ fontSize: 20, fontWeight: '900', color: tokens.text, marginBottom: 4 }}>UniBridge</Text>
          <Text style={{ fontSize: 14, color: tokens.muted, marginBottom: 8 }}>Privacy • Terms • Contact</Text>
          <Text style={{ fontSize: 12, color: tokens.muted }}>© 2026 UniBridge. All rights reserved.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}