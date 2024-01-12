"use strict";

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");
// const { sqlForPartialUpdate } = require("../helpers/sql");

/** Related functions for players. */

class Player {
  /**
   * Create a player (from data), update db, return new player data.
   *
   * data should be { name, color, ai }
   *
   * Returns { id, name, color, ai, createdOn }
   * */

  static async create({ name, color, ai }) {

    const result = await db.query(`
                INSERT INTO players (name,
                                      color,
                                      ai)
                VALUES ($1, $2, $3)
                RETURNING
                    id,
                    name,
                    color,
                    ai,
                    created_on AS "createdOn"`, [
          name,
          color,
          ai
        ],
    );

    const player = result.rows[0];

    return player;
  }

  /**
   * Find all players
   * Returns [{ id, name, color, ai, createdOn }, ...]   *
   * */

  static async getAll() {

    const result = await db.query(`
        SELECT id,
               name,
               color,
               ai,
               created_on AS "createdOn"
        FROM players
        ORDER BY created_on`);

    return result.rows;
  }

  /**
   * Given a player id, return data about player.
   *
   * Returns { id, name, color, ai, createdOn }
   *
   * Throws NotFoundError if not found.
   **/

  static async get(id) {
    const result = await db.query(`
        SELECT id,
               name,
               color,
               ai,
               created_on AS "createdOn"
        FROM players
        WHERE id = $1
        ORDER BY created_on`, [id]);

    const player = result.rows[0];

    if (!player) throw new NotFoundError(`No player with id: ${id}`);

    return player;
  }

  /**
   * Delete given player from database; returns undefined.
   *
   * Throws NotFoundError if player not found.
   **/

  static async delete(id) {
    const result = await db.query(`
        DELETE
        FROM players
        WHERE id = $1
        RETURNING id`, [id]);
    const player = result.rows[0];

    if (!player) throw new NotFoundError(`No player: ${id}`);
  }
}

module.exports = Player;
