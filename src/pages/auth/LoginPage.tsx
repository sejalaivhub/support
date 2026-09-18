import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input } from '@/components/ui';
import { Headphones, AlertCircle } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'login') {
      const { error } = await signIn(email, password);
      setLoading(false);
      if (error) {
        setError(error.includes('Invalid login') ? 'Invalid email or password. If you are a new user, please sign up first.' : error);
      } else {
        navigate('/');
      }
    } else {
      if (!firstName.trim() || !lastName.trim()) {
        setError('Please enter your first and last name.');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, firstName, lastName);
      setLoading(false);
      if (error) {
        setError(error);
      } else {
        navigate('/');
      }
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 text-white flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #3b82f6 0%, transparent 50%), radial-gradient(circle at 70% 80%, #6366f1 0%, transparent 50%)' }} />
        <div className="relative">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center font-bold">A</div>
            <span className="text-xl font-semibold tracking-tight">AIV Support</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Enterprise-grade<br />support ticketing
          </h1>
          <p className="text-slate-400 text-lg max-w-md">
            Track, manage, and resolve support tickets with SLA compliance, team collaboration, and full audit trails.
          </p>
        </div>
        <div className="relative space-y-4">
          {[
            'SLA monitoring with business-hour-aware due dates',
            'Role-based access for customers, agents, and admins',
            'Internal notes separated from customer-visible replies',
            'Configurable plans, priorities, and categories',
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-3 text-slate-300">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
              <span className="text-sm">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
              <Headphones className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-gray-900">AIV Support</span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {mode === 'login'
              ? 'Sign in to access your support portal'
              : 'Sign up to start managing your support tickets'}
          </p>

          {error && (
            <div className="flex items-start gap-2 p-3 mb-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="grid grid-cols-2 gap-3">
                <Input label="First Name" value={firstName} onChange={setFirstName} required placeholder="John" />
                <Input label="Last Name" value={lastName} onChange={setLastName} required placeholder="Smith" />
              </div>
            )}
            <Input label="Email" type="email" value={email} onChange={setEmail} required placeholder="you@company.com" />
            <Input label="Password" type="password" value={password} onChange={setPassword} required placeholder="••••••••" />

            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            {mode === 'login' ? (
              <>
                Don't have an account?{' '}
                <button onClick={() => { setMode('signup'); setError(null); }} className="text-blue-600 font-medium hover:underline">
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button onClick={() => { setMode('login'); setError(null); }} className="text-blue-600 font-medium hover:underline">
                  Sign in
                </button>
              </>
            )}
          </div>

          <div className="mt-8 p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700">
            <p className="font-medium mb-1">Demo accounts (sign up with these emails to activate):</p>
            <p>Customer: john.smith@acme.com, alice@globex.com</p>
            <p>Agent: agent1@aivsupport.com, agent2@aivsupport.com</p>
            <p>Admin: admin@aivsupport.com, manager@aivsupport.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
