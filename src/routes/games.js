"use strict";
/** Routes for games */

const express = require("express");
const { NotFoundError, BadRequestError } = require("../expressError");

const router = new express.Router();
const db = require("../db");

const Game = require("../models/game");

/** Retrieves a list of all games
 * Returns array of game objects like { id, ai, color, name, created_on }
 */
router.get("/", async function (req, res) {
  const games = await Game.getAll();
  return res.json({ games });
});

/** Retrieves a specific game based on id
 * Returns a game object like { id, ai, color, name, created_on }
 */
router.get("/:id", async function (req, res) {
  const game = await Game.get(req.params.id);
  return res.json({ game });
});

/** Creates a new game based on req object { name, color, ai }
 * Returns a game object like { id, name, color, ai, createdOn }
 */
router.post("/", async function (req, res) {
  const game = await Game.create(req.body);
  return res.status(201).json({ game });
});

/** Deletes a game
 * Returns the delete game's id
 */
router.delete("/:id", async function (req, res) {
  await Game.delete(req.params.id);
  return res.json({ deleted: req.params.id });
});

module.exports = router;