import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LandingHeader } from '../components/LandingHeader';
import { InfoCard } from '../components/InfoCard';

const purposeCards = [
  {
    icon: '🎓',
    title: 'Students',
    description: 'Full access to notes, groups, campus resources, and mentorship.',
  },
  {
    icon: '📚',
    title: 'Professors',
    description: 'Lead discussions, collaborate on notes, and advise study groups.',
  },
  {
    icon: '🧑‍💼',
    title: 'Alumni',
    description: 'Mentor students, share career advice, and stay connected.',
  },
];

const featureCards = [
  {
    icon: '📝',
    title: 'Collaborative Notes',
    description:
      'Write and edit notes together in real time with your classmates and professors.',
  },
  {
    icon: '💬',
    title: 'Discussion Threads',
    description:
      'Join course and campus conversations in organized, topic-based discussion spaces.',
  },
  {
    icon: '👥',
    title: 'Study Groups',
    description: 'Find peers with shared courses and build effective study groups quickly.',
  },
  {
    icon: '✨',
    title: 'AI-Powered Insights',
    description: 'Get smart suggestions for notes, mentors, and relevant campus resources.',
  },
  {
    icon: '📍',
    title: 'Campus Resources',
    description: 'Discover study spaces, labs, and key facilities with location-aware guidance.',
  },
  {
    icon: '🤝',
    title: 'Alumni Mentorship',
    description: 'Connect with alumni for guidance, career advice, and practical insights.',
  },
];

const privacyCards = [
  {
    icon: '🔒',
    title: 'End-to-End Security',
    description:
      'Data is encrypted in transit and at rest to keep your notes and profile secure.',
  },
  {
    icon: '📖',
    title: 'Transparent Data Use',
    description:
      'We do not sell your data. AI features are used only with your explicit consent.',
  },
  {
    icon: '🛡️',
    title: 'Institutional Control',
    description:
      'Access is limited to approved university members under admin and policy controls.',
  },
];

export function HomePage() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="dark" />
      <LandingHeader />

      <ScrollView contentContainerClassName="pb-7" showsVerticalScrollIndicator={false}>
        <View className="bg-[#f5f8ff] px-4 py-[30px]">
          <View className="mb-3.5 self-start rounded-full border border-[#dce8ff] bg-white px-3 py-1.5">
            <Text className="text-xs font-bold text-[#2d4f8f]">✨ Built for universities</Text>
          </View>

          <Text className="text-[34px] font-extrabold leading-10 text-ink">
            Where academics <Text className="text-primary">connect</Text>, collaborate, and grow
          </Text>

          <Text className="mt-3.5 text-base leading-6 text-muted">
            UniBridge is the all-in-one platform for students, professors, and alumni. Share notes,
            discuss ideas, find mentors, and access campus resources — all in one place.
          </Text>

          <View className="mt-[22px] gap-2.5">
            <Pressable className="min-h-12 items-center justify-center rounded-xl bg-primary px-4">
              <Text className="text-[15px] font-bold text-white">Create Your Account →</Text>
            </Pressable>
            <Pressable className="min-h-12 items-center justify-center rounded-xl border border-[#d5dff0] bg-white px-4">
              <Text className="text-[15px] font-bold text-[#1f2f4a]">Sign In</Text>
            </Pressable>
          </View>

          <View className="mt-[18px] flex-row gap-2">
            <Text className="flex-1 rounded-full border border-[#dce5f5] bg-white px-2 py-2 text-center text-[12px] font-semibold text-[#30425f]">🎓 Students</Text>
            <Text className="flex-1 rounded-full border border-[#dce5f5] bg-white px-2 py-2 text-center text-[12px] font-semibold text-[#30425f]">📚 Professors</Text>
            <Text className="flex-1 rounded-full border border-[#dce5f5] bg-white px-2 py-2 text-center text-[12px] font-semibold text-[#30425f]">🧑‍💼 Alumni</Text>
          </View>
        </View>

        <View className="px-4 py-[30px]">
          <Text className="mb-2.5 text-xs font-bold uppercase text-[#3f67b7]">Our Purpose</Text>
          <Text className="mb-3 text-[28px] font-extrabold leading-[34px] text-ink">
            Bridging the gap between academic life and community
          </Text>
          <Text className="mb-[18px] text-[15px] leading-[23px] text-muted">
            Universities are full of brilliant minds — but too often, knowledge stays siloed.
            UniBridge creates one shared space where students collaborate, professors guide, and
            alumni give back.
          </Text>

          {purposeCards.map((card) => (
            <InfoCard key={card.title} icon={card.icon} title={card.title} description={card.description} />
          ))}
        </View>

        <View className="bg-[#f8faff] px-4 py-[30px]">
          <Text className="mb-2.5 text-xs font-bold uppercase text-[#3f67b7]">Features</Text>
          <Text className="mb-3 text-[28px] font-extrabold leading-[34px] text-ink">
            Everything your campus needs
          </Text>

          {featureCards.map((card) => (
            <InfoCard
              key={card.title}
              icon={card.icon}
              title={card.title}
              description={card.description}
              row
            />
          ))}
        </View>

        <View className="px-4 py-[30px]">
          <View className="rounded-[20px] border border-[#dfebff] bg-[#f7fafe] p-[18px]">
            <Text className="mb-2 self-center text-[28px]">🔒</Text>
            <Text className="text-center text-[25px] font-extrabold leading-[30px] text-ink">Your Privacy Matters</Text>
            <Text className="mb-3.5 mt-2 text-center text-sm text-[#5d7090]">How we protect your data and respect your rights</Text>

            {privacyCards.map((card) => (
              <InfoCard key={card.title} icon={card.icon} title={card.title} description={card.description} />
            ))}

            <Text className="mt-2 text-[13px] leading-5 text-[#607491]">
              UniBridge follows institutional privacy practices and collects only what is needed to
              deliver services securely.
            </Text>
          </View>
        </View>

        <View className="items-center bg-[#f5f8ff] px-4 py-[30px]">
          <Text className="mb-2.5 text-[32px]">📍</Text>
          <Text className="mb-2.5 text-center text-[30px] font-extrabold leading-9 text-ink">Ready to bridge the gap?</Text>
          <Text className="mb-3.5 text-center text-[15px] leading-[23px] text-[#566985]">
            Join your university's community on UniBridge. It takes less than a minute to get
            started.
          </Text>

          <Pressable className="mb-3 min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4">
            <Text className="text-[15px] font-bold text-white">Get Started Free →</Text>
          </Pressable>

          <Pressable>
            <Text className="text-sm font-semibold text-[#2d63e5]">Already have an account? Sign in</Text>
          </Pressable>
        </View>

        <View className="items-center border-t border-[#e8eef8] px-4 py-7">
          <Text className="mb-1 text-xl font-extrabold text-ink">UniBridge</Text>
          <Text className="mb-2 text-sm text-[#5f7291]">Privacy • Terms • Contact</Text>
          <Text className="text-xs text-[#7c8da9]">© 2026 UniBridge. All rights reserved.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
