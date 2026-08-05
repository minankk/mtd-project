export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface VatObligation {
  start: string;
  end: string;
  due: string;
  status: 'F' | 'O';
  periodKey: string;
}

export interface VatObligationsResponse {
  obligations: VatObligation[];
}
