import React, { useState, useEffect, useMemo, useRef } from 'react';
import { dbClient } from '@/lib/dbClient';
import { sendAccountActivationEmail } from '@/lib/emailService';
import { fullName } from '@/lib/constants';
import type { Profile, Account } from '@/types';
import {
  X, Plus, Trash2, ShieldCheck, AlertCircle, ExternalLink,
  ChevronDown, Search, Ticket, Check, Mail, Phone
} from 'lucide-react';

interface AddContactSlideOverProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (newContact: Profile) => void;
  existingContacts: Profile[];
  accounts: Account[];
}

// Social platform definitions matching Image 3
interface SocialPlatformOption {
  id: string;
  name: string;
  icon: (props: { className?: string }) => React.ReactNode;
}

const SOCIAL_PLATFORMS: SocialPlatformOption[] = [
  {
    id: 'WhatsApp',
    name: 'WhatsApp',
    icon: ({ className = 'w-4 h-4' }) => (
      <svg className={`${className} fill-current`} viewBox="0 0 24 24">
        <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.062-2.18-.553-1.614-.666-2.658-2.316-2.738-2.423-.08-.106-.653-.87-.653-1.658 0-.788.412-1.177.559-1.336.147-.16.32-.2.427-.2.106 0 .213.001.306.006.103.005.239-.039.373.283.144.346.49 1.199.533 1.287.043.088.072.191.013.308-.059.117-.088.19-.175.293-.088.104-.185.232-.264.312-.088.088-.18.184-.077.361.103.177.458.756.983 1.224.675.602 1.244.788 1.421.876.177.088.281.073.385-.046.104-.119.444-.517.563-.695.118-.178.237-.148.399-.089.162.059 1.026.484 1.203.573.177.089.294.133.338.207.044.074.044.43-.1 1.035z"/>
      </svg>
    ),
  },
  {
    id: 'Facebook',
    name: 'Facebook',
    icon: ({ className = 'w-4 h-4' }) => (
      <svg className={`${className} fill-current`} viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  {
    id: 'Instagram',
    name: 'Instagram',
    icon: ({ className = 'w-4 h-4' }) => (
      <svg className={`${className} fill-none stroke-current stroke-2`} viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
      </svg>
    ),
  },
  {
    id: 'X (Twitter)',
    name: 'X (Twitter)',
    icon: ({ className = 'w-4 h-4' }) => (
      <svg className={`${className} fill-current`} viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
];

const TIMEZONES = [
  '(GMT-08:00) Pacific Time (US & Canada)',
  '(GMT-07:00) Mountain Time (US & Canada)',
  '(GMT-06:00) Central Time (US & Canada)',
  '(GMT-05:00) Eastern Time (US & Canada)',
  '(GMT+00:00) UTC / London',
  '(GMT+01:00) Amsterdam, Berlin, Rome, Paris',
  '(GMT+02:00) Athens, Cairo, Jerusalem',
  '(GMT+03:00) Moscow, Nairobi, Baghdad',
  '(GMT+04:00) Abu Dhabi, Muscat, Baku',
  '(GMT+05:30) Chennai, Kolkata, Mumbai, New Delhi',
  '(GMT+07:00) Bangkok, Hanoi, Jakarta',
  '(GMT+08:00) Beijing, Singapore, Hong Kong',
  '(GMT+09:00) Tokyo, Seoul, Osaka',
  '(GMT+10:00) Sydney, Melbourne',
];

const LANGUAGES = [
  'English (US)',
  'English (UK)',
  'Spanish (Español)',
  'French (Français)',
  'German (Deutsch)',
  'Japanese (日本語)',
  'Hindi (हिन्दी)',
  'Portuguese (Português)',
  'Italian (Italiano)',
  'Chinese (Simplified)',
];

const AVAILABLE_TAGS = ['VIP', 'Partner', 'Enterprise', 'Lead', 'Customer', 'Beta Tester', 'Product Feedback', 'Escalated'];

const PHONE_TYPES = ['--', 'Direct', 'Mobile', 'Home', 'Office', 'Fax'];

export function AddContactSlideOver({
  open,
  onClose,
  onSuccess,
  existingContacts,
  accounts,
}: AddContactSlideOverProps) {
  // Top Initial Fields (Image 1)
  const [email, setEmail] = useState('');
  const [mobilePhone, setMobilePhone] = useState('');
  const [workPhone, setWorkPhone] = useState('');
  const [externalId, setExternalId] = useState('');
  const [socialHandle, setSocialHandle] = useState('');
  const [socialPlatform, setSocialPlatform] = useState('WhatsApp');
  const [socialDropdownOpen, setSocialDropdownOpen] = useState(false);

  // Mode Switcher: 'quick' vs 'all' (Image 2 vs Image 4)
  const [fieldMode, setFieldMode] = useState<'quick' | 'all'>('quick');
  const [fieldSearch, setFieldSearch] = useState('');

  // Additional Fields (revealed dynamically when email is entered)
  const [fullNameInput, setFullNameInput] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [title, setTitle] = useState('');
  const [otherPhone, setOtherPhone] = useState('');
  const [otherPhoneType, setOtherPhoneType] = useState('--');
  const [address, setAddress] = useState('');
  const [timezone, setTimezone] = useState('');
  const [language, setLanguage] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagsDropdownOpen, setTagsDropdownOpen] = useState(false);
  const [about, setAbout] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socialDropdownRef = useRef<HTMLDivElement>(null);
  const tagsDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (socialDropdownRef.current && !socialDropdownRef.current.contains(e.target as Node)) {
        setSocialDropdownOpen(false);
      }
      if (tagsDropdownRef.current && !tagsDropdownRef.current.contains(e.target as Node)) {
        setTagsDropdownOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset form when opened
  useEffect(() => {
    if (open) {
      setEmail('');
      setMobilePhone('');
      setWorkPhone('');
      setExternalId('');
      setSocialHandle('');
      setSocialPlatform('WhatsApp');
      setSocialDropdownOpen(false);

      setFieldMode('quick');
      setFieldSearch('');

      setFullNameInput('');
      setCompanyId(accounts.length > 0 ? accounts[0].id : '');
      setTitle('');
      setOtherPhone('');
      setOtherPhoneType('--');
      setAddress('');
      setTimezone('');
      setLanguage('');
      setSelectedTags([]);
      setTagsDropdownOpen(false);
      setAbout('');

      setError(null);
    }
  }, [open, accounts]);

  // When email has content, additional fields become visible
  const hasEmail = email.trim().length > 0;

  // Real-time duplicate detection
  const duplicateMatch = useMemo(() => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = mobilePhone.trim();

    if (!cleanEmail && !cleanMobile) return null;

    const matched = existingContacts.find((c) => {
      const emailMatches = cleanEmail && c.email.trim().toLowerCase() === cleanEmail;
      const mobileMatches = cleanMobile && (
        (c.mobile && c.mobile.trim() === cleanMobile) ||
        (c.phone && c.phone.trim() === cleanMobile)
      );
      return emailMatches || mobileMatches;
    });

    if (!matched) return null;

    const matchedFields: string[] = [];
    if (cleanEmail && matched.email.trim().toLowerCase() === cleanEmail) {
      matchedFields.push(`Email`);
    }
    if (cleanMobile && (matched.mobile === cleanMobile || matched.phone === cleanMobile)) {
      matchedFields.push(`Mobile phone: ${cleanMobile}`);
    }

    return {
      contact: matched,
      fields: matchedFields,
    };
  }, [email, mobilePhone, existingContacts]);

  // Helper to filter fields in "All fields" view based on fieldSearch
  const matchesFieldSearch = (fieldName: string) => {
    if (!fieldSearch.trim()) return true;
    return fieldName.toLowerCase().includes(fieldSearch.toLowerCase().trim());
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email address is required.');
      return;
    }

    setSaving(true);
    setError(null);

    // Parse full name into first and last name
    let fName = fullNameInput.trim();
    let lName = '';
    if (fName.includes(' ')) {
      const parts = fName.split(/\s+/);
      fName = parts[0];
      lName = parts.slice(1).join(' ');
    } else if (!fName) {
      fName = email.split('@')[0] || 'Contact';
    }

    const contactId = `user-contact-${Date.now()}`;
    const selectedAcct = accounts.find((a) => a.id === companyId);

    const newContact: Profile & { accounts?: { company_name: string } } = {
      id: contactId,
      auth_uid: null,
      first_name: fName,
      last_name: lName,
      email: email.trim().toLowerCase(),
      user_type: 'customer_user',
      account_id: companyId || null,
      status: 'active',
      phone: workPhone.trim() || null,
      mobile: mobilePhone.trim() || null,
      job_title: title.trim() || null,
      unique_external_id: externalId.trim() || null,
      social_handle: socialHandle.trim() || null,
      social_platform: socialPlatform || null,
      address: address.trim() || null,
      timezone: timezone || null,
      language: language || null,
      tags: selectedTags.length > 0 ? selectedTags : null,
      about: about.trim() || null,
      other_phone: otherPhone.trim() || null,
      other_phone_type: otherPhoneType !== '--' ? otherPhoneType : null,
      avatar_url: null,
      activated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      accounts: selectedAcct ? { company_name: selectedAcct.company_name } : undefined,
    };

    // 1. Try DB Insert
    try {
      await dbClient.from('profiles').insert({
        id: newContact.id,
        email: newContact.email,
        password_hash: 'password',
        first_name: newContact.first_name,
        last_name: newContact.last_name,
        user_type: newContact.user_type,
        account_id: newContact.account_id,
        status: newContact.status,
        phone: newContact.phone,
        mobile: newContact.mobile,
        job_title: newContact.job_title,
        unique_external_id: newContact.unique_external_id,
        social_handle: newContact.social_handle,
        social_platform: newContact.social_platform,
        address: newContact.address,
        timezone: newContact.timezone,
        language: newContact.language,
        about: newContact.about,
        other_phone: newContact.other_phone,
        other_phone_type: newContact.other_phone_type,
      });
    } catch (dbErr) {
      console.warn('DB insert fallback notice:', dbErr);
    }

    // 2. Save in localStorage
    try {
      const existing: Profile[] = JSON.parse(localStorage.getItem('local_custom_users') || '[]');
      const filtered = existing.filter((u) => u.id !== newContact.id && u.email.toLowerCase() !== newContact.email);
      localStorage.setItem('local_custom_users', JSON.stringify([newContact, ...filtered]));
    } catch (e) {}

    // 3. Send Freshdesk Activation Email
    try {
      await sendAccountActivationEmail({
        id: newContact.id,
        first_name: newContact.first_name,
        last_name: newContact.last_name,
        email: newContact.email,
        user_type: 'customer_user',
      });
    } catch (e) {}

    setSaving(false);
    onSuccess(newContact);
    onClose();
  };

  const selectedPlatformObj = SOCIAL_PLATFORMS.find((p) => p.id === socialPlatform) || SOCIAL_PLATFORMS[0];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/35 backdrop-blur-[1px] transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-8">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header (Matching Image 1) */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#12344d] tracking-tight">Add Contact</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-xs text-[#12344d]">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            {/* ── TOP SECTION WITH VERTICAL DASHED BORDER (Exact Match for Image 1) ── */}
            <div className="border-l-2 border-dashed border-[#cfd7df] pl-4 ml-1 space-y-4">
              {/* 1. Email Field */}
              <div>
                <label className="block font-medium mb-1.5 text-[#12344d]">Email</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter an email address"
                      className="w-full pl-3 pr-8 py-2 border border-[#cfd7df] rounded-md outline-none focus:border-[#2672e5] focus:ring-1 focus:ring-[#2672e5] text-xs text-[#12344d] transition-all placeholder:text-[#8292a1]"
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#2672e5]" title="Verified">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmail('')}
                    className="p-1.5 text-[#8292a1] hover:text-[#12344d] rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {}}
                  className="mt-2 text-[11px] text-[#8292a1] hover:text-[#2672e5] flex items-center gap-1.5 transition-colors font-medium"
                >
                  <span className="w-3.5 h-3.5 rounded-full border border-[#8292a1] flex items-center justify-center text-[10px] leading-none">+</span>
                  <span>Add email</span>
                </button>
              </div>

              {/* 2. Mobile Phone */}
              <div>
                <label className="block font-medium mb-1.5 text-[#12344d]">Mobile Phone</label>
                <input
                  type="text"
                  value={mobilePhone}
                  onChange={(e) => setMobilePhone(e.target.value)}
                  placeholder="Enter a Mobile Phone"
                  className="w-full px-3 py-2 border border-[#cfd7df] rounded-md outline-none focus:border-[#2672e5] focus:ring-1 focus:ring-[#2672e5] text-xs text-[#12344d] transition-all placeholder:text-[#8292a1]"
                />
              </div>

              {/* 3. Work Phone */}
              <div>
                <label className="block font-medium mb-1.5 text-[#12344d]">Work Phone</label>
                <input
                  type="text"
                  value={workPhone}
                  onChange={(e) => setWorkPhone(e.target.value)}
                  placeholder="Enter a Work Phone"
                  className="w-full px-3 py-2 border border-[#cfd7df] rounded-md outline-none focus:border-[#2672e5] focus:ring-1 focus:ring-[#2672e5] text-xs text-[#12344d] transition-all placeholder:text-[#8292a1]"
                />
              </div>

              {/* 4. Unique External ID */}
              <div>
                <label className="block font-medium mb-1.5 text-[#12344d]">Unique External ID</label>
                <input
                  type="text"
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                  placeholder="Enter a Unique External ID"
                  className="w-full px-3 py-2 border border-[#cfd7df] rounded-md outline-none focus:border-[#2672e5] focus:ring-1 focus:ring-[#2672e5] text-xs text-[#12344d] transition-all placeholder:text-[#8292a1]"
                />
              </div>

              {/* 5. Social Handle with custom platform dropdown (Image 1 & Image 3) */}
              <div>
                <label className="block font-medium mb-1.5 text-[#12344d]">Social Handle</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={socialHandle}
                    onChange={(e) => setSocialHandle(e.target.value)}
                    placeholder="ID goes here"
                    className="flex-1 px-3 py-2 border border-[#cfd7df] rounded-md outline-none focus:border-[#2672e5] focus:ring-1 focus:ring-[#2672e5] text-xs text-[#12344d] transition-all placeholder:text-[#8292a1]"
                  />

                  {/* Platform Selector Button (Image 3) */}
                  <div className="relative" ref={socialDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setSocialDropdownOpen(!socialDropdownOpen)}
                      className={`flex items-center gap-2 px-3 py-2 border rounded-md bg-white text-xs font-medium text-[#12344d] min-w-[130px] justify-between transition-all ${
                        socialDropdownOpen
                          ? 'border-[#2672e5] ring-2 ring-[#2672e5]/20 shadow-sm'
                          : 'border-[#cfd7df] hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-[#384554] truncate">
                        {selectedPlatformObj.icon({ className: 'w-4 h-4 text-[#384554]' })}
                        <span className="truncate text-[#12344d]">{selectedPlatformObj.name}</span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-[#8292a1] shrink-0 transition-transform duration-150 ${
                          socialDropdownOpen ? 'rotate-180 text-[#2672e5]' : ''
                        }`}
                      />
                    </button>

                    {/* Dropdown Menu (Exact Match for Image 3) */}
                    {socialDropdownOpen && (
                      <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                        {SOCIAL_PLATFORMS.map((platform) => {
                          const isSelected = socialPlatform === platform.id;
                          return (
                            <button
                              key={platform.id}
                              type="button"
                              onClick={() => {
                                setSocialPlatform(platform.id);
                                setSocialDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors ${
                                isSelected
                                  ? 'bg-[#e8f2fc] text-[#0263e0] font-semibold rounded-lg mx-1 w-[calc(100%-8px)]'
                                  : 'text-[#12344d] hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                {platform.icon({
                                  className: `w-4 h-4 ${isSelected ? 'text-[#0263e0]' : 'text-[#475569]'}`
                                })}
                                <span>{platform.name}</span>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-[#0263e0] stroke-[2.5]" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSocialHandle('')}
                    className="p-1.5 text-[#8292a1] hover:text-[#12344d] rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {}}
                  className="mt-2 text-[11px] text-[#8292a1] hover:text-[#2672e5] flex items-center gap-1.5 transition-colors font-medium"
                >
                  <span className="w-3.5 h-3.5 rounded-full border border-[#8292a1] flex items-center justify-center text-[10px] leading-none">+</span>
                  <span>Add new ID</span>
                </button>
              </div>
            </div>

            {/* ── ADDITIONAL FIELDS: DYNAMICALLY REVEALED WHEN EMAIL IS ENTERED (Images 2, 4, 5) ── */}
            {hasEmail && (
              <div className="pt-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Switcher Pill: Quick-add fields vs All fields (Exact Match for Image 2 & Image 4) */}
                <div className="flex items-center gap-3 pt-1 pb-1">
                  <div className="inline-flex items-center bg-[#ebf0f5] px-3 py-1.5 rounded-full text-xs text-[#12344d] gap-4 select-none">
                    {/* Quick-add fields radio button */}
                    <button
                      type="button"
                      onClick={() => setFieldMode('quick')}
                      className="flex items-center gap-2 text-xs font-normal text-[#12344d] hover:text-black cursor-pointer"
                    >
                      {fieldMode === 'quick' ? (
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-[#186ade] flex items-center justify-center">
                          <span className="w-2 h-2 rounded-full bg-[#186ade]" />
                        </span>
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-[#8292a1]" />
                      )}
                      <span>Quick-add fields</span>
                    </button>

                    {/* All fields radio button */}
                    <button
                      type="button"
                      onClick={() => setFieldMode('all')}
                      className="flex items-center gap-2 text-xs font-normal text-[#12344d] hover:text-black cursor-pointer"
                    >
                      {fieldMode === 'all' ? (
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-[#186ade] flex items-center justify-center">
                          <span className="w-2 h-2 rounded-full bg-[#186ade]" />
                        </span>
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-[#8292a1]" />
                      )}
                      <span>All fields</span>
                    </button>
                  </div>
                  <div className="flex-1 h-[1px] bg-[#dbe3ea]" />
                </div>

                {/* ── QUICK-ADD FIELDS VIEW (Exact Match for Image 2) ── */}
                {fieldMode === 'quick' && (
                  <div className="space-y-4 animate-in fade-in duration-100">
                    {/* Full Name */}
                    <div>
                      <label className="block font-medium mb-1.5 text-[#12344d]">Full Name</label>
                      <input
                        type="text"
                        value={fullNameInput}
                        onChange={(e) => setFullNameInput(e.target.value)}
                        placeholder="Enter a Full Name"
                        className="w-full px-3 py-2 border border-[#cfd7df] rounded-md outline-none focus:border-[#2672e5] focus:ring-1 focus:ring-[#2672e5] text-xs text-[#12344d] placeholder:text-[#8292a1] transition-all"
                      />
                    </div>

                    {/* Company (Matching Image 2) */}
                    <div>
                      <label className="block font-medium mb-1.5 text-[#12344d]">Company</label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <select
                            value={companyId}
                            onChange={(e) => setCompanyId(e.target.value)}
                            className="w-full pl-3 pr-20 py-2 border border-[#cfd7df] rounded-md bg-white text-xs outline-none focus:border-[#2672e5] focus:ring-1 focus:ring-[#2672e5] text-[#12344d]"
                          >
                            <option value="">Select a company</option>
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>{a.company_name}</option>
                            ))}
                          </select>
                          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-2 text-[#8292a1] pointer-events-none">
                            <ShieldCheck className="w-4 h-4 text-[#2672e5]" />
                            <Ticket className="w-4 h-4 text-[#8292a1]" />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCompanyId('')}
                          className="p-1.5 text-[#8292a1] hover:text-[#12344d] rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {}}
                        className="mt-2 text-[11px] text-[#8292a1] hover:text-[#2672e5] flex items-center gap-1.5 transition-colors font-medium"
                      >
                        <span className="w-3.5 h-3.5 rounded-full border border-[#8292a1] flex items-center justify-center text-[10px] leading-none">+</span>
                        <span>Associate another company</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* ── ALL FIELDS VIEW (Exact Match for Images 4 & 5) ── */}
                {fieldMode === 'all' && (
                  <div className="space-y-4 animate-in fade-in duration-100">
                    {/* Search for a field (Image 4) */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-[#8292a1] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={fieldSearch}
                        onChange={(e) => setFieldSearch(e.target.value)}
                        placeholder="Search for a field"
                        className="w-full pl-9 pr-3 py-2 border border-[#cfd7df] rounded-md outline-none focus:border-[#2672e5] focus:ring-1 focus:ring-[#2672e5] text-xs text-[#12344d] placeholder:text-[#8292a1]"
                      />
                    </div>

                    {/* Full Name */}
                    {matchesFieldSearch('Full Name') && (
                      <div>
                        <label className="block font-medium mb-1.5 text-[#12344d]">Full Name</label>
                        <input
                          type="text"
                          value={fullNameInput}
                          onChange={(e) => setFullNameInput(e.target.value)}
                          placeholder="Enter a Full Name"
                          className="w-full px-3 py-2 border border-[#cfd7df] rounded-md outline-none focus:border-[#2672e5] focus:ring-1 focus:ring-[#2672e5] text-xs text-[#12344d] placeholder:text-[#8292a1]"
                        />
                      </div>
                    )}

                    {/* Title (Image 4) */}
                    {matchesFieldSearch('Title') && (
                      <div>
                        <label className="block font-medium mb-1.5 text-[#12344d]">Title</label>
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Enter a Title"
                          className="w-full px-3 py-2 border border-[#cfd7df] rounded-md outline-none focus:border-[#2672e5] focus:ring-1 focus:ring-[#2672e5] text-xs text-[#12344d] placeholder:text-[#8292a1]"
                        />
                      </div>
                    )}

                    {/* Other phone numbers (Image 4) */}
                    {matchesFieldSearch('Other phone numbers') && (
                      <div>
                        <label className="block font-medium mb-1.5 text-[#12344d]">Other phone numbers</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={otherPhone}
                            onChange={(e) => setOtherPhone(e.target.value)}
                            placeholder="Enter a phone number"
                            className="flex-1 px-3 py-2 border border-[#cfd7df] rounded-md outline-none focus:border-[#2672e5] focus:ring-1 focus:ring-[#2672e5] text-xs text-[#12344d] placeholder:text-[#8292a1]"
                          />
                          <select
                            value={otherPhoneType}
                            onChange={(e) => setOtherPhoneType(e.target.value)}
                            className="px-3 py-2 border border-[#cfd7df] rounded-md bg-white text-xs outline-none focus:border-[#2672e5] text-[#12344d]"
                          >
                            {PHONE_TYPES.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              setOtherPhone('');
                              setOtherPhoneType('--');
                            }}
                            className="p-1.5 text-[#8292a1] hover:text-[#12344d] rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => {}}
                          className="mt-2 text-[11px] text-[#8292a1] hover:text-[#2672e5] flex items-center gap-1.5 transition-colors font-medium"
                        >
                          <span className="w-3.5 h-3.5 rounded-full border border-[#8292a1] flex items-center justify-center text-[10px] leading-none">+</span>
                          <span>Add phone number</span>
                        </button>
                      </div>
                    )}

                    {/* Company (Image 4) */}
                    {matchesFieldSearch('Company') && (
                      <div>
                        <label className="block font-medium mb-1.5 text-[#12344d]">Company</label>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <select
                              value={companyId}
                              onChange={(e) => setCompanyId(e.target.value)}
                              className="w-full pl-3 pr-20 py-2 border border-[#cfd7df] rounded-md bg-white text-xs outline-none focus:border-[#2672e5] focus:ring-1 focus:ring-[#2672e5] text-[#12344d]"
                            >
                              <option value="">Select a company</option>
                              {accounts.map((a) => (
                                <option key={a.id} value={a.id}>{a.company_name}</option>
                              ))}
                            </select>
                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-2 text-[#8292a1] pointer-events-none">
                              <ShieldCheck className="w-4 h-4 text-[#2672e5]" />
                              <Ticket className="w-4 h-4 text-[#8292a1]" />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCompanyId('')}
                            className="p-1.5 text-[#8292a1] hover:text-[#12344d] rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => {}}
                          className="mt-2 text-[11px] text-[#8292a1] hover:text-[#2672e5] flex items-center gap-1.5 transition-colors font-medium"
                        >
                          <span className="w-3.5 h-3.5 rounded-full border border-[#8292a1] flex items-center justify-center text-[10px] leading-none">+</span>
                          <span>Associate another company</span>
                        </button>
                      </div>
                    )}

                    {/* Address (Images 4 & 5) */}
                    {matchesFieldSearch('Address') && (
                      <div>
                        <label className="block font-medium mb-1.5 text-[#12344d]">Address</label>
                        <textarea
                          rows={2}
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Enter some text"
                          className="w-full px-3 py-2 border border-[#cfd7df] rounded-md outline-none focus:border-[#2672e5] focus:ring-1 focus:ring-[#2672e5] text-xs text-[#12344d] placeholder:text-[#8292a1] resize-y"
                        />
                      </div>
                    )}

                    {/* Time zone (Image 5) */}
                    {matchesFieldSearch('Time zone') && (
                      <div>
                        <label className="block font-medium mb-1.5 text-[#12344d]">Time zone</label>
                        <div className="relative">
                          <select
                            value={timezone}
                            onChange={(e) => setTimezone(e.target.value)}
                            className="w-full appearance-none pl-3 pr-8 py-2 border border-[#cfd7df] rounded-md bg-white text-xs outline-none focus:border-[#2672e5] focus:ring-1 focus:ring-[#2672e5] text-[#12344d]"
                          >
                            <option value="">Your choice</option>
                            {TIMEZONES.map((tz) => (
                              <option key={tz} value={tz}>{tz}</option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 text-[#8292a1] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                    )}

                    {/* Language (Image 5) */}
                    {matchesFieldSearch('Language') && (
                      <div>
                        <label className="block font-medium mb-1.5 text-[#12344d]">Language</label>
                        <div className="relative">
                          <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="w-full appearance-none pl-3 pr-8 py-2 border border-[#cfd7df] rounded-md bg-white text-xs outline-none focus:border-[#2672e5] focus:ring-1 focus:ring-[#2672e5] text-[#12344d]"
                          >
                            <option value="">Your choice</option>
                            {LANGUAGES.map((lang) => (
                              <option key={lang} value={lang}>{lang}</option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 text-[#8292a1] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                    )}

                    {/* Tags (Image 5) */}
                    {matchesFieldSearch('Tags') && (
                      <div className="relative" ref={tagsDropdownRef}>
                        <label className="block font-medium mb-1.5 text-[#12344d]">Tags</label>
                        <button
                          type="button"
                          onClick={() => setTagsDropdownOpen(!tagsDropdownOpen)}
                          className={`w-full flex items-center justify-between px-3 py-2 border rounded-md bg-white text-xs text-left transition-all ${
                            tagsDropdownOpen ? 'border-[#2672e5] ring-1 ring-[#2672e5]' : 'border-[#cfd7df]'
                          }`}
                        >
                          <div className="flex flex-wrap gap-1 items-center flex-1 mr-2">
                            {selectedTags.length === 0 ? (
                              <span className="text-[#8292a1]">Your choice</span>
                            ) : (
                              selectedTags.map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-semibold border border-blue-200"
                                >
                                  <span>{tag}</span>
                                  <span
                                    role="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleTag(tag);
                                    }}
                                    className="hover:text-blue-900"
                                  >
                                    <X className="w-3 h-3" />
                                  </span>
                                </span>
                              ))
                            )}
                          </div>
                          <ChevronDown className="w-4 h-4 text-[#8292a1] shrink-0" />
                        </button>

                        {/* Tags Dropdown Menu */}
                        {tagsDropdownOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-40 space-y-1">
                            <p className="text-[11px] font-semibold text-gray-500 px-1 pb-1 border-b border-gray-100">
                              Select tags
                            </p>
                            <div className="max-h-40 overflow-y-auto space-y-0.5 pt-1">
                              {AVAILABLE_TAGS.map((tag) => {
                                const isSelected = selectedTags.includes(tag);
                                return (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={() => toggleTag(tag)}
                                    className={`w-full px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition-colors ${
                                      isSelected
                                        ? 'bg-blue-50 text-[#186ade] font-semibold'
                                        : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                                  >
                                    <span>{tag}</span>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-[#186ade]" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* About (Image 5) */}
                    {matchesFieldSearch('About') && (
                      <div>
                        <label className="block font-medium mb-1.5 text-[#12344d]">About</label>
                        <textarea
                          rows={3}
                          value={about}
                          onChange={(e) => setAbout(e.target.value)}
                          placeholder="Enter some text"
                          className="w-full px-3 py-2 border border-[#cfd7df] rounded-md outline-none focus:border-[#2672e5] focus:ring-1 focus:ring-[#2672e5] text-xs text-[#12344d] placeholder:text-[#8292a1] resize-y"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── DUPLICATE CONTACT WARNING ── */}
            {duplicateMatch && (
              <div className="pt-3 border-t border-gray-200 space-y-2 animate-in fade-in slide-in-from-bottom-2">
                <h4 className="text-sm font-bold text-gray-900">Contact already exists</h4>
                <p className="text-[13px] font-medium text-[#475569] mb-1">
                  Duplicate contact found for {duplicateMatch.fields.join(' and ')}
                </p>

                {/* Existing Contact Card */}
                <div className="mt-2 bg-[#f8fafc] border border-gray-200 rounded-lg p-3 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#fde68a] text-[#854d0e] flex items-center justify-center font-bold text-xs shrink-0 select-none">
                      {(duplicateMatch.contact.first_name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <a 
                        href={`/admin/contacts/${duplicateMatch.contact.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-[#186ade] hover:underline block mb-0.5"
                      >
                        {fullName(duplicateMatch.contact.first_name, duplicateMatch.contact.last_name)}
                      </a>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-[11px] text-[#384554]">{duplicateMatch.contact.email}</span>
                      </div>
                      {(duplicateMatch.contact.mobile || duplicateMatch.contact.phone) && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Phone className="w-3.5 h-3.5 text-gray-500" />
                          <span className="text-[11px] text-[#384554]">{duplicateMatch.contact.mobile || duplicateMatch.contact.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <a
                    href={`/admin/contacts/${duplicateMatch.contact.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <span>View</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
          </form>

          {/* Fixed Footer Buttons (Exact Match for Images 1, 2, 4, 5) */}
          <div className="px-6 py-3.5 bg-gray-50 border-t border-[#cfd7df] flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-gray-100 text-[#12344d] text-xs font-semibold rounded-md border border-[#cfd7df] transition-colors shadow-2xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !email.trim()}
              className="px-4 py-2 bg-[#2672e5] hover:bg-[#1a5bc7] text-white text-xs font-semibold rounded-md shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? 'Creating...' : 'Create contact'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
