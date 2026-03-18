/**
 * Sequencer REST API client.
 *
 * Provides typed access to all sequencer endpoints.
 * See scripts/sequencer/api.ts for the server implementation.
 */

import type {
  RootInfo,
  MerkleProofResponse,
  RegistrationProofResponse,
  StatsResponse,
  StoredEncryptedNote,
  HistoryResponse,
} from "../core/types.js";

export class SequencerClient {
  constructor(private readonly baseUrl: string) {}

  // --- Tree ---

  async getRoot(): Promise<RootInfo> {
    return this.get<RootInfo>("/root");
  }

  async getProof(leafIndex: number): Promise<MerkleProofResponse> {
    return this.get<MerkleProofResponse>(`/proof/${leafIndex}`);
  }

  async getProofs(
    from: number,
    to: number,
  ): Promise<MerkleProofResponse[]> {
    const data = await this.get<{ proofs: MerkleProofResponse[] }>(
      `/proofs?from=${from}&to=${to}`,
    );
    return data.proofs;
  }

  // --- Notes ---

  async getNotes(
    from: number,
    to: number,
  ): Promise<StoredEncryptedNote[]> {
    const data = await this.get<{ notes: StoredEncryptedNote[] }>(
      `/notes?from=${from}&to=${to}`,
    );
    return data.notes;
  }

  // Note: view tag filtering is done client-side in SDK (core/notes.ts).
  // The server never receives the user's private key.

  // --- Registration ---

  async getRegistrationProof(npk: string): Promise<RegistrationProofResponse> {
    return this.get<RegistrationProofResponse>(`/registration/proof/${npk}`);
  }

  async getRegistrationRoot(): Promise<{ root: string; leafCount: number }> {
    return this.get("/registration/root");
  }

  // --- Operator ---

  /**
   * Register a KYC-verified user with the operator.
   *
   * MVP: 자동 등록 (KYC 미연동). 추후 KYC 프로세스 통과 후에만 호출되도록 변경 예정.
   */
  async registerUser(
    address: string,
    npk: string,
    encPubKey: string,
  ): Promise<{ success: boolean; registrationRoot?: string; error?: string }> {
    return this.post("/operator/register", { address, npk, encPubKey });
  }

  async getOperatorPubKey(): Promise<string> {
    const data = await this.get<{ encPubKey: string }>("/operator/pubkey");
    return data.encPubKey;
  }

  // --- History ---

  async getHistory(address: string): Promise<HistoryResponse> {
    return this.get<HistoryResponse>(`/history/${address}`);
  }

  // --- Stats ---

  async getHealth(): Promise<{ status: string; leafCount: number }> {
    return this.get("/health");
  }

  async getStats(): Promise<StatsResponse> {
    return this.get<StatsResponse>("/stats");
  }

  // --- Internal ---

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Sequencer API error ${res.status}: ${body}`);
    }
    return res.json();
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Sequencer API error ${res.status}: ${text}`);
    }
    return res.json();
  }

}
