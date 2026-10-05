import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiClientError } from "./api-client";

describe("ApiClient", () => {
  it("throws a normalized envelope and preserves the server request id", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "ORDER_STATUS_INVALID",
            message: "Invalid transition",
            details: [],
            requestId: "req-42",
          },
        }),
        { status: 409, headers: { "content-type": "application/json" } }
      )
    );
    const client = new ApiClient({
      baseUrl: "https://api.example.test",
      fetchImpl,
    });

    await expect(client.get("/orders/1")).rejects.toMatchObject({
      name: "ApiClientError",
      code: "ORDER_STATUS_INVALID",
      message: "Invalid transition",
      requestId: "req-42",
      toEnvelope: expect.any(Function),
    });
  });

  it("uses a stable safe fallback for non-JSON HTTP failures", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("upstream secret", { status: 502 }));
    const client = new ApiClient({
      baseUrl: "https://api.example.test",
      fetchImpl,
    });

    const request = client.get("/health");
    await expect(request).rejects.toBeInstanceOf(ApiClientError);
    await expect(request).rejects.toMatchObject({
      code: "API_REQUEST_FAILED",
      message: "API request failed with status 502.",
    });
  });

  it("adds a bearer token only when the caller provides one", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ success: true, data: [], requestId: "req-1" }),
          { status: 200 }
        )
      );
    const client = new ApiClient({
      baseUrl: "https://api.example.test",
      fetchImpl,
      accessTokenFactory: () => "token-1",
    });
    await client.get("/finance/accounts");
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-1" }),
      })
    );
  });

  it("posts JSON with the bearer token and returns the API envelope", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ success: true, data: { id: "entry-1" } }),
          { status: 200 }
        )
      );
    const client = new ApiClient({
      baseUrl: "https://api.example.test",
      fetchImpl,
      accessTokenFactory: () => "token-1",
    });

    await expect(
      client.post("/api/v1/finance/entries", { description: "test" })
    ).resolves.toMatchObject({
      success: true,
      data: { id: "entry-1" },
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ description: "test" }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer token-1",
        }),
      })
    );
  });
});
