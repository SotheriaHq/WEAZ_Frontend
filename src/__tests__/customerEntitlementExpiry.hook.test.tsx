import type { PropsWithChildren } from 'react';
import { act, cleanup, renderHook, render as renderUi, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBrandCommerceAccess } from '@/hooks/useBrandCommerceAccess';
import { MemoryRouter } from 'react-router-dom';
import CustomersPage from '@/pages/dashboard/CustomersPage';
import { brandCustomersApi, type BrandCommerceAccess } from '@/api/BrandCustomersApi';

vi.mock('react-redux',()=>({useSelector:(select:(state:unknown)=>unknown)=>select({user:{profile:{id:'owner'}}})}));
const role = vi.hoisted(() => ({ owner: true }));
vi.mock('@/lib/brandAccess',()=>({getActiveBrandId:()=> 'brand',isBrandOwner:()=>role.owner}));
vi.mock('@/api/BrandCustomersApi',()=>({brandCustomersApi:{access:vi.fn()}}));
const start=Date.parse('2026-10-23T12:00:00Z');
const paid:BrandCommerceAccess={tierKey:'THREAD',canUpgrade:true,canConfigureCustomers:true,customerMinimumOrders:3,effectiveMinimumOrders:3,serverNow:new Date(start).toISOString(),entitlementExpiresAt:new Date(start+1000).toISOString()};
let client:QueryClient;
function render(access=paid){
  client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});
  client.setQueryData(['brand-commerce-access','owner','brand'],access);
  const wrapper=({children}:PropsWithChildren)=><QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(()=>useBrandCommerceAccess(),{wrapper});
}
beforeEach(()=>{role.owner=true;vi.useFakeTimers();vi.setSystemTime(start);vi.mocked(brandCustomersApi.access).mockReset();});
afterEach(()=>{cleanup();client?.clear();vi.useRealTimers();});
describe('customer settings expiry without polling',()=>{
  it('hides cached owner entitlements after an account loses owner access', () => {
    role.owner = false;
    const result = render();
    expect(result.result.current.data).toBeUndefined();
    expect(brandCustomersApi.access).not.toHaveBeenCalled();
  });
  it.each([true, false])('keeps customer records readable and makes settings owner-only (owner=%s)', owner => {
    role.owner = owner;
    client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});
    client.setQueryData(['brand-commerce-access','owner','brand'],paid);
    client.setQueryData(['brand-customers','owner','brand',1,''],{items:[{id:'shopper',name:'Ada Shopper',username:'ada',orderCount:3,lastOrderAt:new Date(start).toISOString()}],total:1,page:1,limit:25,hasNextPage:false,settings:{effectiveMinimumOrders:3}});
    renderUi(<MemoryRouter><QueryClientProvider client={client}><CustomersPage /></QueryClientProvider></MemoryRouter>);
    expect(screen.getByText('Ada Shopper')).toBeTruthy();
    expect(Boolean(screen.queryByRole('link',{name:'Customer settings'}))).toBe(owner);
    expect(brandCustomersApi.access).not.toHaveBeenCalled();
  });
  it('refreshes once at paid expiry and switches to free criteria',async()=>{
    vi.mocked(brandCustomersApi.access).mockResolvedValue({...paid,tierKey:'FREE',canConfigureCustomers:false,effectiveMinimumOrders:1,serverNow:new Date(start+1000).toISOString(),entitlementExpiresAt:null});
    const result=render();
    expect(result.result.current.data?.canConfigureCustomers).toBe(true);
    expect(brandCustomersApi.access).not.toHaveBeenCalled();
    await act(async()=>{await vi.advanceTimersByTimeAsync(1001);});
    expect(result.result.current.data?.canConfigureCustomers).toBe(false);
    expect(result.result.current.data?.effectiveMinimumOrders).toBe(1);
    expect(brandCustomersApi.access).toHaveBeenCalledTimes(1);
    await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});
    expect(brandCustomersApi.access).toHaveBeenCalledTimes(1);
  });
  it('keeps controls read-only when expiry refresh fails, without a request loop',async()=>{
    vi.mocked(brandCustomersApi.access).mockRejectedValue(Error('Offline'));
    const result=render();
    await act(async()=>{await vi.advanceTimersByTimeAsync(1001);});
    expect(result.result.current.data?.canConfigureCustomers).toBe(false);
    await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});
    expect(brandCustomersApi.access).toHaveBeenCalledTimes(1);
  });
  it('does not poll a free brand',async()=>{
    render({...paid,tierKey:'FREE',canConfigureCustomers:false,effectiveMinimumOrders:1,entitlementExpiresAt:null});
    await act(async()=>{await vi.advanceTimersByTimeAsync(86400000);});
    expect(brandCustomersApi.access).not.toHaveBeenCalled();
  });
});
