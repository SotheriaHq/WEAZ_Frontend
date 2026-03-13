import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrderMessagesPanel from '@/components/messaging/OrderMessagesPanel';

const listOrderMessages = vi.fn();
const listAdminOrderMessages = vi.fn();
const markOrderRead = vi.fn();
const sendOrderMessage = vi.fn();
const uploadMessageAttachment = vi.fn();
const getOrderSummary = vi.fn();

const onNotification = vi.fn(() => () => undefined);

vi.mock('react-redux', () => ({
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({
      user: {
        profile: {
          id: 'user-1',
        },
      },
    }),
}));

vi.mock('@/realtime/RealtimeProvider', () => ({
  useRealtime: () => ({
    onNotification,
  }),
}));

vi.mock('@/api/MessagingApi', () => ({
  messagingApi: {
    listOrderMessages: (...args: unknown[]) => listOrderMessages(...args),
    listAdminOrderMessages: (...args: unknown[]) => listAdminOrderMessages(...args),
    markOrderRead: (...args: unknown[]) => markOrderRead(...args),
    sendOrderMessage: (...args: unknown[]) => sendOrderMessage(...args),
    uploadMessageAttachment: (...args: unknown[]) => uploadMessageAttachment(...args),
    getOrderSummary: (...args: unknown[]) => getOrderSummary(...args),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const messageFixture = {
  id: 'message-1',
  threadId: 'thread-1',
  senderUserId: 'user-2',
  senderRole: 'BUYER',
  bodyText: 'hello',
  visibilityState: 'VISIBLE',
  createdAt: '2026-03-13T10:00:00.000Z',
  attachments: [],
  sender: { id: 'user-2', firstName: 'Ada' },
};

describe('OrderMessagesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    listOrderMessages.mockResolvedValue({
      items: [messageFixture],
      hasNextPage: false,
      endCursor: null,
    });
    listAdminOrderMessages.mockResolvedValue({
      items: [messageFixture],
      hasNextPage: false,
      endCursor: null,
    });
    markOrderRead.mockResolvedValue({ success: true });
    sendOrderMessage.mockResolvedValue({ success: true });
    uploadMessageAttachment.mockResolvedValue({
      id: 'file-1',
      fileName: 'sample.pdf',
      originalName: 'sample.pdf',
    });
    getOrderSummary.mockResolvedValue({ unreadCount: 1 });
  });

  it('uses admin list endpoint and keeps composer hidden for admin surface', async () => {
    render(
      <OrderMessagesPanel
        contextType="STANDARD_ORDER"
        orderId="order-1"
        actorSurface="ADMIN"
        readOnly
      />,
    );

    await waitFor(() => {
      expect(listAdminOrderMessages).toHaveBeenCalledWith('order-1', { limit: 50 });
    });

    expect(markOrderRead).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText('Type a message for this order')).not.toBeInTheDocument();
  });

  it('sends attachment-only message payload for buyer surface', async () => {
    render(
      <OrderMessagesPanel
        contextType="STANDARD_ORDER"
        orderId="order-1"
      />,
    );

    await waitFor(() => {
      expect(listOrderMessages).toHaveBeenCalledWith('order-1', { limit: 50 });
    });

    const attachButton = screen.getByText('Attach files');
    const attachLabel = attachButton.closest('label');
    const fileInput = attachLabel?.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const file = new File(['doc'], 'sample.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadMessageAttachment).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => {
      expect(sendOrderMessage).toHaveBeenCalledTimes(1);
    });

    const payload = sendOrderMessage.mock.calls[0]?.[1];
    expect(payload.attachmentFileIds).toEqual(['file-1']);
    expect(payload.bodyText).toBeUndefined();
  });
});
