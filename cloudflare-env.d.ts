declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    OPENAI_API_KEY?: string;
    GEMINI_API_KEY?: string;
    LOCAL_DEV_USER_ID?: string;
    LOCAL_DEV_USER_EMAIL?: string;
    LOCAL_DEV_USER_NAME?: string;
  }
}
