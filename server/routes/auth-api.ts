import express from "express";
import { google } from "googleapis";

/**
 * 认证相关 API 路由 (Google Auth 等)
 */
export function createAuthRoutes() {
  const router = express.Router();

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "http://localhost:5173/google-auth-callback"
  );

  router.get("/google/url", (req, res) => {
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/drive.file"],
    });
    res.json({ url });
  });

  router.post("/google/callback", async (req, res) => {
    const { code } = req.body;
    try {
      const { tokens } = await oauth2Client.getToken(code);
      res.json(tokens);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
