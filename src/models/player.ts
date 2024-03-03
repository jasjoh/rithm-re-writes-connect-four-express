import { ExpressError, NotFoundError, BadRequestError } from "../expressError";
import { SQLQueries } from "../utilities/sqlQueries";

import db from "../db";

// const { sqlForPartialUpdate } = require("../helpers/sql");

/**
 * TODO:
 * - implement CountResultInterface
 * - implement QueryResult interfaces
 */

interface NewPlayerInterface {
  name: string;
  color: string;
  ai: boolean;
};

interface PlayerInterface extends NewPlayerInterface {
  id: string;
  createdOn: Date;
};

class Player {
  /**
   * Create a player (from data), update db, return new player data.
   *
   * data should be { name, color, ai }
   *
   * Returns { id, name, color, ai, createdOn }
   * */

  static async create(newPlayer: NewPlayerInterface) : Promise<PlayerInterface> {

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

    const player : PlayerInterface = result.rows[0];
    return player;
  }

  /**
   * Find all players
   * Returns [{ id, name, color, ai, createdOn }, ...]   *
   * */

  static async getAll() {

    const sqlQuery = `
      SELECT ${SQLQueries.defaultPlayerCols}
      FROM players
      ORDER BY created_on
    `
    const result = await db.query(sqlQuery);

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

  static async get(id: string) : Promise<PlayerInterface> {
    const result = await db.query(`
        SELECT id,
               name,
               color,
               ai,
               created_on AS "createdOn"
        FROM players
        WHERE id = $1
        ORDER BY created_on`, [id]);

    const player : PlayerInterface = result.rows[0];

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

export { Player, NewPlayerInterface, PlayerInterface };
