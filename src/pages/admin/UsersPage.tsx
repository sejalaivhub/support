import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { dbClient } from '@/lib/dbClient';
import { Spinner } from '@/components/ui';
import { fullName } from '@/lib/constants';
import type { Profile, Account } from '@/types';
import {
  Plus, Search, Pencil, Trash2, RefreshCw, Download, AlertCircle, X,
  ChevronLeft, ChevronRight, MoreVertical, RotateCcw, Filter, Check
} from 'lucide-react';
import { AddContactSlideOver } from '@/components/contacts/AddContactSlideOver';

const DEMO_ACCOUNTS: Account[] = [
  { id: 'acc-1', account_code: 'AIV001', company_name: 'AIV Hub', status: 'ACTIVE', country: 'USA', timezone: 'UTC', support_plan_id: 'plan-1', entitlement_source: 'MANUAL', external_account_id: null, support_start_date: null, support_end_date: null, support_team_id: null, account_manager_id: null, support_manager_id: null, business_calendar_id: null, customer_ticket_visibility: 'ACCOUNT_WIDE', notes_internal: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'acc-2', account_code: 'ACME001', company_name: 'Acme Corp', status: 'ACTIVE', country: 'USA', timezone: 'UTC', support_plan_id: 'plan-2', entitlement_source: 'MANUAL', external_account_id: null, support_start_date: null, support_end_date: null, support_team_id: null, account_manager_id: null, support_manager_id: null, business_calendar_id: null, customer_ticket_visibility: 'ACCOUNT_WIDE', notes_internal: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const DEMO_USERS: (Profile & { accounts?: { company_name: string } })[] = [
  { id: 'user-contact-1', email: 'harshvardhan@aivhub.com', auth_uid: null, first_name: 'Harsh', last_name: '', user_type: 'customer_user', account_id: 'acc-1', status: 'active', phone: null, mobile: null, job_title: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), accounts: { company_name: 'AIV Hub' } },
  { id: 'user-contact-2', email: 'parth.barot@aihub.com', auth_uid: null, first_name: 'Parth', last_name: '', user_type: 'customer_user', account_id: 'acc-1', status: 'active', phone: null, mobile: null, job_title: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), accounts: { company_name: 'AIV Hub' } },
  { id: 'user-contact-3', email: 'parth.barot@aivhub.com', auth_uid: null, first_name: 'Parth', last_name: '', user_type: 'customer_user', account_id: 'acc-1', status: 'active', phone: null, mobile: null, job_title: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), accounts: { company_name: 'AIV Hub' } },
  { id: 'user-contact-4', email: 'neel@aivhub.com', auth_uid: null, first_name: 'Neel', last_name: '', user_type: 'customer_user', account_id: 'acc-1', status: 'active', phone: null, mobile: '7575063401', job_title: 'Support Specialist', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), accounts: { company_name: 'AIV Hub' } },
  { id: 'user-contact-5', email: 'sejal@aivhub.com', auth_uid: null, first_name: 'Sejal', last_name: 'prasad', user_type: 'customer_user', account_id: null, status: 'active', phone: null, mobile: null, job_title: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'user-admin-1', email: 'admin@aivsupport.com', auth_uid: null, first_name: 'AIV', last_name: 'Admin', user_type: 'admin', account_id: null, status: 'active', phone: null, mobile: null, job_title: 'Portal Administrator', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

export function UsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<(Profile & { accounts?: { company_name: string } })[]>(DEMO_USERS);
  const [accounts, setAccounts] = useState<Account[]>(DEMO_ACCOUNTS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'deleted'>('all');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [showSlideOver, setShowSlideOver] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);

    let fetchedUsers: (Profile & { accounts?: { company_name: string } })[] = [];

    try {
      const { data } = await dbClient
        .from('profiles')
        .select('*, accounts(company_name)')
        .order('created_at', { ascending: false });
      if (data && data.length > 0) {
        fetchedUsers = data as any[];
      }
    } catch (e) {}

    // Local Storage custom users
    let customUsers: any[] = [];
    try {
      customUsers = JSON.parse(localStorage.getItem('local_custom_users') || '[]');
    } catch (e) {}

    const combined = fetchedUsers.length > 0
      ? [...customUsers, ...fetchedUsers]
      : [...customUsers, ...DEMO_USERS];

    // Deduplicate by ID and Email
    const seen = new Set<string>();
    const deduplicated: (Profile & { accounts?: { company_name: string } })[] = [];
    for (const u of combined) {
      const key = u.email.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(u);
      }
    }

    setUsers(deduplicated);

    // Load Accounts
    try {
      const { data: acctData } = await dbClient.from('accounts').select('*').eq('status', 'ACTIVE').order('company_name');
      if (acctData && acctData.length > 0) {
        setAccounts(acctData as Account[]);
      } else {
        setAccounts(DEMO_ACCOUNTS);
      }
    } catch (e) {
      setAccounts(DEMO_ACCOUNTS);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Listen to cross-component contact-created event
  useEffect(() => {
    const handleCreated = () => {
      load();
    };
    window.addEventListener('contact-created', handleCreated);
    return () => window.removeEventListener('contact-created', handleCreated);
  }, [load]);

  // Soft delete / Move to spam
  const handleDeleteUser = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveMenuId(null);

    try {
      const existingDeleted: string[] = JSON.parse(localStorage.getItem('deleted_user_ids') || '[]');
      const updatedDeleted = Array.from(new Set([...existingDeleted, id]));
      localStorage.setItem('deleted_user_ids', JSON.stringify(updatedDeleted));
      showToast('Contact moved to deleted contacts.');
      load();
    } catch (err) {}
  };

  // Restore deleted user
  const handleRestoreUser = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveMenuId(null);

    try {
      const existingDeleted: string[] = JSON.parse(localStorage.getItem('deleted_user_ids') || '[]');
      const updated = existingDeleted.filter((x) => x !== id);
      localStorage.setItem('deleted_user_ids', JSON.stringify(updated));
      showToast('Contact restored to All contacts.');
      load();
    } catch (err) {}
  };

  // Permanent Delete
  const handlePermanentDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveMenuId(null);
    if (!confirm('Are you sure you want to permanently delete this contact?')) return;

    try {
      await dbClient.from('profiles').delete().eq('id', id);
    } catch (e) {}

    try {
      const custom: any[] = JSON.parse(localStorage.getItem('local_custom_users') || '[]');
      const updatedCustom = custom.filter((u) => u.id !== id);
      localStorage.setItem('local_custom_users', JSON.stringify(updatedCustom));
    } catch (e) {}

    try {
      const existingDeleted: string[] = JSON.parse(localStorage.getItem('deleted_user_ids') || '[]');
      const updatedDeleted = existingDeleted.filter((x) => x !== id);
      localStorage.setItem('deleted_user_ids', JSON.stringify(updatedDeleted));
    } catch (e) {}

    showToast('Contact permanently deleted.');
    load();
  };

  // Filtered contacts based on active view mode and search query
  const filtered = useMemo(() => {
    let deletedUserIds: string[] = [];
    try {
      deletedUserIds = JSON.parse(localStorage.getItem('deleted_user_ids') || '[]');
    } catch (e) {}

    let list = users;
    if (viewMode === 'deleted') {
      list = users.filter((u) => deletedUserIds.includes(u.id));
    } else {
      list = users.filter((u) => !deletedUserIds.includes(u.id));
    }

    if (search.trim()) {
      const s = search.toLowerCase().trim();
      list = list.filter((u) =>
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s) ||
        (u.mobile && u.mobile.includes(s)) ||
        (u.phone && u.phone.includes(s))
      );
    }

    return list;
  }, [users, viewMode, search]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filtered.map((u) => u.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  if (loading) return <Spinner label="Loading contacts..." />;

  return (
    <div className="bg-[#f8fafc] min-h-screen text-[#12344d]">
      {/* ── Top Bar matching Screenshot 1 & 2 ───────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 sm:px-8 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <Filter className="w-4 h-4 text-gray-400" />
          <div className="relative">
            <select
              value={viewMode}
              onChange={(e) => {
                setViewMode(e.target.value as any);
                setSelectedIds([]);
              }}
              className="font-bold text-base text-[#12344d] bg-transparent border-none outline-none cursor-pointer pr-5 hover:text-blue-600 transition-colors"
            >
              <option value="all">All contacts</option>
              <option value="deleted">Deleted contacts</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              load();
              showToast('Contacts refreshed');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 bg-white shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-gray-600" />
            <span>Sync</span>
          </button>

          <button
            onClick={() => {
              const csv = filtered.map((u) => `"${u.first_name} ${u.last_name}","${u.email}","${u.mobile || u.phone || ''}"`).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${viewMode}_contacts.csv`;
              a.click();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 bg-white shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-gray-600" />
            <span>Export</span>
          </button>

          {/* New Contact button triggers the Slide-Over Panel */}
          <button
            onClick={() => setShowSlideOver(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#186ade] hover:bg-[#1457b8] text-white text-xs font-semibold rounded shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New contact</span>
          </button>
        </div>
      </div>

      {/* ── Table Container Matching Freshdesk Screenshot 1 & 2 ─────── */}
      <div className="p-6 sm:p-8">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-2xs">
          {/* Card Top Toolbar (Select all, Search, Export, Sync, Pagination) */}
          <div className="p-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap text-xs">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 font-medium text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selectedIds.length === filtered.length}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <span>Select all</span>
              </label>
              {selectedIds.length > 0 && (
                <span className="text-blue-600 font-semibold">({selectedIds.length} selected)</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Search box */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search contacts..."
                  className="pl-8 pr-3 py-1.5 border border-gray-200 rounded text-xs w-48 outline-none focus:border-blue-500 bg-gray-50/50"
                />
              </div>

              {/* Pagination matching Screenshot 1: 1 - 3 of 3 < > */}
              <div className="flex items-center gap-1.5 text-gray-500">
                <span className="font-medium text-xs">
                  {filtered.length === 0 ? '0 of 0' : `1 - ${filtered.length} of ${filtered.length}`}
                </span>
                <button
                  disabled
                  className="p-1 text-gray-300 rounded hover:bg-gray-100 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled
                  className="p-1 text-gray-300 rounded hover:bg-gray-100 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Spam Warning Banner (Screenshot 1: All communication from the deleted contacts will be marked as spam) */}
          {viewMode === 'deleted' && (
            <div className="bg-[#e0f2fe] border-b border-[#bae6fd] px-6 sm:px-8 py-2.5 text-xs text-[#0369a1] flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 text-[#0284c7] shrink-0" />
                <span>All communication from the deleted contacts will be marked as spam</span>
              </div>
              <button
                onClick={() => setViewMode('all')}
                className="text-[#0284c7] hover:text-[#0369a1] p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="py-20 text-center text-gray-400 text-xs">
              No contacts found in {viewMode === 'deleted' ? 'Deleted contacts' : 'All contacts'}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-[#fbfcfd] text-gray-600 font-semibold select-none">
                    <th className="w-10 px-4 py-3"></th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Email address</th>
                    <th className="px-4 py-3">Mobile phone</th>
                    <th className="px-4 py-3">Work phone</th>
                    <th className="px-4 py-3">Social Handle</th>
                    <th className="w-10 px-4 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((u, idx) => {
                    const initials = (u.first_name || u.email || 'U').charAt(0).toUpperCase();
                    const avatarBg =
                      idx % 3 === 0
                        ? 'bg-[#fef3c7] text-[#92400e]'
                        : idx % 3 === 1
                        ? 'bg-[#e0e7ff] text-[#3730a3]'
                        : 'bg-[#e0f2fe] text-[#0369a1]';
                    const isChecked = selectedIds.includes(u.id);

                    return (
                      <tr
                        key={u.id}
                        onClick={() => navigate(`/admin/contacts/${u.id}`)}
                        className="hover:bg-[#f8fafc] cursor-pointer group transition-colors"
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handleSelectOne(u.id, e as any)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          />
                        </td>

                        {/* Contact Name & Avatar */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 select-none ${avatarBg}`}>
                              {initials}
                            </div>
                            <span className="font-bold text-[#186ade] group-hover:underline">
                              {fullName(u.first_name, u.last_name)}
                            </span>
                          </div>
                        </td>

                        {/* Title */}
                        <td className="px-4 py-3.5 text-gray-500">{u.job_title || '--'}</td>

                        {/* Company */}
                        <td className="px-4 py-3.5 text-gray-700 font-medium">
                          {u.accounts?.company_name || '--'}
                        </td>

                        {/* Email address */}
                        <td className="px-4 py-3.5 text-gray-600">{u.email}</td>

                        {/* Mobile phone */}
                        <td className="px-4 py-3.5 text-gray-500">{u.mobile || '--'}</td>

                        {/* Work phone */}
                        <td className="px-4 py-3.5 text-gray-500">{u.phone || '--'}</td>

                        {/* Social Handle */}
                        <td className="px-4 py-3.5 text-gray-500">
                          {u.social_handle ? `${u.social_platform ? u.social_platform + ': ' : ''}${u.social_handle}` : '--'}
                        </td>

                        {/* 3 Vertical Dots Menu (Screenshot 1 & 2) */}
                        <td className="px-4 py-3.5 text-right relative" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setActiveMenuId(activeMenuId === u.id ? null : u.id)}
                            className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeMenuId === u.id && (
                            <div className="absolute right-4 top-10 w-44 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-30 animate-in fade-in zoom-in-95 text-xs text-left">
                              <button
                                onClick={() => {
                                  setActiveMenuId(null);
                                  navigate(`/admin/contacts/${u.id}`);
                                }}
                                className="w-full px-3.5 py-2 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Pencil className="w-3.5 h-3.5 text-gray-500" />
                                <span>Edit contact</span>
                              </button>

                              {viewMode === 'all' ? (
                                <button
                                  onClick={(e) => handleDeleteUser(u.id, e)}
                                  className="w-full px-3.5 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                  <span>Delete contact</span>
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={(e) => handleRestoreUser(u.id, e)}
                                    className="w-full px-3.5 py-2 text-green-700 hover:bg-green-50 flex items-center gap-2"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5 text-green-600" />
                                    <span>Restore contact</span>
                                  </button>
                                  <button
                                    onClick={(e) => handlePermanentDelete(u.id, e)}
                                    className="w-full px-3.5 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                    <span>Delete permanently</span>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Bottom Pagination Controls (Screenshot 1: < >) */}
          <div className="p-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <button
                disabled
                className="p-1 rounded border border-gray-200 text-gray-300 disabled:opacity-50"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                disabled
                className="p-1 rounded border border-gray-200 text-gray-300 disabled:opacity-50"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <span>Showing {filtered.length} contact{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* ── Slide-Over Add Contact Panel (Matching Screenshot 3) ─────── */}
      <AddContactSlideOver
        open={showSlideOver}
        onClose={() => setShowSlideOver(false)}
        existingContacts={users}
        accounts={accounts}
        onSuccess={(newContact) => {
          setUsers((prev) => [newContact, ...prev.filter((u) => u.id !== newContact.id)]);
          showToast(`Contact ${fullName(newContact.first_name, newContact.last_name)} created successfully!`);
          load();
        }}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-white px-5 py-3 rounded-lg shadow-xl border-t-[3px] border-[#00b27b] animate-in fade-in slide-in-from-top-4">
          <div className="w-5 h-5 rounded-full bg-[#00b27b] text-white flex items-center justify-center">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
          <span className="text-sm font-semibold text-gray-800">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-gray-400 hover:text-gray-600 ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
