import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { TwoFactorAuth } from '../settings/TwoFactorAuth';

const mockToast = vi.fn();
const mockGet2FAStatus = vi.fn();
const mockSetup2FA = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isSuperAdmin: true,
    isClientAdmin: false,
  }),
}));

vi.mock('@/hooks/use2FA', () => ({
  use2FA: () => ({
    isLoading: false,
    get2FAStatus: mockGet2FAStatus,
    setup2FA: mockSetup2FA,
    verifySetup: vi.fn(),
    disable2FA: vi.fn(),
    regenerateBackupCodes: vi.fn(),
  }),
}));

describe('TwoFactorAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet2FAStatus.mockResolvedValue({ enabled: false, verified_at: null });
    mockSetup2FA.mockResolvedValue({
      secret: 'ABCD1234EFGH5678',
      otpAuthUrl: 'otpauth://totp/Canvas:test@example.com?secret=ABCD1234EFGH5678',
      qrCodeDataUrl: 'data:image/png;base64,LOCALQRDATA',
      backupCodes: ['AAAA-BBBB'],
    });
  });

  test('renders the QR image from server-provided data instead of a third-party URL', async () => {
    render(<TwoFactorAuth />);

    fireEvent.click(await screen.findByRole('button', { name: /enable 2fa/i }));

    const qrImage = await screen.findByAltText('2FA QR Code');
    expect(qrImage).toHaveAttribute('src', 'data:image/png;base64,LOCALQRDATA');
    expect(qrImage.getAttribute('src')).not.toContain('api.qrserver.com');
    expect(screen.getByText('ABCD1234EFGH5678')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockSetup2FA).toHaveBeenCalled();
    });
  });
});