import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faPencil, faTrash2, faPlus, faSearch } from '@fortawesome/free-solid-svg-icons';
import {
  listAuthorizedUsers,
  createAuthorizedUser,
  updateAuthorizedUser,
  deleteAuthorizedUser,
  type AuthorizedUser,
  type AuthorizedRole,
} from '../../api/admin.api';

const ROLE_OPTIONS: AuthorizedRole[] = ['STUDENT', 'PROFESSOR', 'ALUMNI', 'ADMIN'];

interface AdminUsersPageProps {
  token: string;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function AdminUsersPage({ token }: AdminUsersPageProps) {
  const [users, setUsers] = useState<AuthorizedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | AuthorizedRole>('ALL');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AuthorizedRole>('STUDENT');

  const [editingUser, setEditingUser] = useState<AuthorizedUser | null>(null);
  const [editingEmail, setEditingEmail] = useState('');
  const [editingRole, setEditingRole] = useState<AuthorizedRole>('STUDENT');

  useEffect(() => {
    void loadUsers();
  }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      setError(null);
      const data = await listAuthorizedUsers(token);
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return users.filter((user) => {
      const roleMatch = roleFilter === 'ALL' || user.role === roleFilter;
      if (!roleMatch) return false;

      if (!query) return true;
      return user.email.toLowerCase().includes(query);
    });
  }, [users, searchText, roleFilter]);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(timeout);
  }, [notice]);

  async function handleCreateUser() {
    if (!newEmail.trim()) return;

    try {
      setSubmitting(true);
      setError(null);
      const created = await createAuthorizedUser(token, {
        email: newEmail.trim(),
        role: newRole,
      });
      setUsers((prev) => [created, ...prev]);
      setNewEmail('');
      setNewRole('STUDENT');
      setShowCreateModal(false);
      setNotice('User added successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add user.');
    } finally {
      setSubmitting(false);
    }
  }

  function beginEdit(user: AuthorizedUser) {
    setEditingUser(user);
    setEditingEmail(user.email);
    setEditingRole(user.role);
  }

  async function handleUpdateUser() {
    if (!editingUser) return;

    try {
      setSubmitting(true);
      setError(null);
      const updated = await updateAuthorizedUser(token, editingUser.id, {
        email: editingEmail,
        role: editingRole,
      });
      setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? updated : u)));
      setEditingUser(null);
      setNotice('User updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update user.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteUser(userId: string) {
    try {
      setSubmitting(true);
      setError(null);
      await deleteAuthorizedUser(token, userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setNotice('User removed successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete user.');
    } finally {
      setSubmitting(false);
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
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 4 }}>Authorized Users</Text>
        <Text style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>Manage user access and roles</Text>

        {/* Search and Filter */}
        <View style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', paddingHorizontal: 12, borderRadius: 8 }}>
            <FontAwesomeIcon icon={faSearch} size={14} color="#999" style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search by email..."
              value={searchText}
              onChangeText={setSearchText}
              style={{ flex: 1, paddingVertical: 10, fontSize: 14 }}
            />
          </View>
        </View>

        {/* Filter and Create Button */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
            {(['ALL', ...ROLE_OPTIONS] as const).map((role) => (
              <Pressable
                key={role}
                onPress={() => setRoleFilter(role)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  marginRight: 8,
                  borderRadius: 16,
                  backgroundColor: roleFilter === role ? '#007AFF' : '#e8e8e8',
                }}
              >
                <Text style={{ fontSize: 12, color: roleFilter === role ? '#fff' : '#333', fontWeight: '500' }}>
                  {role}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            onPress={() => setShowCreateModal(true)}
            style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#007AFF', borderRadius: 6 }}
          >
            <FontAwesomeIcon icon={faPlus} size={14} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Users List */}
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#e0e0e0' }}>
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 2 }}>{item.email}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ backgroundColor: '#e3f2fd', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                      <Text style={{ fontSize: 11, color: '#1976d2', fontWeight: '500' }}>{item.role}</Text>
                    </View>
                    {item.isUsed && (
                      <View style={{ backgroundColor: '#e8f5e9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                        <Text style={{ fontSize: 11, color: '#388e3c' }}>Used</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 11, color: '#999' }}>{formatDate(item.createdAt)}</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                <Pressable
                  onPress={() => beginEdit(item)}
                  style={{ paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#f0f0f0', borderRadius: 4 }}
                >
                  <FontAwesomeIcon icon={faPencil} size={12} color="#666" />
                </Pressable>
                <Pressable
                  onPress={() => handleDeleteUser(item.id)}
                  disabled={submitting}
                  style={{ paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#ffe0e0', borderRadius: 4 }}
                >
                  <FontAwesomeIcon icon={faTrash2} size={12} color="#c00" />
                </Pressable>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ paddingHorizontal: 16, paddingVertical: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: '#999' }}>No users found</Text>
          </View>
        }
        scrollEnabled={false}
      />

      {/* Create User Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingVertical: 20, paddingBottom: 32 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Add Authorized User</Text>

            <Text style={{ fontSize: 12, fontWeight: '500', marginBottom: 6, color: '#666' }}>Email</Text>
            <TextInput
              placeholder="user@university.edu"
              value={newEmail}
              onChangeText={setNewEmail}
              style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16, fontSize: 14 }}
            />

            <Text style={{ fontSize: 12, fontWeight: '500', marginBottom: 8, color: '#666' }}>Role</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {ROLE_OPTIONS.map((role) => (
                <Pressable
                  key={role}
                  onPress={() => setNewRole(role)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    marginRight: 8,
                    borderRadius: 6,
                    backgroundColor: newRole === role ? '#007AFF' : '#e8e8e8',
                  }}
                >
                  <Text style={{ fontSize: 13, color: newRole === role ? '#fff' : '#333', fontWeight: '500' }}>
                    {role}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => setShowCreateModal(false)}
                style={{ flex: 1, paddingVertical: 12, backgroundColor: '#f0f0f0', borderRadius: 6, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 14, color: '#333', fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleCreateUser}
                disabled={submitting}
                style={{ flex: 1, paddingVertical: 12, backgroundColor: '#007AFF', borderRadius: 6, alignItems: 'center' }}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ fontSize: 14, color: '#fff', fontWeight: '600' }}>Add User</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit User Modal */}
      {editingUser && (
        <Modal visible={!!editingUser} transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingVertical: 20, paddingBottom: 32 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Edit User</Text>

              <Text style={{ fontSize: 12, fontWeight: '500', marginBottom: 6, color: '#666' }}>Email</Text>
              <TextInput
                value={editingEmail}
                onChangeText={setEditingEmail}
                style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16, fontSize: 14 }}
              />

              <Text style={{ fontSize: 12, fontWeight: '500', marginBottom: 8, color: '#666' }}>Role</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {ROLE_OPTIONS.map((role) => (
                  <Pressable
                    key={role}
                    onPress={() => setEditingRole(role)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      marginRight: 8,
                      borderRadius: 6,
                      backgroundColor: editingRole === role ? '#007AFF' : '#e8e8e8',
                    }}
                  >
                    <Text style={{ fontSize: 13, color: editingRole === role ? '#fff' : '#333', fontWeight: '500' }}>
                      {role}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => setEditingUser(null)}
                  style={{ flex: 1, paddingVertical: 12, backgroundColor: '#f0f0f0', borderRadius: 6, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 14, color: '#333', fontWeight: '600' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleUpdateUser}
                  disabled={submitting}
                  style={{ flex: 1, paddingVertical: 12, backgroundColor: '#007AFF', borderRadius: 6, alignItems: 'center' }}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ fontSize: 14, color: '#fff', fontWeight: '600' }}>Update</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
