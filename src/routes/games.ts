"use strict";
/** Routes for games */


import express, { Express, Request, Response, NextFunction, Router } from "express";
import { ExpressError, NotFoundError, BadRequestError } from "../expressError";

import Game from "../models/game";

const router: Router = express.Router();

/** Retrieves a list of all games
 * Returns array of game objects like { id, ai, color, name, created_on }
 */
router.get("/", async function (req: Request, res: Response) {
  const games = await Game.getAll();
  return res.json({ games });
});

/** Retrieves a specific game based on id
 * Returns a game object like { id, ai, color, name, created_on }
 */
router.get("/:id", async function (req: Request, res: Response) {
  const game = await Game.get(req.params.id);
  return res.json({ game });
});

/** Creates a new game based on req object { name, color, ai }
 * Returns a game object like { id, name, color, ai, createdOn }
 */
router.post("/", async function (req: Request, res: Response) {
  const game = await Game.create(req.body);
  return res.status(201).json({ game });
});

/** Deletes a game
 * Returns the delete game's id
 */
router.delete("/:id", async function (req: Request, res: Response) {
  await Game.delete(req.params.id);
  return res.json({ deleted: req.params.id });
});

export { router as gamesRouter };

// module.exports = router;