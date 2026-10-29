import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useBrandCommerceAccess } from "@/hooks/useBrandCommerceAccess";
import { brandCustomersApi } from "@/api/BrandCustomersApi";
import Button from "@/components/ui/Button";

export default function CustomerSettings() {
  const navigate = useNavigate();
  const access = useBrandCommerceAccess();
  const client = useQueryClient();
  const scope = `${access.actorId}:${access.brandId}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const [draft, setDraft] = useState<{ scope: string; value: string } | null>(null);
  const minimum = draft?.scope === scope ? draft.value : String(access.data?.customerMinimumOrders ?? 3);
  const [pendingScope, setPendingScope] = useState<string | null>(null);
  const saving = pendingScope === scope;
  useEffect(() => {
    currentScope.current = scope;
    setDraft(null);
    return () => { currentScope.current = ""; };
  }, [scope]);
  const valid =
    /^\d+$/.test(minimum) && Number(minimum) >= 1 && Number(minimum) <= 1000;
  const enabled = access.data?.canConfigureCustomers === true;
  async function save() {
    if (!access.canManage || !access.brandId || !valid || !enabled || saving) return;
    setPendingScope(scope);
    try {
      const saved = await brandCustomersApi.update(access.brandId, Number(minimum));
      if (currentScope.current !== scope) return;
      client.setQueryData(["brand-commerce-access", access.actorId, access.brandId], saved);
      setDraft(null);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["brand-commerce-access", access.actorId, access.brandId] }),
        client.invalidateQueries({ queryKey: ["brand-customers", access.actorId, access.brandId] }),
      ]);
      if (currentScope.current === scope) toast.success("Customer settings saved");
    } catch {
      if (currentScope.current === scope) toast.error("Could not save customer settings. Try again.");
    } finally {
      setPendingScope((pending) => pending === scope ? null : pending);
    }
  }
  return (
    <section className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold text-theme">Customer settings</h1>
      <p className="text-theme-secondary">
        Choose how many paid orders a shopper needs to appear in Customers.
        Standard and custom orders count together. Cancelled and fully refunded
        orders are excluded.
      </p>
      {!access.canManage ? (
        <p role="status">Only the brand owner can change customer settings.</p>
      ) : null}
      {access.isLoading ? <p role="status">Loading settings…</p> : null}
      {access.isError ? (
        <p role="alert">
          Could not load settings.{" "}
          <Button
            type="button"
            variant="secondary"
            onClick={() => void access.refetch()}
          >
            Try again
          </Button>
        </p>
      ) : null}
      {access.data ? (
        <>
          {!enabled ? (
            <div className="space-y-3">
              <p className="text-theme-secondary">Free brands see every shopper with a qualifying paid order. A paid subscription enables purchase thresholds.</p>
              {access.data.canUpgrade ? <Button type="button" variant="brand" onClick={() => navigate('/settings?tab=subscription-billing')}>Upgrade</Button> : null}
            </div>
          ) : null}
          <label className="block space-y-2">
            <span className="font-semibold text-theme">
              Minimum paid orders {!enabled ? "· Upgrade" : ""}
            </span>
            <input
              type="number"
              name="customerMinimumOrders"
              autoComplete="off"
              min={1}
              max={1000}
              step={1}
              value={minimum}
              onChange={(event) => setDraft({ scope, value: event.target.value })}
              disabled={!enabled || saving}
              aria-describedby="customer-threshold-help"
              className="block min-h-11 w-full rounded-2xl bg-gray-100 px-4 py-3 text-theme disabled:opacity-50 dark:bg-zinc-900"
            />
          </label>
          <p
            id="customer-threshold-help"
            className="text-sm text-theme-secondary"
          >
            Set a whole number from 1 to 1,000. The default is 3. A plan
            downgrade shows all qualifying shoppers and keeps your saved
            threshold for later.
          </p>
          <Button
            type="button"
            variant="brand"
            loading={saving}
            onClick={() => void save()}
            disabled={!enabled || !valid || saving}
          >
            {saving ? "Saving…" : "Save customer settings"}
          </Button>
        </>
      ) : null}
    </section>
  );
}
