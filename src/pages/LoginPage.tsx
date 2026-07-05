// หน้า Login สำหรับระบบจัดคิวหมอ GTA V RP
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Stethoscope, Eye, EyeOff, LogIn } from 'lucide-react';

export default function LoginPage() {
  const { signInWithUsername } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }
    setLoading(true);
    try {
      const { error } = await signInWithUsername(username, password);
      if (error) throw error;
      toast.success('เข้าสู่ระบบสำเร็จ');
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg = (err as Error).message || 'เกิดข้อผิดพลาด';
      if (msg.includes('Invalid login credentials')) {
        toast.error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, hsl(142 70% 45% / 0.3) 0px, hsl(142 70% 45% / 0.3) 1px, transparent 1px, transparent 20px)`,
        }}
      />
      <div className="relative w-full max-w-sm animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/30 mb-4">
            <Stethoscope className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-wide">ระบบจัดคิวหมอ</h1>
          <p className="text-muted-foreground text-sm mt-1">GTA V RP Medical Queue</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-lg">
          <p className="text-sm text-muted-foreground mb-5 text-center">กรุณาเข้าสู่ระบบด้วยบัญชีที่ได้รับจากผู้ดูแล</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">ชื่อผู้ใช้</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="กรอกชื่อผู้ใช้" autoComplete="username"
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-base" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">รหัสผ่าน</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="รหัสผ่าน"
                  autoComplete="current-password"
                  className="w-full px-3 py-2 pr-10 bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-base" />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-md font-semibold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 transition-opacity mt-2">
              {loading
                ? <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                : <><LogIn className="w-4 h-4" />เข้าสู่ระบบ</>}
            </button>
          </form>
        </div>
        <p className="text-center text-muted-foreground text-xs mt-4">ติดต่อผู้ดูแลระบบเพื่อขอบัญชี</p>
      </div>
    </div>
  );
}
