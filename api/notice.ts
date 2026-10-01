/**
 * What the server has to say to every app: the notice, and whether the server
 * features are paused. See src/lib/serverNotice and docs/tietoturvaloukkaus.md.
 *
 *   GET /api/notice  ->  { ok: true, notice: ServerNotice | null, paused: boolean }
 *
 * The app asks once when it starts and again when it comes back after hours
 * away. The request carries only the app's version and platform, like every
 * other request. Nothing is stored, nothing is logged.
 *
 * The one endpoint the kill switch leaves open: a pause without a way to say
 * why reads to the reader as a broken app.
 */
import { isServicePaused, serverNoticeFromEnv } from '../src/lib/serverNotice';

interface RequestLike {
  method?: string;
}

interface ResponseLike {
  status(code: number): ResponseLike;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
}

export default function handler(req: RequestLike, res: ResponseLike): void {
  if (req.method !== 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  // The same answer for everyone: a minute at the edge spares the function a
  // run per app start, and a new notice still reaches phones within a minute
  // of the deployment that carries it.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
  res.status(200).json({
    ok: true,
    notice: serverNoticeFromEnv(process.env),
    paused: isServicePaused(process.env),
  });
}
