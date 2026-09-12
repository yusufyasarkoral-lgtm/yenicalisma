import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";

/** The hosting platform injects these headers after its sign-in flow. */
export async function requireApiUser(): Promise<ChatGPTUser | Response> {
  const user = await getChatGPTUser();
  if (user) return user;
  return Response.json(
    { error: "Bu işlem için oturum açmanız gerekiyor." },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

export function isResponse(value: ChatGPTUser | Response): value is Response {
  return value instanceof Response;
}
