import axios from 'axios';
import dotenv from 'dotenv';
import { OAuthTokenResponse, StoredTokens } from '../types/hmrc.types';

dotenv.config();

export class TokenService {
  private static instance: TokenService;
  private tokens: StoredTokens | null = null;

  private readonly clientId = process.env.HMRC_CLIENT_ID!;
  private readonly clientSecret = process.env.HMRC_CLIENT_SECRET!;
  private readonly redirectUri = process.env.HMRC_REDIRECT_URI!;
  private readonly baseUrl = process.env.HMRC_BASE_URL || 'https://test-api.service.hmrc.gov.uk';

  private constructor() {}

  public static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  /**
   * Generates the HMRC login URL for the user to grant permissions
   */
  public getAuthorizationUrl(): string {
    const scopes = encodeURIComponent('read:vat write:vat');
    return `${this.baseUrl}/oauth/authorize?response_type=code&client_id=${this.clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(this.redirectUri)}`;
  }

  /**
   * Exchanges the temporary authorization code for an Access & Refresh Token
   */
  public async exchangeCodeForToken(authCode: string): Promise<StoredTokens> {
    try {
      const response = await axios.post<OAuthTokenResponse>(
        `${this.baseUrl}/oauth/token`,
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          code: authCode,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      this.saveTokens(response.data);
      return this.tokens!;
    } catch (error: any) {
      console.error('Failed to exchange auth code:', error.response?.data || error.message);
      throw new Error('HMRC OAuth Code Exchange Failed');
    }
  }

  /**
   * Returns a valid access token, automatically triggering a refresh if expired
   */
  public async getValidAccessToken(): Promise<string> {
    if (!this.tokens) {
      throw new Error('No tokens stored. User authentication required.');
    }

    // Add a 60-second safety buffer before actual expiration
    const isExpired = Date.now() >= (this.tokens.expiresAt - 60000);

    if (isExpired) {
      console.log('Access token expired. Triggering silent refresh cycle...');
      await this.refreshAccessToken();
    }

    return this.tokens.accessToken;
  }

  /**
   * Executes the automated refresh token cycle with HMRC
   */
  private async refreshAccessToken(): Promise<void> {
    try {
      const response = await axios.post<OAuthTokenResponse>(
        `${this.baseUrl}/oauth/token`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: this.tokens!.refreshToken,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      this.saveTokens(response.data);
      console.log('Token silently refreshed successfully.');
    } catch (error: any) {
      console.error('Failed to refresh token:', error.response?.data || error.message);
      this.tokens = null; // Invalidate stored tokens on failure
      throw new Error('HMRC Token Refresh Failed. Re-authentication required.');
    }
  }

  private saveTokens(data: OAuthTokenResponse): void {
    this.tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
    };
  }
}
