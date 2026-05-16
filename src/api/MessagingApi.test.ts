import { beforeEach, describe, expect, it, vi } from 'vitest';
import { messagingApi } from './MessagingApi';
import { apiClient } from './httpClient';

vi.mock('./httpClient', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

const mockedApiClient = vi.mocked(apiClient);

describe('messagingApi direct brand messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts direct brand messages to the messaging endpoint with idempotency header', async () => {
    mockedApiClient.post.mockResolvedValueOnce({
      data: {
        data: {
          thread: { id: 'thread-1' },
          message: { id: 'message-1' },
        },
      },
    });

    await expect(
      messagingApi.sendBrandMessage('brand-1', {
        bodyText: 'Hello brand',
        clientMessageId: 'client-message-1',
      }),
    ).resolves.toEqual({
      thread: { id: 'thread-1' },
      message: { id: 'message-1' },
    });

    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/messaging/brands/brand-1/messages',
      {
        bodyText: 'Hello brand',
        clientMessageId: 'client-message-1',
      },
      { headers: { 'Idempotency-Key': 'client-message-1' } },
    );
  });
});
