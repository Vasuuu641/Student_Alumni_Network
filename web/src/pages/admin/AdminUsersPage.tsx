import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Search, Trash2, UserPlus } from 'lucide-react';
import {
  createAuthorizedUser,
  deleteAuthorizedUser,
  listAuthorizedUsers,
  type AuthorizedRole,
  type AuthorizedUser,
  updateAuthorizedUser,
} from '../../api/admin.api';

const ROLE_OPTIONS: AuthorizedRole[] = ['STUDENT', 'PROFESSOR', 'ALUMNI', 'ADMIN'];

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function AdminUsersPage() {
  const [users, setUsers] = useState<AuthorizedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | AuthorizedRole>('ALL');

  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AuthorizedRole>('STUDENT');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState('');
  const [editingRole, setEditingRole] = useState<AuthorizedRole>('STUDENT');

  useEffect(() => {
    void loadUsers();
  }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      setError(null);
      const data = await listAuthorizedUsers();
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
    const timeout = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newEmail.trim()) return;

    try {
      setSubmitting(true);
      setError(null);
      const created = await createAuthorizedUser({
        email: newEmail.trim(),
        role: newRole,
      });
      setUsers((prev) => [created, ...prev]);
      setNewEmail('');
      setNewRole('STUDENT');
      setNotice('Authorized user added successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add authorized user.');
    } finally {
      setSubmitting(false);
    }
  }

  function beginEdit(user: AuthorizedUser) {
    setEditingId(user.id);
    setEditingEmail(user.email);
    setEditingRole(user.role);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingEmail('');
    setEditingRole('STUDENT');
  }

  async function handleSaveEdit(userId: string) {
    try {
      setSubmitting(true);
      setError(null);
      const updated = await updateAuthorizedUser(userId, {
        email: editingEmail.trim(),
        role: editingRole,
      });
      setUsers((prev) => prev.map((user) => (user.id === userId ? updated : user)));
      cancelEdit();
      setNotice('Authorized user updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update authorized user.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteUser(userId: string) {
    try {
      setSubmitting(true);
      setError(null);
      await deleteAuthorizedUser(userId);
      setUsers((prev) => prev.filter((user) => user.id !== userId));
      setNotice('Authorized user removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete authorized user.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="admin-card-stack">
      <header className="admin-page-header">
        <div>
          <h1>User Management</h1>
          <p>{users.length} users in the system</p>
        </div>
      </header>

      <form className="admin-form-card" onSubmit={handleCreateUser}>
        <div className="admin-form-card__title">
          <UserPlus size={16} />
          Register New User Access
        </div>

        <div className="admin-form-grid">
          <label>
            University Email
            <input
              type="email"
              value={newEmail}
              placeholder="name@university.edu"
              onChange={(event) => setNewEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Role
            <select value={newRole} onChange={(event) => setNewRole(event.target.value as AuthorizedRole)}>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" className="admin-primary-btn" disabled={submitting}>
            {submitting ? <Loader2 className="spin" size={15} /> : <Plus size={15} />}
            Add Access
          </button>
        </div>
      </form>

      <section className="admin-table-card">
        <div className="admin-table-toolbar">
          <label className="admin-search-wrap">
            <Search size={15} />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search by email"
            />
          </label>

          <select
            className="admin-filter-select"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as 'ALL' | AuthorizedRole)}
          >
            <option value="ALL">All Roles</option>
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        {error ? <p className="admin-status admin-status--error">{error}</p> : null}
        {notice ? <p className="admin-status admin-status--success">{notice}</p> : null}

        {loading ? (
          <div className="admin-state-wrap">
            <Loader2 className="spin" size={16} /> Loading users...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="admin-state-wrap">No users found for this filter.</div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const isEditing = editingId === user.id;
                  return (
                    <tr key={user.id}>
                      <td>
                        {isEditing ? (
                          <input
                            className="admin-inline-input"
                            value={editingEmail}
                            onChange={(event) => setEditingEmail(event.target.value)}
                          />
                        ) : (
                          user.email
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <select
                            className="admin-inline-select"
                            value={editingRole}
                            onChange={(event) => setEditingRole(event.target.value as AuthorizedRole)}
                          >
                            {ROLE_OPTIONS.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={`admin-role-pill admin-role-pill--${user.role.toLowerCase()}`}>
                            {user.role}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`admin-status-pill ${user.isUsed ? 'used' : 'active'}`}>
                          {user.isUsed ? 'Used' : 'Active'}
                        </span>
                      </td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td>
                        <div className="admin-row-actions">
                          {isEditing ? (
                            <>
                              <button
                                className="admin-text-btn"
                                onClick={() => void handleSaveEdit(user.id)}
                                disabled={submitting || !editingEmail.trim()}
                              >
                                Save
                              </button>
                              <button className="admin-text-btn" onClick={cancelEdit}>
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button className="admin-icon-btn" onClick={() => beginEdit(user)}>
                                <Pencil size={14} />
                              </button>
                              <button
                                className="admin-icon-btn danger"
                                onClick={() => void handleDeleteUser(user.id)}
                                disabled={submitting || user.isUsed}
                                title={user.isUsed ? 'Cannot delete already used authorized user' : 'Delete user'}
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
