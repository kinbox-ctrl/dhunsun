import { Router } from 'express';
import { schemas, validate, wrap } from '../middleware/index.ts';
import { catalog } from '../services/audius.ts';

/**
 * Streaming: resolve the signed upstream location and redirect. The browser's <audio>
 * element then does its own Range requests directly against the CDN (CORS allows it),
 * so seeking is instant and no audio bytes flow through this server.
 */
export const streamRouter = Router();

streamRouter.get('/:id', validate(schemas.id, 'params'), wrap(async (req, res) => {
  const loc = await catalog.streamLocation(req.params.id as string);
  res.setHeader('Cache-Control', 'private, max-age=600');
  res.redirect(302, loc);
}));
