import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardBody, Button, Input, Spinner } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import {
  CheckCircle2, Lock, ShieldCheck, UserCheck, AlertCircle, ArrowRight, Sparkles, Building2
} from 'lucide-react';
import type { Profile } from '@/types';

export function ActivateAccountPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const userId = searchParams.get('id') || '';
  const emailParam = searchParams.get('email') || '';
  const nameParam = searchParams.get('name') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [userProfile, setUserProfile] = useState<Partial<Profile> | null>({
    id: userId,
    email: emailParam,
    first_name: nameParam.split(' ')[0] || 'User',
    last_name: nameParam.split(' ').slice(1).join(' ') || '',
    user_type: 'customer_user',
  });

  useEffect(() => {
    // Attempt to load full user details from local storage or Supabase if available
    try {
      const customUsers = JSON.parse(localStorage.getItem('local_custom_users') || '[]');
      const found = customUsers.find((u: any) => u.id === userId || u.email === emailParam);
      if (found) {
        setUserProfile(found);
        if (found.job_title) setJobTitle(found.job_title);
        if (found.phone) setPhone(found.phone);
      }
    } catch (e) {}
  }, [userId, emailParam]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter a new password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const updatedProfile: Profile = {
        id: userId || `user-act-${Date.now()}`,
        email: emailParam || 'user@example.com',
        auth_uid: null,
        first_name: userProfile?.first_name || 'User',
        last_name: userProfile?.last_name || '',
        user_type: userProfile?.user_type || 'customer_user',
        account_id: userProfile?.account_id || null,
        status: 'active',
        phone: phone.trim() || userProfile?.phone || null,
        mobile: userProfile?.mobile || null,
        job_title: jobTitle.trim() || userProfile?.job_title || null,
        created_at: userProfile?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 1. Update in local storage custom users
      const customUsers = JSON.parse(localStorage.getItem('local_custom_users') || '[]');
      const idx = customUsers.findIndex((u: any) => u.id === userId || u.email === emailParam);
      if (idx >= 0) {
        customUsers[idx] = { ...customUsers[idx], ...updatedProfile, status: 'active' };
      } else {
        customUsers.unshift(updatedProfile);
      }
      localStorage.setItem('local_custom_users', JSON.stringify(customUsers));

      // 2. Try Supabase update
      try {
        await supabase.from('profiles').update({
          status: 'active',
          job_title: jobTitle.trim() || null,
          phone: phone.trim() || null,
          updated_at: new Date().toISOString(),
        }).eq('id', userId);
      } catch (e) {}

      // 3. Log user in locally
      const mockSession = {
        access_token: 'demo-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'demo-refresh-token',
        user: { id: updatedProfile.id, email: updatedProfile.email },
      };
      localStorage.setItem('demo_profile', JSON.stringify(updatedProfile));
      localStorage.setItem('demo_session', JSON.stringify(mockSession));

      setSuccess(true);
      setTimeout(() => {
        const dest = ['agent', 'manager', 'admin'].includes(updatedProfile.user_type) ? '/agent' : '/portal';
        window.location.href = dest;
      }, 1200);

    } catch (err: any) {
      setError(err.message || 'Activation failed. Please try again.');
      setLoading(false);
    }
  };

  const getPasswordStrength = () => {
    if (!password) return { label: 'Empty', color: 'bg-slate-200' };
    if (password.length < 6) return { label: 'Too Short', color: 'bg-red-500' };
    if (password.length >= 8 && /[0-9]/.test(password)) return { label: 'Strong', color: 'bg-emerald-500' };
    return { label: 'Good', color: 'bg-amber-500' };
  };

  const strength = getPasswordStrength();

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white font-black text-xl shadow-lg shadow-blue-500/20">
            A
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">AIV Support Portal</h1>
          <p className="text-xs text-slate-400">Freshworks Customer & Agent Account Activation Gateway</p>
        </div>

        <Card className="shadow-xl border-slate-800 bg-white/95 backdrop-blur-sm">
          <CardBody className="p-6 space-y-5">
            {success ? (
              <div className="text-center py-6 space-y-3 animate-in fade-in-50 duration-300">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Account Activated Successfully!</h3>
                <p className="text-xs text-slate-500">
                  Welcome to AIV Support Portal. Logging you into your support dashboard...
                </p>
                <Spinner label="Redirecting..." />
              </div>
            ) : (
              <>
                <div className="space-y-1 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 py-1 px-3 rounded-full w-fit mx-auto border border-blue-100">
                    <Sparkles className="w-3.5 h-3.5" /> Account Activation Invited
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 pt-1">Activate Your Support Account</h2>
                  <p className="text-xs text-slate-500">
                    Set a secure password to activate your helpdesk access.
                  </p>
                </div>

                {/* User Info Chip */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">
                      {userProfile?.first_name} {userProfile?.last_name}
                    </span>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-2xs font-bold rounded-md">
                      Pending Activation
                    </span>
                  </div>
                  <p className="text-slate-500 font-medium">{emailParam || 'user@example.com'}</p>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleActivate} className="space-y-4 text-xs">
                  <div className="space-y-1">
                    <Input
                      label="New Password *"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(v) => setPassword(v)}
                      required
                    />
                    {password && (
                      <div className="flex items-center justify-between pt-1">
                        <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden mr-2">
                          <div className={`h-full ${strength.color} transition-all duration-300`} style={{ width: password.length >= 8 ? '100%' : password.length >= 6 ? '60%' : '30%' }} />
                        </div>
                        <span className="text-2xs font-bold text-slate-500">{strength.label}</span>
                      </div>
                    )}
                  </div>

                  <Input
                    label="Confirm Password *"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(v) => setConfirmPassword(v)}
                    required
                  />

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <Input
                      label="Job Title (Optional)"
                      placeholder="e.g. IT Manager"
                      value={jobTitle}
                      onChange={(v) => setJobTitle(v)}
                    />
                    <Input
                      label="Phone (Optional)"
                      placeholder="+1 555-0100"
                      value={phone}
                      onChange={(v) => setPhone(v)}
                    />
                  </div>

                  <Button type="submit" disabled={loading || !password} className="w-full justify-center py-2.5 shadow-sm mt-2">
                    {loading ? (
                      <Spinner label="Activating..." />
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 mr-1.5" /> Activate Account & Log In <ArrowRight className="w-4 h-4 ml-1.5" />
                      </>
                    )}
                  </Button>
                </form>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
