import React, { useEffect, useMemo, useState } from 'react';
import { NotificationsApi } from '@/api/NotificationsApi';
import { toast } from 'sonner';

type EmailSettings = {
  globalEnabled: boolean;
  securityCriticalEnabled: boolean;
  scenarios: Record<string, boolean>;
  securityCriticalScenarios: string[];
};

function toLabel(scenarioKey: string): string {
  return scenarioKey
    .replace(/^notification\./, '')
    .replace(/^auth\./, '')
    .replace(/[._]/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function groupForScenario(scenarioKey: string): string {
  if (scenarioKey.startsWith('auth.') || scenarioKey.includes('LOGIN')) {
    return 'Security';
  }
  if (scenarioKey.includes('ORDER') || scenarioKey.includes('CUSTOM_ORDER')) {
    return 'Orders & Custom Orders';
  }
  if (
    scenarioKey.includes('MESSAGE') ||
    scenarioKey.includes('THREAD') ||
    scenarioKey.includes('COMMENT') ||
    scenarioKey.includes('TAG') ||
    scenarioKey.includes('FOLLOW')
  ) {
    return 'Messaging & Social';
  }
  if (
    scenarioKey.includes('BRAND') ||
    scenarioKey.includes('VERIFICATION') ||
    scenarioKey.includes('COLLECTION') ||
    scenarioKey.includes('PRODUCT') ||
    scenarioKey.includes('PRIVATE_ACCESS')
  ) {
    return 'Brand & Collections';
  }
  return 'Platform & Operations';
}

const EmailPreferencesSettings: React.FC = () => {
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const result = await NotificationsApi.getEmailSettings();
        setSettings(result as EmailSettings);
      } catch (error) {
        console.error('Failed to load email settings', error);
        toast.error('Failed to load email preferences');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  const groupedScenarios = useMemo(() => {
    if (!settings) return {} as Record<string, string[]>;

    const entries = Object.keys(settings.scenarios).sort((a, b) => a.localeCompare(b));
    return entries.reduce<Record<string, string[]>>((acc, key) => {
      const group = groupForScenario(key);
      if (!acc[group]) acc[group] = [];
      acc[group].push(key);
      return acc;
    }, {});
  }, [settings]);

  const isCritical = (scenarioKey: string) =>
    settings?.securityCriticalScenarios.includes(scenarioKey) ?? false;

  const updateSettings = async (patch: Record<string, unknown>, successMessage: string) => {
    try {
      const updated = await NotificationsApi.updateEmailSettings(patch);
      setSettings(updated as EmailSettings);
      toast.success(successMessage);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to update email preference';
      toast.error(String(message));
      throw error;
    }
  };

  const onToggleGlobal = async (nextValue: boolean) => {
    if (!settings) return;
    const previous = settings.globalEnabled;
    setSettings({ ...settings, globalEnabled: nextValue });
    try {
      await updateSettings({ globalEnabled: nextValue }, 'Global email preference updated');
    } catch {
      setSettings({ ...settings, globalEnabled: previous });
    }
  };

  const onToggleSecurityCritical = async (nextValue: boolean) => {
    if (!settings) return;

    let patch: Record<string, unknown> = { securityCriticalEnabled: nextValue };
    if (!nextValue) {
      const complianceAcknowledged = window.confirm(
        'Disabling security-critical email alerts reduces account protection. Continue?',
      );
      if (!complianceAcknowledged) {
        return;
      }
      const stepUpPassword = window.prompt('Confirm with your password to continue:');
      if (!stepUpPassword) {
        toast.error('Password confirmation is required');
        return;
      }
      patch = { ...patch, complianceAcknowledged: true, stepUpPassword };
    }

    const previous = settings.securityCriticalEnabled;
    setSettings({ ...settings, securityCriticalEnabled: nextValue });
    try {
      await updateSettings(patch, 'Security-critical email preference updated');
    } catch {
      setSettings({ ...settings, securityCriticalEnabled: previous });
    }
  };

  const onToggleScenario = async (scenarioKey: string, nextValue: boolean) => {
    if (!settings) return;

    setPendingKey(scenarioKey);

    let patch: Record<string, unknown> = {
      scenarios: { [scenarioKey]: nextValue },
    };

    if (isCritical(scenarioKey) && !nextValue) {
      const complianceAcknowledged = window.confirm(
        'This is a security-critical email scenario. Disabling it requires compliance acknowledgement. Continue?',
      );
      if (!complianceAcknowledged) {
        setPendingKey(null);
        return;
      }
      const stepUpPassword = window.prompt('Confirm with your password to continue:');
      if (!stepUpPassword) {
        toast.error('Password confirmation is required');
        setPendingKey(null);
        return;
      }
      patch = { ...patch, complianceAcknowledged: true, stepUpPassword };
    }

    const previous = settings.scenarios[scenarioKey];
    setSettings({
      ...settings,
      scenarios: {
        ...settings.scenarios,
        [scenarioKey]: nextValue,
      },
    });

    try {
      await updateSettings(patch, 'Email scenario updated');
    } catch {
      setSettings({
        ...settings,
        scenarios: {
          ...settings.scenarios,
          [scenarioKey]: previous,
        },
      });
    } finally {
      setPendingKey(null);
    }
  };

  const onResetDefaults = async () => {
    if (!window.confirm('Reset all email preferences to recommended defaults?')) {
      return;
    }

    try {
      const updated = await NotificationsApi.resetEmailSettings();
      setSettings(updated as EmailSettings);
      toast.success('Email preferences reset to defaults');
    } catch (error) {
      console.error('Failed to reset email settings', error);
      toast.error('Failed to reset defaults');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading email preferences...</div>;
  }

  if (!settings) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Email Preferences</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage global email delivery and scenario-level alerts. Security-critical scenarios require password confirmation before disabling.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-white/10 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Enable All Non-Critical Emails</p>
            <p className="text-xs text-gray-500">Master switch for routine and social email notifications.</p>
          </div>
          <input
            type="checkbox"
            checked={settings.globalEnabled}
            onChange={(e) => void onToggleGlobal(e.target.checked)}
          />
        </div>

        <div className="flex items-start justify-between gap-4 border-t border-gray-200 dark:border-white/10 pt-4">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Security-Critical Emails</p>
            <p className="text-xs text-gray-500">Login risk and account security alerts. Disabling requires step-up authentication.</p>
          </div>
          <input
            type="checkbox"
            checked={settings.securityCriticalEnabled}
            onChange={(e) => void onToggleSecurityCritical(e.target.checked)}
          />
        </div>

        <div className="border-t border-gray-200 dark:border-white/10 pt-4">
          <button
            type="button"
            onClick={() => void onResetDefaults()}
            className="px-3 py-2 text-sm font-medium border border-gray-300 dark:border-white/20 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5"
          >
            Reset To Recommended Defaults
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {Object.entries(groupedScenarios).map(([group, keys]) => (
          <div key={group} className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-white/10 p-5">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{group}</h3>
            <div className="space-y-3">
              {keys.map((scenarioKey) => {
                const checked = settings.scenarios[scenarioKey];
                const critical = isCritical(scenarioKey);
                return (
                  <div key={scenarioKey} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {toLabel(scenarioKey)} {critical ? '🔒' : ''}
                      </p>
                      <p className="text-xs text-gray-500">{scenarioKey}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={pendingKey === scenarioKey}
                      onChange={(e) => void onToggleScenario(scenarioKey, e.target.checked)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmailPreferencesSettings;
