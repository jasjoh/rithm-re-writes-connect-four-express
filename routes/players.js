"use strict";
/** Routes for players */

const express = require("express");
const { NotFoundError, BadRequestError } = require("../expressError");

const router = new express.Router();
const db = require("../db");

/** Retrieves a list of all players
 * Returns array of player objects like { id, ai, color, name }
 */
router.get("/", async function (req, res) {
  const results = await db.query(
    `SELECT id, ai, color, name
      FROM players
      ORDER BY id`
  );
  const players = results.rows;
  return res.json({ players });
});

module.exports = router;