# Green zone — Backend

## Quick start (local)
1. cd backend
2. npm install
3. copy `.env.example` to `.env` and set keys
4. npm run migrate
5. npm start

## Notes
- Use Stripe CLI for local webhook testing:
  `stripe listen --forward-to localhost:4242/webhook`
- Do not commit `.env`
