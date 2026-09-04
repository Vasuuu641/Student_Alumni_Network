import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { faShieldAlt, faUsers, faMapMarked, faThumbTack, faSignOutAlt, faUser } from '@fortawesome/free-solid-svg-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/root-stack';
import { getValidAccessToken } from '../../lib/auth-session';
import { getRoleFromAccessToken } from '../../lib/jwt';
import { clearTokens } from '../../lib/auth-storage';
import { AdminUsersPage } from './AdminUsersPage';
import { AdminGeoModerationPage } from './AdminGeoModerationPage';
import { AdminThreadsModerationPage } from './AdminThreadsModerationPage';
import { useTheme, useThemePicker } from '../../theme/theme';

type Tab = 'users' | 'geo' | 'threads';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminLayout'>;

export function AdminLayout({ navigation }: Props) {
  const { tokens } = useTheme();
  const { openThemePicker } = useThemePicker();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('users');

  useEffect(() => {
    let cancelled = false;

    async function checkAdminAccess() {
      try {
        const token = await getValidAccessToken();

        if (cancelled) {
          return;
        }

        if (!token) {
          navigation.replace('Home');
          return;
        }

        const role = getRoleFromAccessToken(token);

        if (role !== 'ADMIN') {
          navigation.replace('Dashboard');
          return;
        }

        setAccessToken(token);
      } catch {
        if (!cancelled) {
          navigation.replace('Home');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void checkAdminAccess();

    return () => {
      cancelled = true;
    };
  }, [navigation]);

  async function handleLogout() {
    await clearTokens();
    navigation.replace('Home');
  }

  if (loading || !accessToken) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, color: tokens.muted }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const TAB_CONFIG: Array<{ id: Tab; label: string; icon: IconProp }> = [
    { id: 'users', label: 'Users', icon: faUsers as IconProp },
    { id: 'geo', label: 'Geo', icon: faMapMarked as IconProp },
    { id: 'threads', label: 'Threads', icon: faThumbTack as IconProp },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.background }}>
      {/* Admin Header */}
      <View style={{ backgroundColor: tokens.primary, paddingHorizontal: 16, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <FontAwesomeIcon icon={faShieldAlt as IconProp} size={16} color="#fff" />
            <View>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#fff' }}>UniBridge</Text>
              <Text style={{ fontSize: 12, color: '#dbeafe' }}>Admin Console</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable
              onPress={openThemePicker}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: tokens.primaryStrong }}
            >
              <FontAwesomeIcon icon={faShieldAlt as IconProp} size={12} color="#fff" />
              <Text style={{ fontSize: 12, color: '#fff' }}>Theme</Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('Profile')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: tokens.primaryStrong }}
            >
              <FontAwesomeIcon icon={faUser as IconProp} size={12} color="#fff" />
              <Text style={{ fontSize: 12, color: '#fff' }}>Profile</Text>
            </Pressable>

            <Pressable
              onPress={handleLogout}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8 }}
            >
              <FontAwesomeIcon icon={faSignOutAlt as IconProp} size={12} color="#fff" />
              <Text style={{ fontSize: 12, color: '#fff' }}>Logout</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: tokens.border }}>
        <View style={{ flexDirection: 'row' }}>
          {TAB_CONFIG.map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderBottomWidth: activeTab === tab.id ? 2 : 0,
                borderBottomColor: activeTab === tab.id ? tokens.primary : tokens.border,
                alignItems: 'center',
              }}
            >
              <FontAwesomeIcon
                icon={tab.icon}
                size={14}
                color={activeTab === tab.id ? tokens.primary : tokens.muted}
                style={{ marginBottom: 4 }}
              />
              <Text
                numberOfLines={1}
                style={{ fontSize: 12, color: activeTab === tab.id ? tokens.primary : tokens.muted, fontWeight: activeTab === tab.id ? '600' : '400' }}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Content Area */}
      <ScrollView style={{ flex: 1, backgroundColor: tokens.background }} contentContainerStyle={{ paddingBottom: 20 }}>
        {activeTab === 'users' && <AdminUsersPage token={accessToken} />}
        {activeTab === 'geo' && <AdminGeoModerationPage token={accessToken} />}
        {activeTab === 'threads' && <AdminThreadsModerationPage token={accessToken} />}
      </ScrollView>
    </SafeAreaView>
  );
}
