import { ExpressError, NotFoundError, BadRequestError } from "../expressError";

import db from "../db";

// const { sqlForPartialUpdate } = require("../helpers/sql");

interface NewPlayerInterface {
  name: string;
  color: string;
  ai: boolean;
};

interface PlayerInterface extends NewPlayerInterface {
  id: string;
  createdOn: string;
};

class Player {
  /**
   * Create a player (from data), update db, return new player data.
   *
   * data should be { name, color, ai }
   *
   * Returns { id, name, color, ai, createdOn }
   * */

  static async create(newPlayer: NewPlayerInterface) {

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
          newPlayer.name,
          newPlayer.color,
          newPlayer.ai
        ],
    );

    const player = result.rows[0];
    console.log("TO BE TYPED: result.rows[0] in Player.create");

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

    console.log("TO BE TYPED: result in Player.getAll");

    return result.rows;
  }

  /**
   * Given a player id, return data about player.
   *
   * Returns { id, name, color, ai, createdOn }
   *
   * Throws NotFoundError if not found.
   **/

  static async get(id: string) {
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

  static async delete(id: string) {
    const result = await db.query(`
        DELETE
        FROM players
        WHERE id = $1
        RETURNING id`, [id]);
    const player = result.rows[0];

    if (!player) throw new NotFoundError(`No player: ${id}`);
  }
}

export { Player, PlayerInterface };
