"use strict";
/** Routes for players */

const express = require("express");
const { NotFoundError, BadRequestError } = require("../expressError");

const router = new express.Router();
const db = require("../db");

const Player = require("../models/player");

/** TODO:
 * - add schema validators
 */

/** Retrieves a list of all players
 * Returns array of player objects like { id, ai, color, name, created_on }
 */
router.get("/", async function (req, res) {
  const players = await Player.getAll();
  return res.json({ players });
});

/** Retrieves a specific player based on id
 * Returns a player object like { id, ai, color, name, created_on }
 */
router.get("/:id", async function (req, res) {
  const player = await Player.get(req.params.id);
  return res.json({ player });
});

/** Creates a new player based on req object { name, color, ai }
 * Returns a player object like { id, name, color, ai, createdOn }
 */
router.post("/", async function (req, res) {
  const player = await Player.create(req.body);
  return res.status(201).json({ player });
});

/** Deletes a player
 * Returns the delete player's id
 */
router.delete("/:id", async function (req, res) {
  await Player.delete(req.params.id);
  return res.json({ deleted: req.params.id });
});


module.exports = router;