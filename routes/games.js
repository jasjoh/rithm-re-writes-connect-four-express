"use strict";
/** Routes for games */

const express = require("express");
const { NotFoundError, BadRequestError } = require("../expressError");

const router = new express.Router();
const db = require("../db");

/** Retrieves a list of all games
 * Returns array of game objects like { ... }
 */
router.get("/", async function (req, res) {
  const results = await db.query(
    `SELECT id
      FROM games
      ORDER BY id`
  );
  const games = results.rows;
  return res.json({ games });
});

module.exports = router;