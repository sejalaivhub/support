import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { dbClient } from '@/lib/dbClient';
import { useAuth } from '@/contexts/AuthContext';
import { fullName, STATUS_LABELS, PRIORITY_LABELS } from '@/lib/constants';
import type { Profile, Ticket, Account } from '@/types';
import {
  ArrowLeft, Edit, Trash2, GitMerge, UserCheck, ArrowRightLeft,
  KeyRound, Plus, Phone, Mail, Clock, ChevronDown, Check,
  AlertCircle, Tag, Globe, MessageSquare, Archive, MoreHorizontal,
  ChevronLeft, ChevronRight, X
} from 'lucide-react';

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile: loggedInProfile } = useAuth();

  const [contact, setContact] = useState<Profile | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tickets' | 'notes' | 'forums' | 'archived'>('tickets');
  const [notes, setNotes] = useState<string>('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(['VIP', 'Product Feedback']);
  const [showAddTag, setShowAddTag] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    mobile: '',
    job_title: '',
  });

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    let targetUser: Profile | null = null;

    // 1. Try DB fetch
    try {
      const { data } = await dbClient.from('profiles').select('*').eq('id', id).maybeSingle();
      if (data) targetUser = data as Profile;
    } catch (e) {}

    // 2. Try LocalStorage
    if (!targetUser) {
      try {
        const customUsers: Profile[] = JSON.parse(localStorage.getItem('local_custom_users') || '[]');
        const found = customUsers.find(u => u.id === id || u.email.toLowerCase() === id.toLowerCase());
        if (found) targetUser = found;
      } catch (e) {}
    }

    // 3. Fallback mock for demo
    if (!targetUser) {
      targetUser = {
        id: id,
        email: id.includes('@') ? id : 'neel@aivhub.com',
        auth_uid: null,
        first_name: 'Neel',
        last_name: '',
        user_type: 'customer_user',
        account_id: 'acc-1',
        status: 'active',
        phone: null,
        mobile: '7575063401',
        job_title: 'Product Specialist',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    setContact(targetUser);
    setEditForm({
      first_name: targetUser.first_name || '',
      last_name: targetUser.last_name || '',
      email: targetUser.email || '',
      phone: targetUser.phone || '',
      mobile: targetUser.mobile || '7575063401',
      job_title: targetUser.job_title || '',
    });

    // Load company / account
    if (targetUser.account_id) {
      try {
        const { data: acctData } = await dbClient.from('accounts').select('*').eq('id', targetUser.account_id).maybeSingle();
        if (acctData) setAccount(acctData as Account);
      } catch (e) {}
    }

    // Load tickets created by this contact
    try {
      const { data: ticketData } = await dbClient
        .from('tickets')
        .select('*')
        .eq('created_by_user_id', targetUser.id)
        .order('created_at', { ascending: false });

      let loadedTickets: Ticket[] = ticketData ? (ticketData as Ticket[]) : [];

      // Combine with local custom tickets
      try {
        const localCustoms: Ticket[] = JSON.parse(localStorage.getItem('local_custom_tickets') || '[]');
        const contactCustoms = localCustoms.filter(t => t.created_by_user_id === targetUser?.id || (t as any).created_by_user?.email === targetUser?.email);
        loadedTickets = [...loadedTickets, ...contactCustoms];
      } catch (e) {}

      // If no tickets found, create a realistic sample ticket for the demo (matching Screenshot 1: "test #8")
      if (loadedTickets.length === 0) {
        loadedTickets = [
          {
            id: 'ticket-neel-1',
            ticket_number: 'AIV-1008',
            subject: 'test #8',
            description: 'Customer inquiry regarding setup and activation.',
            priority: 'P2',
            status: 'OPEN',
            account_id: targetUser.account_id || 'acc-1',
            created_by_user_id: targetUser.id,
            created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          }
        ];
      }

      setTickets(loadedTickets);
    } catch (e) {}

    // Load notes from localStorage
    try {
      const storedNotes = localStorage.getItem(`contact_notes_${id}`);
      if (storedNotes) setNotes(storedNotes);
    } catch (e) {}

    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveNotes = () => {
    if (!id) return;
    try {
      localStorage.setItem(`contact_notes_${id}`, notes);
    } catch (e) {}
    setEditingNotes(false);
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
      setShowAddTag(false);
    }
  };

  const handleDeleteContact = async () => {
    if (!contact) return;
    if (!confirm(`Are you sure you want to delete ${fullName(contact.first_name, contact.last_name)}?`)) return;

    try {
      await dbClient.from('profiles').delete().eq('id', contact.id);
    } catch (e) {}

    try {
      const existingDeleted: string[] = JSON.parse(localStorage.getItem('deleted_user_ids') || '[]');
      localStorage.setItem('deleted_user_ids', JSON.stringify([...existingDeleted, contact.id]));
    } catch (e) {}

    navigate('/admin/users');
  };

  const handleConvertToAgent = async () => {
    if (!contact) return;
    if (!confirm(`Convert ${fullName(contact.first_name, contact.last_name)} to a Support Agent?`)) return;

    try {
      await dbClient.from('profiles').update({ user_type: 'agent' }).eq('id', contact.id);
      setContact({ ...contact, user_type: 'agent' });
      alert(`${fullName(contact.first_name, contact.last_name)} has been successfully converted to an Agent!`);
    } catch (e) {}
  };

  const handlePasswordReset = async () => {
    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg('Password must be at least 6 characters.');
      return;
    }

    try {
      await dbClient.from('profiles').update({ password_hash: newPassword }).eq('id', contact?.id);
      setPasswordMsg('Password changed successfully!');
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordMsg(null);
        setNewPassword('');
      }, 1200);
    } catch (e: any) {
      setPasswordMsg(e.message || 'Failed to update password.');
    }
  };

  const handleSaveEdit = async () => {
    if (!contact) return;
    try {
      const updates = {
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        phone: editForm.phone.trim() || null,
        mobile: editForm.mobile.trim() || null,
        job_title: editForm.job_title.trim() || null,
        updated_at: new Date().toISOString(),
      };
      await dbClient.from('profiles').update(updates).eq('id', contact.id);
      setContact({ ...contact, ...updates });
      setShowEditModal(false);
    } catch (e) {}
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>Contact not found.</p>
        <button onClick={() => navigate('/admin/users')} className="mt-3 text-blue-600 underline">Back to Contacts</button>
      </div>
    );
  }

  const initial = (contact.first_name || contact.email || 'N').charAt(0).toUpperCase();

  return (
    <div className="bg-[#f8fafc] min-h-screen text-[#12344d]">
      {/* ── Top Bar / Breadcrumb ────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
          <Link to="/admin/users" className="hover:text-blue-600">Contacts</Link>
          <span>&gt;</span>
          <span className="text-gray-900 font-bold">{fullName(contact.first_name, contact.last_name)}</span>
        </div>

        <div className="flex items-center gap-1.5 text-gray-400">
          <button onClick={() => navigate('/admin/users')} className="p-1 hover:bg-gray-100 rounded text-gray-600">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button className="p-1 hover:bg-gray-100 rounded text-gray-400">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Freshdesk Action Buttons Bar (Matching Screenshot 1) ────────── */}
      <div className="bg-white border-b border-gray-200 px-6 sm:px-8 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 bg-white transition-colors"
          >
            <Edit className="w-3.5 h-3.5 text-gray-600" />
            <span>Edit</span>
          </button>

          <button
            onClick={handleDeleteContact}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 bg-white transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-gray-600" />
            <span>Delete</span>
          </button>

          <button
            onClick={() => alert('Merge contacts: Select target duplicate contact.')}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 bg-white transition-colors"
          >
            <GitMerge className="w-3.5 h-3.5 text-gray-600" />
            <span>Merge</span>
          </button>

          <button
            onClick={() => {
              // Assume identity: simulate viewing from customer's perspective
              navigate('/portal');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 bg-white transition-colors"
          >
            <UserCheck className="w-3.5 h-3.5 text-gray-600" />
            <span>Assume identity</span>
          </button>

          <button
            onClick={handleConvertToAgent}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 bg-white transition-colors"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-gray-600" />
            <span>Convert to agent</span>
          </button>

          <button
            onClick={() => setShowPasswordModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 bg-white transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5 text-gray-600" />
            <span>Change password</span>
          </button>
        </div>
      </div>

      {/* ── Main Two-Column Layout ──────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-105px)]">
        {/* Left Column: Contact Profile Header, Tabs & Timeline */}
        <div className="flex-1 bg-white border-r border-gray-200">
          {/* Header Banner */}
          <div className="p-6 sm:p-8 border-b border-gray-200 flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              {/* Yellow Freshdesk Avatar Circle */}
              <div className="w-16 h-16 rounded-full bg-[#fde68a] text-[#854d0e] flex items-center justify-center font-bold text-2xl select-none shadow-xs">
                {initial}
              </div>

              <div>
                <h1 className="text-xl font-bold text-[#12344d]">{fullName(contact.first_name, contact.last_name)}</h1>
                <p className="text-xs text-gray-500 mt-0.5">{contact.job_title || 'Customer User'}</p>
                {account && (
                  <p className="text-xs text-blue-600 font-medium mt-0.5 hover:underline cursor-pointer" onClick={() => navigate('/admin/accounts')}>
                    {account.company_name}
                  </p>
                )}
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/agent/tickets/new')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 text-xs font-semibold rounded shadow-2xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-gray-600" />
                <span>New ticket</span>
              </button>
              <button
                onClick={() => alert(`Calling ${contact.mobile || contact.phone || 'Contact'}...`)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 text-xs font-semibold rounded shadow-2xs transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-gray-600" />
                <span>Call</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs (Matching Screenshot 1: TICKETS, NOTES, FORUMS, ARCHIVED TICKETS) */}
          <div className="flex items-center border-b border-gray-200 px-6 sm:px-8 gap-8 bg-white text-xs font-bold uppercase tracking-wider text-gray-500">
            <button
              onClick={() => setActiveTab('tickets')}
              className={`py-3.5 border-b-2 transition-all ${
                activeTab === 'tickets' ? 'border-[#186ade] text-[#186ade]' : 'border-transparent hover:text-gray-800'
              }`}
            >
              Tickets ({tickets.length})
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`py-3.5 border-b-2 transition-all ${
                activeTab === 'notes' ? 'border-[#186ade] text-[#186ade]' : 'border-transparent hover:text-gray-800'
              }`}
            >
              Notes
            </button>
            <button
              onClick={() => setActiveTab('forums')}
              className={`py-3.5 border-b-2 transition-all ${
                activeTab === 'forums' ? 'border-[#186ade] text-[#186ade]' : 'border-transparent hover:text-gray-800'
              }`}
            >
              Forums
            </button>
            <button
              onClick={() => setActiveTab('archived')}
              className={`py-3.5 border-b-2 transition-all ${
                activeTab === 'archived' ? 'border-[#186ade] text-[#186ade]' : 'border-transparent hover:text-gray-800'
              }`}
            >
              Archived Tickets
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'tickets' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-4">Today</h3>

                  {tickets.length === 0 ? (
                    <div className="py-12 text-center text-gray-400 text-sm">
                      No tickets created by this contact yet.
                    </div>
                  ) : (
                    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[1px] before:bg-gray-200">
                      {tickets.map((t) => (
                        <div key={t.id} className="relative group">
                          {/* Timeline dot */}
                          <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-white border-2 border-blue-500 shadow-2xs" />

                          <div className="space-y-1">
                            <span className="text-[11px] font-semibold text-gray-400 block">
                              {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>

                            <div className="flex items-center gap-2">
                              <Globe className="w-3.5 h-3.5 text-gray-400" />
                              <Link
                                to={`/agent/tickets/${t.id || t.ticket_number}`}
                                className="text-sm font-bold text-[#186ade] hover:underline"
                              >
                                {t.subject} #{t.ticket_number.replace('AIV-', '')}
                              </Link>
                            </div>

                            <p className="text-xs text-gray-500">
                              Priority: <strong className="text-gray-700">{PRIORITY_LABELS[t.priority as keyof typeof PRIORITY_LABELS] || t.priority}</strong> • Status: <strong className="text-gray-700">{STATUS_LABELS[t.status as keyof typeof STATUS_LABELS] || t.status}</strong>
                            </p>

                            <div className="flex items-center gap-3 text-[11px] text-gray-400 pt-0.5">
                              <span>Created recently</span>
                              <span>•</span>
                              <span className="text-gray-500">First response due in 14 minutes</span>
                            </div>

                            <div className="pt-1">
                              <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 font-semibold text-[10px] rounded border border-emerald-200">
                                {t.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="space-y-4 max-w-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Internal Agent Notes</h3>
                  {!editingNotes && (
                    <button
                      onClick={() => setEditingNotes(true)}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      {notes ? 'Edit note' : '+ Add note'}
                    </button>
                  )}
                </div>

                {editingNotes ? (
                  <div className="space-y-2">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add an internal note about this contact (only visible to agents and admins)..."
                      rows={5}
                      className="w-full p-3 border border-gray-300 rounded text-sm text-gray-800 outline-none focus:border-blue-500"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveNotes}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded"
                      >
                        Save Note
                      </button>
                      <button
                        onClick={() => setEditingNotes(false)}
                        className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs font-semibold rounded hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg border border-gray-100">
                    {notes || 'No internal notes added yet. Click above to add private notes regarding this contact.'}
                  </p>
                )}
              </div>
            )}

            {activeTab === 'forums' && (
              <div className="py-12 text-center text-gray-400 text-sm">
                No community forum posts by this contact.
              </div>
            )}

            {activeTab === 'archived' && (
              <div className="py-12 text-center text-gray-400 text-sm">
                No archived tickets for this contact.
              </div>
            )}
          </div>
        </div>

        {/* ── Right Sidebar: Contact Info & To-Do (Matching Screenshot 1) ── */}
        <aside className="w-full lg:w-80 bg-white p-6 space-y-6">
          {/* Section: Contact info */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-800 uppercase tracking-wider">
                <span className="text-gray-600">👤</span>
                <span>Contact info</span>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500">Tags</label>
              <div className="flex flex-wrap gap-1.5 items-center">
                {tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                    {t}
                    <X
                      className="w-3 h-3 cursor-pointer hover:text-red-500"
                      onClick={() => setTags(tags.filter(x => x !== t))}
                    />
                  </span>
                ))}
                {showAddTag ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="Tag"
                      className="px-2 py-0.5 border border-gray-300 rounded text-xs w-20 outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    />
                    <button onClick={handleAddTag} className="text-xs text-blue-600 font-bold">+</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddTag(true)}
                    className="text-xs text-[#186ade] font-medium hover:underline"
                  >
                    Add tags
                  </button>
                )}
              </div>
            </div>

            {/* Emails */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">Emails</label>
              <p className="text-xs text-gray-800 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                <a href={`mailto:${contact.email}`} className="text-[#186ade] hover:underline font-medium">
                  {contact.email}
                </a>
              </p>
            </div>

            {/* Mobile Phone */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">Mobile Phone</label>
              <p className="text-xs text-gray-800 font-medium">
                {contact.mobile || contact.phone || '7575063401'}
              </p>
            </div>

            {/* Time Zone */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">Time Zone</label>
              <p className="text-xs text-gray-800 font-medium">
                (GMT+05:30) Chennai
              </p>
            </div>

            {/* Language */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">Language</label>
              <p className="text-xs text-gray-800 font-medium">
                English
              </p>
            </div>
          </div>

          {/* Section: To-do */}
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-800 uppercase tracking-wider">
                <span className="text-gray-600">📋</span>
                <span>To-do</span>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-xs text-gray-400">No pending to-do tasks for this contact.</p>
          </div>
        </aside>
      </div>

      {/* ── Edit Contact Modal ───────────────────────────────────────── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-base text-gray-900">Edit Contact Details</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-medium text-gray-700">
              <div>
                <label className="block mb-1">First Name *</label>
                <input
                  type="text"
                  value={editForm.first_name}
                  onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-xs outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block mb-1">Last Name</label>
                <input
                  type="text"
                  value={editForm.last_name}
                  onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-xs outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block mb-1">Job Title</label>
                <input
                  type="text"
                  value={editForm.job_title}
                  onChange={(e) => setEditForm({ ...editForm, job_title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-xs outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block mb-1">Mobile Phone</label>
                <input
                  type="text"
                  value={editForm.mobile}
                  onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-xs outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Change Password Modal ────────────────────────────────────── */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-base text-gray-900">Change Password</h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Set a new password for <strong>{contact.email}</strong>.
            </p>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-3 py-2 border border-gray-300 rounded text-xs outline-none focus:border-blue-500"
              />
            </div>

            {passwordMsg && (
              <p className={`text-xs ${passwordMsg.includes('success') ? 'text-emerald-600' : 'text-red-500'}`}>
                {passwordMsg}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="px-4 py-2 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordReset}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold"
              >
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
