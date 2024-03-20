import { ExpressError, NotFoundError, BadRequestError } from "../expressError";
import { SQLQueries } from "../utilities/sqlQueries";
import { QueryResult } from "pg";

import db from "../db";

interface TurnInterface {
  turnId: number,
  gameId: string,
  playerId: string,
  location: string[]
}

export class Turn {

  /**
   * Creates a new record of a turn taking place for a given game and player
   * @param gameId - The ID of the game this turn is associated with.
   * @param playerId - The Id of the player this turn is associated with.
   * @param location - The [y, x] coordinates of where the piece was placed.
   * Returns undefined.
   */
  static async create(
    gameId: string,
    playerId: string,
    location: number[]
  ) : Promise<undefined> {
    console.log("Turns.create() called.")
    await db.query(`
        INSERT INTO game_turns ( game_id, player_id, location )
        VALUES ( $1, $2, $3 )
      `, [gameId, playerId, location]);
  }

  /**
   * Retrieves all the turns associated with a game and optionally a specific player
   * Returns an array of 0 or more turns in the form of TurnInterface[]
   */
  static async getTurns(gameId: string, playerId?: string) : Promise<TurnInterface[]> {
    console.log("Turns.getTurns() called");

    let whereClause : string = 'game_id = $1';
    let values = [gameId];
    if (playerId !== undefined) {
      whereClause += ' AND player_id = $2';
      values.push(playerId);
    }
    const result : QueryResult<TurnInterface> = await db.query(`
      SELECT
        id as "turnId",
        game_id as "gameId",
        player_id as "playerId",
        location
      FROM turns
      ${whereClause}
      ORDER BY id
    `,)
    return result.rows;
  }


}