import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faShieldAlt, faUsers, faMapMarked, faPushpin, faSignOutAlt, faUser } from '@fortawesome/free-solid-svg-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/root-stack';
import { getValidAccessToken } from '../../lib/auth-session';
import { getRoleFromAccessToken } from '../../lib/jwt';
import { clearTokens } from '../../lib/auth-storage';
import { AdminUsersPage } from './AdminUsersPage';
import { AdminGeoModerationPage } from './AdminGeoModerationPage';
import { AdminThreadsModerationPage } from './AdminThreadsModerationPage';

type Tab = 'users' | 'geo' | 'threads';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminLayout'>;

export function AdminLayout({ navigation }: Props) {
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
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, color: '#666' }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const TAB_CONFIG: Array<{ id: Tab; label: string; icon: any }> = [
    { id: 'users', label: 'Users', icon: faUsers },
    { id: 'geo', label: 'Geo', icon: faMapMarked },
    { id: 'threads', label: 'Threads', icon: faPushpin },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Admin Header */}
      <View style={{ backgroundColor: '#1a1a2e', paddingHorizontal: 16, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <FontAwesomeIcon icon={faShieldAlt} size={16} color="#fff" />
            <View>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#fff' }}>UniBridge</Text>
              <Text style={{ fontSize: 12, color: '#aaa' }}>Admin Console</Text>
            </View>
          </View>
          <Pressable
            onPress={handleLogout}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8 }}
          >
            <FontAwesomeIcon icon={faSignOutAlt} size={12} color="#fff" />
            <Text style={{ fontSize: 12, color: '#fff' }}>Logout</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Profile')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#2a2f45' }}
          >
            <FontAwesomeIcon icon={faUser} size={12} color="#fff" />
            <Text style={{ fontSize: 12, color: '#fff' }}>Profile</Text>
          </Pressable>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: '#e0e0e0' }}>
        <View style={{ flexDirection: 'row' }}>
          {TAB_CONFIG.map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderBottomWidth: activeTab === tab.id ? 2 : 0,
                borderBottomColor: activeTab === tab.id ? '#007AFF' : '#e0e0e0',
                alignItems: 'center',
              }}
            >
              <FontAwesomeIcon
                icon={tab.icon}
                size={14}
                color={activeTab === tab.id ? '#007AFF' : '#666'}
                style={{ marginBottom: 4 }}
              />
              <Text style={{ fontSize: 12, color: activeTab === tab.id ? '#007AFF' : '#666', fontWeight: activeTab === tab.id ? '600' : '400' }}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Content Area */}
      <ScrollView style={{ flex: 1, backgroundColor: '#f9f9f9' }} contentContainerStyle={{ paddingBottom: 20 }}>
        {activeTab === 'users' && <AdminUsersPage token={accessToken} />}
        {activeTab === 'geo' && <AdminGeoModerationPage token={accessToken} />}
        {activeTab === 'threads' && <AdminThreadsModerationPage token={accessToken} />}
      </ScrollView>
    </SafeAreaView>
  );
}
