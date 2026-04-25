import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { NotificationsApi } from '@/api/NotificationsApi';

type EmailSettings = {
  globalEnabled: boolean;
  securityCriticalEnabled: boolean;
  scenarios: Record<string, boolean>;
  securityCriticalScenarios: string[];
};

type ScenarioMeta = {
  title: string;
  description: string;
  group: string;
};

const GROUP_ORDER = [
  'Security',
  'Orders & Checkout',
  'Messaging & Social',
  'Brand & Catalog',
  'Size & Fit',
  'Platform & Operations',
] as const;

const GROUP_COPY: Record<string, string> = {
  Security:
    'Protect sign-in, recovery, and account-access emails so unusual activity does not go unnoticed.',
  'Orders & Checkout':
    'Track purchases, delivery progress, and custom-order milestones from payment through completion.',
  'Messaging & Social':
    'Control email alerts for replies, comments, threads, tags, follows, and conversation activity.',
  'Brand & Catalog':
    'Manage publishing, verification, private-access, and collaboration updates for brand work.',
  'Size & Fit':
    'Choose which fitting reminders and size-fit sharing events should still reach your inbox.',
  'Platform & Operations':
    'Catch wishlist, featured, review, and admin notices that do not belong in the main categories.',
};

const SCENARIO_OVERRIDES: Record<string, ScenarioMeta> = {
  'auth.signin.new_device': {
    title: 'New sign-in from a new device',
    description:
      'Sent when your account is accessed from a device Threadly has not seen before so you can confirm it was really you.',
    group: 'Security',
  },
  'auth.signin.high_risk': {
    title: 'High-risk sign-in alert',
    description:
      'Sent when Threadly detects a sign-in that looks unusual or risky and wants you to review it immediately.',
    group: 'Security',
  },
  'notification.LOGIN': {
    title: 'Successful sign-in alert',
    description:
      'Sent after a normal sign-in so you can keep track of routine account access.',
    group: 'Security',
  },
  'notification.LOGOUT': {
    title: 'Sign-out confirmation',
    description: 'Sent when your current session is signed out successfully.',
    group: 'Security',
  },
  'notification.LOGOUT_ALL': {
    title: 'Signed out from all devices',
    description:
      'Sent when every active session on your account is revoked at once.',
    group: 'Security',
  },
  'notification.SIGNUP': {
    title: 'Account creation confirmation',
    description:
      'Sent when your Threadly account is created and ready for setup.',
    group: 'Security',
  },
  'notification.ORDER_PLACED': {
    title: 'Order placed confirmation',
    description:
      'Sent as soon as checkout succeeds so you have a record that the order was created.',
    group: 'Orders & Checkout',
  },
  'notification.ORDER_STATUS_UPDATED': {
    title: 'Order status changes',
    description:
      'Sent when an order moves into a new fulfillment or delivery stage such as processing, shipped, delivered, cancelled, or refunded.',
    group: 'Orders & Checkout',
  },
  'notification.THREAD': {
    title: 'New thread on your content',
    description:
      'Sent when someone starts a fresh thread on one of your posts or designs.',
    group: 'Messaging & Social',
  },
  'notification.COMMENT': {
    title: 'New comment or reply',
    description:
      'Sent when someone comments on your content or replies inside a conversation you already joined.',
    group: 'Messaging & Social',
  },
  'notification.MESSAGE_RECEIVED': {
    title: 'New direct or order message',
    description:
      'Sent when a new message arrives in a conversation Threadly tracks for you.',
    group: 'Messaging & Social',
  },
  'notification.MESSAGE_UNREAD_REMINDER': {
    title: 'Unread message reminder',
    description:
      'Sent when a message thread still needs your attention after sitting unread.',
    group: 'Messaging & Social',
  },
  'notification.COLLECTION_UPLOAD': {
    title: 'Design published',
    description:
      'Sent when a design is successfully published and visible to its intended audience.',
    group: 'Brand & Catalog',
  },
  'notification.PRODUCT_UPLOAD': {
    title: 'Product published',
    description:
      'Sent when a store product goes live and becomes available in the catalog.',
    group: 'Brand & Catalog',
  },
  'notification.COLLECTION_DELETED': {
    title: 'Design removed',
    description:
      'Sent when a design is deleted or otherwise removed from active use.',
    group: 'Brand & Catalog',
  },
  'notification.PRIVATE_ACCESS_REQUESTED': {
    title: 'Private access request received',
    description:
      'Sent when someone asks for access to private content you control.',
    group: 'Brand & Catalog',
  },
  'notification.PRIVATE_ACCESS_APPROVED': {
    title: 'Private access approved',
    description:
      'Sent when a private access request is approved and the requester can now view the content.',
    group: 'Brand & Catalog',
  },
  'notification.PRIVATE_ACCESS_REJECTED': {
    title: 'Private access rejected',
    description:
      'Sent when a private access request is declined.',
    group: 'Brand & Catalog',
  },
  'notification.PRIVATE_ACCESS_REVOKED': {
    title: 'Private access revoked',
    description:
      'Sent when previously granted private access is removed.',
    group: 'Brand & Catalog',
  },
  'notification.SIZE_FIT_UPDATE_REMINDER': {
    title: 'Size-fit update reminder',
    description:
      'Sent when your saved fitting profile is due for a refresh.',
    group: 'Size & Fit',
  },
  'notification.SIZE_FIT_SHARED': {
    title: 'Size fit shared',
    description:
      'Sent when your size-fit profile is shared with someone else.',
    group: 'Size & Fit',
  },
  'notification.SIZE_FIT_SHARE_REQUEST': {
    title: 'Size-fit share request',
    description:
      'Sent when someone asks for access to your size-fit details.',
    group: 'Size & Fit',
  },
  'notification.SIZE_FIT_SHARE_APPROVED': {
    title: 'Size-fit share approved',
    description:
      'Sent when a size-fit share request is approved.',
    group: 'Size & Fit',
  },
  'notification.SIZE_FIT_SHARE_REJECTED': {
    title: 'Size-fit share rejected',
    description:
      'Sent when a size-fit share request is declined.',
    group: 'Size & Fit',
  },
  'notification.SIZE_FIT_RESHARED': {
    title: 'Size fit reshared',
    description:
      'Sent when a size-fit profile you shared is shared onward again.',
    group: 'Size & Fit',
  },
  'notification.WISHLIST_PRODUCT_AVAILABLE': {
    title: 'Wishlisted product back in stock',
    description:
      'Sent when a product you saved becomes available again.',
    group: 'Platform & Operations',
  },
  'notification.WISHLIST_PRODUCT_UNAVAILABLE': {
    title: 'Wishlisted product unavailable',
    description:
      'Sent when a saved product is removed, sold out, or can no longer be purchased.',
    group: 'Platform & Operations',
  },
  'notification.ADMIN_ACTION': {
    title: 'Admin action notice',
    description:
      'Sent when an administrative action affects your account, content, or settings.',
    group: 'Platform & Operations',
  },
};

function humanizeScenarioKey(scenarioKey: string) {
  return scenarioKey
    .replace(/^notification\./i, '')
    .replace(/^auth\./i, '')
    .replace(/[._]/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function inferScenarioGroup(scenarioKey: string) {
  const key = scenarioKey.toUpperCase();

  if (key.startsWith('AUTH.') || key.includes('LOGIN') || key.includes('LOGOUT') || key.includes('SIGNUP')) {
    return 'Security';
  }
  if (key.includes('ORDER') || key.includes('PAYMENT') || key.includes('DISPUTE') || key.includes('DELIVERED')) {
    return 'Orders & Checkout';
  }
  if (key.includes('MESSAGE') || key.includes('THREAD') || key.includes('COMMENT') || key.includes('FOLLOW') || key.includes('TAG') || key.includes('PATCH')) {
    return 'Messaging & Social';
  }
  if (
    key.includes('COLLECTION') ||
    key.includes('PRODUCT') ||
    key.includes('PRIVATE_ACCESS') ||
    key.includes('CONTRIBUTION') ||
    key.includes('VERIFICATION')
  ) {
    return 'Brand & Catalog';
  }
  if (key.includes('SIZE_FIT')) {
    return 'Size & Fit';
  }
  return 'Platform & Operations';
}

function describeScenario(title: string, scenarioKey: string) {
  const key = scenarioKey.toUpperCase();

  if (key.includes('CUSTOM_ORDER')) {
    return `Sent when ${title.toLowerCase()} changes and the custom-order workflow needs attention.`;
  }
  if (key.includes('VERIFICATION')) {
    return `Sent when ${title.toLowerCase()} updates the status of a brand or store verification flow.`;
  }
  if (key.includes('BRAND_PATCH')) {
    return `Sent when ${title.toLowerCase()} changes the state of a brand-to-brand connection request.`;
  }
  if (key.includes('CONTRIBUTION')) {
    return `Sent when ${title.toLowerCase()} affects a contribution request or invite.`;
  }
  if (key.includes('REVIEW')) {
    return `Sent when ${title.toLowerCase()} affects a review you wrote or need to answer.`;
  }
  if (key.includes('FEATURED')) {
    return `Sent when ${title.toLowerCase()} changes featured placement on the platform.`;
  }
  if (key.includes('REJECTED')) {
    return `Sent when ${title.toLowerCase()} is rejected so you can review the outcome and next step.`;
  }
  if (key.includes('APPROVED')) {
    return `Sent when ${title.toLowerCase()} is approved and ready for the next step.`;
  }
  if (key.includes('REQUEST')) {
    return `Sent when ${title.toLowerCase()} needs your attention or response.`;
  }
  if (key.includes('REMINDER')) {
    return `Sent as a reminder when ${title.toLowerCase()} still needs attention.`;
  }
  if (key.includes('UPDATED') || key.includes('PROGRESS')) {
    return `Sent when ${title.toLowerCase()} changes and there is something new to review.`;
  }

  return `Sent when ${title.toLowerCase()} happens in Threadly.`;
}

function getScenarioMeta(scenarioKey: string): ScenarioMeta {
  const override = SCENARIO_OVERRIDES[scenarioKey];
  if (override) return override;

  const title = humanizeScenarioKey(scenarioKey);
  return {
    title,
    description: describeScenario(title, scenarioKey),
    group: inferScenarioGroup(scenarioKey),
  };
}

function getGroupRank(group: string) {
  const index = GROUP_ORDER.indexOf(group as (typeof GROUP_ORDER)[number]);
  return index === -1 ? GROUP_ORDER.length : index;
}

const PreferenceSwitch: React.FC<{
  checked: boolean;
  disabled?: boolean;
  onChange: (nextValue: boolean) => void;
  labelId: string;
}> = ({ checked, disabled = false, onChange, labelId }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-labelledby={labelId}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition ${
      checked
        ? 'border-indigo-600 bg-indigo-600'
        : 'border-gray-300 bg-gray-200 dark:border-white/15 dark:bg-white/10'
    } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
  >
    <span
      className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

const EmailPreferencesSettings: React.FC = () => {
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const result = await NotificationsApi.getEmailSettings();
        if (mounted) {
          setSettings(result as EmailSettings);
        }
      } catch (error) {
        console.error('Failed to load email settings', error);
        toast.error('Failed to load email preferences');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, []);

  const groupedScenarios = useMemo(() => {
    if (!settings) return [] as Array<{ group: string; items: Array<{ key: string; meta: ScenarioMeta }> }>;

    const grouped = Object.keys(settings.scenarios)
      .sort((left, right) => {
        const leftMeta = getScenarioMeta(left);
        const rightMeta = getScenarioMeta(right);
        if (leftMeta.group !== rightMeta.group) {
          return getGroupRank(leftMeta.group) - getGroupRank(rightMeta.group);
        }
        return leftMeta.title.localeCompare(rightMeta.title);
      })
      .reduce<Record<string, Array<{ key: string; meta: ScenarioMeta }>>>((acc, key) => {
        const meta = getScenarioMeta(key);
        if (!acc[meta.group]) acc[meta.group] = [];
        acc[meta.group].push({ key, meta });
        return acc;
      }, {});

    return Object.entries(grouped)
      .sort(([left], [right]) => getGroupRank(left) - getGroupRank(right))
      .map(([group, items]) => ({ group, items }));
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
      await updateSettings({ globalEnabled: nextValue }, 'General email preference updated');
    } catch {
      setSettings({ ...settings, globalEnabled: previous });
    }
  };

  const onToggleSecurityCritical = async (nextValue: boolean) => {
    if (!settings) return;

    let patch: Record<string, unknown> = { securityCriticalEnabled: nextValue };
    if (!nextValue) {
      const complianceAcknowledged = window.confirm(
        'Turning off security emails reduces account protection. Continue?',
      );
      if (!complianceAcknowledged) return;

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
      await updateSettings(patch, 'Security email preference updated');
    } catch {
      setSettings({ ...settings, securityCriticalEnabled: previous });
    }
  };

  const onToggleScenario = async (scenarioKey: string, nextValue: boolean) => {
    if (!settings) return;
    setPendingKey(scenarioKey);

    let patch: Record<string, unknown> = { scenarios: { [scenarioKey]: nextValue } };

    if (isCritical(scenarioKey) && !nextValue) {
      const complianceAcknowledged = window.confirm(
        'Turning off this security email can hide important account alerts. Continue?',
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
      await updateSettings(patch, `${getScenarioMeta(scenarioKey).title} email updated`);
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
    if (!window.confirm('Restore recommended default email settings?')) return;

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

  if (!settings) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-white">Email notifications</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Control which email updates Threadly sends you. Security emails stay protected unless you confirm the change with your password.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-gray-950">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p id="email-global-label" className="text-sm font-semibold text-gray-900 dark:text-white">
              General email updates
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Master switch for routine product, community, and operational emails.
            </p>
          </div>
          <PreferenceSwitch checked={settings.globalEnabled} onChange={(next) => void onToggleGlobal(next)} labelId="email-global-label" />
        </div>

        <div className="flex items-start justify-between gap-4 border-t border-gray-200 pt-4 dark:border-white/10">
          <div>
            <p id="email-security-label" className="text-sm font-semibold text-gray-900 dark:text-white">
              Security emails
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Keeps critical sign-in and account-protection emails available even when you trim other email categories.
            </p>
          </div>
          <PreferenceSwitch checked={settings.securityCriticalEnabled} onChange={(next) => void onToggleSecurityCritical(next)} labelId="email-security-label" />
        </div>

        <div className="border-t border-gray-200 pt-4 dark:border-white/10">
          <button
            type="button"
            onClick={() => void onResetDefaults()}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium transition hover:bg-gray-50 dark:border-white/15 dark:hover:bg-white/5"
          >
            Restore recommended defaults
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {groupedScenarios.map(({ group, items }) => (
          <div key={group} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-gray-950">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{group}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {GROUP_COPY[group] ?? 'Choose the email updates you want from this category.'}
            </p>

            <div className="mt-5 space-y-4">
              {items.map(({ key, meta }) => {
                const checked = settings.scenarios[key];
                const critical = isCritical(key);
                const labelId = `email-pref-${key.replace(/[^a-z0-9]+/gi, '-')}`;

                return (
                  <div key={key} className="flex items-start justify-between gap-4 rounded-2xl border border-gray-100 p-4 dark:border-white/5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p id={labelId} className="text-sm font-semibold text-gray-900 dark:text-white">
                          {meta.title}
                        </p>
                        {critical ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                            Security-critical
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{meta.description}</p>
                    </div>

                    <PreferenceSwitch
                      checked={checked}
                      disabled={pendingKey === key}
                      onChange={(next) => void onToggleScenario(key, next)}
                      labelId={labelId}
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
