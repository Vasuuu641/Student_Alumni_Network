import { useEffect, useMemo, useState } from 'react';
import { Loader2, Pin, Search, MessageSquareText, Lock, Unlock, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { listThreadsForAdmin, setThreadStatus, type AdminThread } from '../../api/admin.api';

type PanelFilter = 'ACADEMIC' | 'ALUMNI';
type StatusFilter = 'ALL' | 'OPEN' | 'CLOSED' | 'PINNED';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function AdminThreadsModerationPage() {
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
    const timeout = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function loadThreads() {
    try {
      setLoading(true);
      setError(null);
      const { threads: fetched } = await listThreadsForAdmin({
        panel: panelFilter,
        sortBy: 'newest',
        take: 100,
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
      await setThreadStatus(threadId, status);
      setThreads((prev) => prev.map((thread) => (
        thread.id === threadId ? { ...thread, status } : thread
      )));
      setNotice(`Thread updated to ${status}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update thread status.');
    } finally {
      setActingId(null);
    }
  }

  return (
    <section className="admin-card-stack">
      <header className="admin-page-header">
        <div>
          <h1>Thread Moderation</h1>
          <p>Pin important threads and control discussion status across panels.</p>
        </div>
      </header>

      <section className="admin-table-card">
        <div className="admin-table-toolbar">
          <div className="admin-panel-tabs" role="tablist" aria-label="Thread panels">
            <button
              className={`admin-panel-tab ${panelFilter === 'ACADEMIC' ? 'active' : ''}`}
              onClick={() => setPanelFilter('ACADEMIC')}
            >
              Academic
            </button>
            <button
              className={`admin-panel-tab ${panelFilter === 'ALUMNI' ? 'active' : ''}`}
              onClick={() => setPanelFilter('ALUMNI')}
            >
              Alumni
            </button>
          </div>

          <label className="admin-search-wrap">
            <Search size={15} />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search threads"
            />
          </label>

          <select
            className="admin-filter-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
            <option value="PINNED">Pinned</option>
          </select>
        </div>

        {error ? <p className="admin-status admin-status--error">{error}</p> : null}
        {notice ? <p className="admin-status admin-status--success">{notice}</p> : null}

        {loading ? (
          <div className="admin-state-wrap">
            <Loader2 className="spin" size={16} /> Loading threads...
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="admin-state-wrap">
            <MessageSquareText size={16} /> No threads found for this panel/filter.
          </div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Thread</th>
                  <th>Status</th>
                  <th>Replies</th>
                  <th>Score</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredThreads.map((thread) => {
                  const isBusy = actingId === thread.id;
                  return (
                    <tr key={thread.id}>
                      <td>
                        <div className="admin-thread-title-wrap">
                          <p>{thread.title}</p>
                          <Link to={`/threads/${thread.id}`} className="admin-thread-link">
                            Open
                            <ExternalLink size={12} />
                          </Link>
                        </div>
                      </td>
                      <td>
                        <span className={`admin-status-pill review review--${thread.status.toLowerCase()}`}>
                          {thread.status}
                        </span>
                      </td>
                      <td>{thread.replyCount}</td>
                      <td>{thread.voteScore}</td>
                      <td>{formatDate(thread.createdAt)}</td>
                      <td>
                        <div className="admin-row-actions">
                          <button
                            className="admin-icon-btn"
                            onClick={() => void handleStatusChange(thread.id, 'PINNED')}
                            disabled={isBusy || thread.status === 'PINNED'}
                            title="Pin thread"
                          >
                            {isBusy ? <Loader2 className="spin" size={14} /> : <Pin size={14} />}
                          </button>

                          <button
                            className="admin-icon-btn"
                            onClick={() => void handleStatusChange(thread.id, 'OPEN')}
                            disabled={isBusy || thread.status === 'OPEN'}
                            title="Reopen thread"
                          >
                            <Unlock size={14} />
                          </button>

                          <button
                            className="admin-icon-btn"
                            onClick={() => void handleStatusChange(thread.id, 'CLOSED')}
                            disabled={isBusy || thread.status === 'CLOSED'}
                            title="Close thread"
                          >
                            <Lock size={14} />
                          </button>
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
