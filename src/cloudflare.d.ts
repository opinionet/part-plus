declare namespace Cloudflare {
  interface Env {
    DATABASE_URL?: string
    BTY_LLM_SERVER_BASE_URL?: string
    BTY_LLM_SERVER_API_KEY?: string
    STRIPE_SECRET_KEY?: string
    STRIPE_WEBHOOK_SECRET?: string
    STRIPE_PRO_PRICE_ID?: string
    BUYER_PRO_PRICE_ID?: string
  }
}
