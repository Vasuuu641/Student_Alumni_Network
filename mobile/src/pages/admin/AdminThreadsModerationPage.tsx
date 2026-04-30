import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faSearch, faPushpin, faLock, faUnlock } from '@fortawesome/free-solid-svg-icons';
import {
  listThreadsForAdmin,
  setThreadStatus,
  type AdminThread,
} from '../../api/admin.api';

type PanelFilter = 'ACADEMIC' | 'ALUMNI';
type StatusFilter = 'ALL' | 'OPEN' | 'CLOSED' | 'PINNED';

interface AdminThreadsModerationPageProps {
  token: string;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function getStatusColor(status: 'OPEN' | 'CLOSED' | 'PINNED'): string {
  switch (status) {
    case 'OPEN':
      return '#e8f5e9';
    case 'CLOSED':
      return '#ffe0e0';
    case 'PINNED':
      return '#e3f2fd';
    default:
      return '#f5f5f5';
  }
}

function getStatusTextColor(status: 'OPEN' | 'CLOSED' | 'PINNED'): string {
  switch (status) {
    case 'OPEN':
      return '#1b5e20';
    case 'CLOSED':
      return '#c62828';
    case 'PINNED':
      return '#1565c0';
    default:
      return '#666';
  }
}

export function AdminThreadsModerationPage({ token }: AdminThreadsModerationPageProps) {
  const [threads, setThreads] = useState<AdminThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [panelFilter, setPanelFilter] = useState<PanelFilter>('ACADEMIC');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    void loadThreads();
  }, [panelFilter]);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timeout);
  }, [notice]);

  async function loadThreads() {
    try {
      setLoading(true);
      setError(null);
      const { threads: fetched } = await listThreadsForAdmin(token, {
        panel: panelFilter,
        sortBy: 'newest',
        take: 50,
      });
      setThreads(fetched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load threads.');
    } finally {
      setLoading(false);
    }
  }

  const filteredThreads = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return threads.filter((thread) => {
      const statusMatch = statusFilter === 'ALL' || thread.status === statusFilter;
      if (!statusMatch) return false;

      if (!query) return true;
      return (
        thread.title.toLowerCase().includes(query) ||
        (thread.description ?? '').toLowerCase().includes(query)
      );
    });
  }, [threads, searchText, statusFilter]);

  async function handleStatusChange(threadId: string, status: 'OPEN' | 'CLOSED' | 'PINNED') {
    try {
      setActingId(threadId);
      setError(null);
      await setThreadStatus(token, threadId, status);
      setThreads((prev) =>
        prev.map((thread) =>
          thread.id === threadId ? { ...thread, status } : thread
        ),
      );
      setNotice(`Thread updated to ${status}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update thread status.');
    } finally {
      setActingId(null);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Error Message */}
      {error && (
        <View style={{ backgroundColor: '#fee', paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 16, marginTop: 12, borderRadius: 8 }}>
          <Text style={{ color: '#c00', fontSize: 13 }}>{error}</Text>
        </View>
      )}

      {/* Notice Message */}
      {notice && (
        <View style={{ backgroundColor: '#efe', paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 16, marginTop: 12, borderRadius: 8 }}>
          <Text style={{ color: '#060', fontSize: 13 }}>{notice}</Text>
        </View>
      )}

      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 4 }}>Thread Moderation</Text>
        <Text style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
          Pin important threads and control discussion status
        </Text>

        {/* Panel Tabs */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {(['ACADEMIC', 'ALUMNI'] as const).map((panel) => (
            <Pressable
              key={panel}
              onPress={() => setPanelFilter(panel)}
              style={{
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 6,
                backgroundColor: panelFilter === panel ? '#007AFF' : '#e8e8e8',
              }}
            >
              <Text style={{ fontSize: 13, color: panelFilter === panel ? '#fff' : '#333', fontWeight: '600', textAlign: 'center' }}>
                {panel}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Search */}
        <View style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', paddingHorizontal: 12, borderRadius: 8 }}>
            <FontAwesomeIcon icon={faSearch} size={14} color="#999" style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search threads..."
              value={searchText}
              onChangeText={setSearchText}
              style={{ flex: 1, paddingVertical: 10, fontSize: 14 }}
            />
          </View>
        </View>

        {/* Status Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(['ALL', 'OPEN', 'CLOSED', 'PINNED'] as const).map((status) => (
            <Pressable
              key={status}
              onPress={() => setStatusFilter(status)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                marginRight: 8,
                borderRadius: 16,
                backgroundColor: statusFilter === status ? '#007AFF' : '#e8e8e8',
              }}
            >
              <Text style={{ fontSize: 12, color: statusFilter === status ? '#fff' : '#333', fontWeight: '500' }}>
                {status}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Threads List */}
      <FlatList
        data={filteredThreads}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#e0e0e0' }}>
              <View style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 }} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <View style={{ backgroundColor: getStatusColor(item.status), paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                    <Text style={{ fontSize: 10, color: getStatusTextColor(item.status), fontWeight: '500' }}>
                      {item.status}
                    </Text>
                  </View>
                </View>

                {item.description && (
                  <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }} numberOfLines={2}>
                    {item.description}
                  </Text>
                )}

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  <View style={{ backgroundColor: '#e8e8e8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                    <Text style={{ fontSize: 11, color: '#666' }}>💬 {item.replyCount}</Text>
                  </View>
                  <View style={{ backgroundColor: '#e8e8e8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                    <Text style={{ fontSize: 11, color: '#666' }}>👍 {item.voteScore}</Text>
                  </View>
                  <View style={{ backgroundColor: '#e8e8e8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                    <Text style={{ fontSize: 11, color: '#666' }}>👁️ {item.viewCount}</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  {item.authorName && (
                    <Text style={{ fontSize: 11, color: '#999' }}>by {item.authorName}</Text>
                  )}
                  <Text style={{ fontSize: 11, color: '#999' }}>{formatDate(item.createdAt)}</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable
                  onPress={() => handleStatusChange(item.id, 'OPEN')}
                  disabled={actingId !== null}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    backgroundColor: item.status === 'OPEN' ? '#e8f5e9' : '#f0f0f0',
                    borderRadius: 4,
                    alignItems: 'center',
                  }}
                >
                  {actingId === item.id ? (
                    <ActivityIndicator size="small" color="#1b5e20" />
                  ) : (
                    <Text style={{ fontSize: 11, color: item.status === 'OPEN' ? '#1b5e20' : '#666', fontWeight: '500' }}>
                      Open
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => handleStatusChange(item.id, 'CLOSED')}
                  disabled={actingId !== null}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    backgroundColor: item.status === 'CLOSED' ? '#ffe0e0' : '#f0f0f0',
                    borderRadius: 4,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  {actingId === item.id ? (
                    <ActivityIndicator size="small" color="#c62828" />
                  ) : (
                    <>
                      <FontAwesomeIcon
                        icon={faLock}
                        size={10}
                        color={item.status === 'CLOSED' ? '#c62828' : '#666'}
                      />
                      <Text style={{ fontSize: 11, color: item.status === 'CLOSED' ? '#c62828' : '#666', fontWeight: '500' }}>
                        Close
                      </Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => handleStatusChange(item.id, 'PINNED')}
                  disabled={actingId !== null}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    backgroundColor: item.status === 'PINNED' ? '#e3f2fd' : '#f0f0f0',
                    borderRadius: 4,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  {actingId === item.id ? (
                    <ActivityIndicator size="small" color="#1565c0" />
                  ) : (
                    <>
                      <FontAwesomeIcon
                        icon={faPushpin}
                        size={10}
                        color={item.status === 'PINNED' ? '#1565c0' : '#666'}
                      />
                      <Text style={{ fontSize: 11, color: item.status === 'PINNED' ? '#1565c0' : '#666', fontWeight: '500' }}>
                        Pin
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ paddingHorizontal: 16, paddingVertical: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: '#999' }}>No threads found</Text>
          </View>
        }
        scrollEnabled={false}
      />
    </View>
  );
}
