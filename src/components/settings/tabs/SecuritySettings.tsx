import React from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import Modal from '@/components/ui/Modal';
import { Lock, Mail, Building2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { NotificationsApi } from '@/api/NotificationsApi';

type TrustedDevice = {
  id: string;
  deviceLabel: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  lastUserAgent: string | null;
  isTrusted: boolean;
  revokedAt: string | null;
};

const SecuritySettings: React.FC = () => {
  const { profile } = useSelector((state: RootState) => state.user);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = React.useState(false);
  
  // Form States
  const [brandName, setBrandName] = React.useState(profile?.brandFullName || '');
  const [email, setEmail] = React.useState(profile?.email || '');
  
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');

  // Verification Password (for modal)
  const [verifyPassword, setVerifyPassword] = React.useState('');
  const [devices, setDevices] = React.useState<TrustedDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = React.useState(true);

  React.useEffect(() => {
    const loadDevices = async () => {
      try {
        const result = await NotificationsApi.listTrustedDevices();
        setDevices(Array.isArray(result) ? (result as TrustedDevice[]) : []);
      } catch (error) {
        console.error('Failed to load trusted devices', error);
        toast.error('Failed to load recognized devices');
      } finally {
        setLoadingDevices(false);
      }
    };

    void loadDevices();
  }, []);

  if (!profile) return null;

  const handleProfileUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setIsPasswordModalOpen(true);
  };

  const handlePasswordUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setIsPasswordModalOpen(true);
  };

  const confirmAction = async () => {
    if (!verifyPassword) {
      toast.error("Please enter your password to confirm");
      return;
    }

    // Here we would call the API to verify password and perform the action
    // For now, we simulate success
    try {
      // await api.verifyPassword(verifyPassword);
      // if (pendingAction === 'update_profile') await api.updateProfile({ brandName, email });
      // if (pendingAction === 'update_password') await api.updatePassword({ currentPassword, newPassword });
      
      toast.success("Settings updated successfully");
      setIsPasswordModalOpen(false);
      setVerifyPassword('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      toast.error("Incorrect password or update failed");
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    try {
      const result = await NotificationsApi.revokeTrustedDevice(deviceId);
      if (result?.success) {
        setDevices((prev) =>
          prev.map((device) =>
            device.id === deviceId
              ? { ...device, revokedAt: new Date().toISOString(), isTrusted: false }
              : device,
          ),
        );
        toast.success('Device access revoked');
      } else {
        toast.error('Unable to revoke device');
      }
    } catch (error) {
      console.error('Failed to revoke device', error);
      toast.error('Failed to revoke device');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Security & Login</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage your account security and sensitive information.</p>
      </div>

      {/* Brand & Email Section */}
      <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-white/10 p-6 space-y-6">
        <div className="flex items-center space-x-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Basic Information</h2>
        </div>
        
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Brand Name
              </label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Mail className="w-4 h-4" /> Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              Update Info
            </button>
          </div>
        </form>
      </div>

      {/* Password Section */}
      <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-white/10 p-6 space-y-6">
        <div className="flex items-center space-x-2 mb-4">
          <Lock className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Password</h2>
        </div>

        <form onSubmit={handlePasswordUpdate} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity">
              Change Password
            </button>
          </div>
        </form>
      </div>

      {/* Recognized Devices */}
      <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-white/10 p-6 space-y-4">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Recognized Devices</h2>
        </div>

        {loadingDevices ? (
          <p className="text-sm text-gray-500">Loading devices...</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-gray-500">No recognized devices found.</p>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => {
              const revoked = !!device.revokedAt;
              const userAgent = device.lastUserAgent || 'Unknown device';
              return (
                <div
                  key={device.id}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-lg border border-gray-200 dark:border-white/10 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {device.deviceLabel || userAgent.slice(0, 80)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Last seen: {new Date(device.lastSeenAt).toLocaleString()} {revoked ? '• Revoked' : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={revoked}
                    onClick={() => void handleRevokeDevice(device.id)}
                    className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Revoke
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Verification Modal */}
      <Modal open={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} title="Security Verification">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-sm">For your security, please enter your password to confirm these changes.</p>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
            <input
              type="password"
              value={verifyPassword}
              onChange={(e) => setVerifyPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter your password"
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setIsPasswordModalOpen(false)}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={confirmAction}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              Confirm
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SecuritySettings;
