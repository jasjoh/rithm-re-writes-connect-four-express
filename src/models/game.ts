import { ExpressError, NotFoundError, BadRequestError } from "../expressError";
import { TooFewPlayers, PlayerAlreadyExists } from "../utilities/gameErrors";
import { SQLQueries } from "../utilities/sqlQueries";
import { CountResultInterface } from "../utilities/commonInterfaces";

import db from "../db";
import { PlayerInterface } from "./player";
import { QueryResult } from "pg";

// const { sqlForPartialUpdate } = require("../helpers/sql");

/**
 * TODO:
 * - update select statement to return as camelCase + update interfaces
 */

interface NewGameInterface {
  height: number;
  width: number;
}

interface GameInterface {
  id: string;
  width: number;
  height: number;
  game_state: number;
  placed_pieces: number[][] | null;
  board: any[][] | null;
  winning_set: number[][] | null;
  curr_player_id: string | null;
  created_on: Date;
}

interface GamePlayersInterface {
  player_id: string;
  game_id: string;
  play_order: number | null;
  ai: undefined | boolean;
}

interface GameTurnsInterface {
  id: number;
  player_id: string;
  game_id: string;
  created_on_epoch: number;
}

class Game {

  /**
   * Instantiates a new game based on params and returns it.
   *
   * Params are optional, but should be { height, width }
   *
   * Returns { ... game object ... }
   * */
  static async create(newGame: NewGameInterface = { height: 7, width: 6 }) {

    const result: QueryResult<GameInterface> = await db.query(`
                INSERT INTO games (
                                    height,
                                    width
                                  )
                VALUES  (
                          $1,
                          $2
                        )
                RETURNING
                    id,
                    height,
                    width,
                    game_state AS "gameState",
                    created_on AS "createdOn"`, [
      newGame.height,
      newGame.width
    ],
    );

    const game = result.rows[0];

    return game;
  }

  /**
   * Retrieves an array of all games with summary information
   * Returns [{ id, gameState, createdOn }, ...]   *
   * */
  static async getAll() {

    const result: QueryResult<GameInterface> = await db.query(`
        SELECT
          id,
          game_state AS "gameState",
          created_on AS "createdOn"
        FROM games
        ORDER BY created_on`
    );

    return result.rows;
  }

  /**
   * Given a game id, return data about game.
   *
   * Returns { ... game object ... }
   *
   * Throws NotFoundError if not found.
   **/
  static async get(gameId: string) {
    const result: QueryResult<GameInterface> = await db.query(`
        SELECT
          id,
          height,
          width,
          board,
          game_state AS "gameState",
          placed_pieces AS "placedPieces",
          winning_set AS "winningSet",
          curr_player_id AS "currPlayerId",
          created_on AS "createdOn"
        FROM games
        WHERE id = $1
        ORDER BY created_on`, [gameId]);

    const game = result.rows[0];

    if (!game) throw new NotFoundError(`No game with id: ${gameId}`);

    return game;
  }

  /**
   * Delete given game from database; returns undefined.   *
   * Throws NotFoundError if game not found.
   **/
  static async delete(gameId: string) {
    const result: QueryResult<GameInterface> = await db.query(`
        DELETE
        FROM games
        WHERE id = $1
        RETURNING id`, [gameId]);
    const game = result.rows[0];

    if (!game) throw new NotFoundError(`No game: ${gameId}`);
  }

  /** Adds a player to an existing game
   * Throws error if game or player doesn't exist or player already added
   * Returns current player count if successful
   */
  static async addPlayer(playerId: string, gameId: string) {
    console.log("Game.addPlayer() called with playerId, gameId:", playerId, gameId);

    try {
      await db.query(
        `
        INSERT INTO game_players (player_id, game_id)
        VALUES ($1, $2)
        RETURNING *
        `
        , [playerId, gameId]
      );
    } catch (err: unknown) {
      const postgresError = err as { code?: string, message: string; };
      if (postgresError.code === '23505') {
        throw new PlayerAlreadyExists(
          `Player ${playerId} has already been added to game ${gameId}`
        );
      } else { throw err; }
    }

    const result: QueryResult<CountResultInterface> = await db.query(`
        SELECT COUNT(*)
        FROM game_players
        WHERE game_id = $1
    `, [gameId]);
    console.log("result of getting count from game_players:", result);

    return result.rows[0].count;
  }

  /**
   * Removes a player from a game; returns undefined.   *
   * Throws NotFoundError if game or player not found.
   **/
  static async removePlayer(playerId: string, gameId: string) {
    const result: QueryResult<GamePlayersInterface> = await db.query(`
        DELETE
        FROM game_players
        WHERE player_id = $1 AND game_id = $2
        RETURNING player_id`, [playerId, gameId]);
    const removedPlayer = result.rows[0];

    if (!removedPlayer) throw new NotFoundError(`No such player or game.`);
  }

  /** Adds a player to an existing game
   * Throws error if game or player doesn't exist or player already added
   * Returns current player count if successful
   */
  static async getPlayers(gameId: string) {
    // console.log("Game.getPlayers() called with gameId:", gameId)
    const sqlQuery = `
      SELECT ${SQLQueries.defaultPlayerCols}, game_players.play_order
      FROM players
      INNER JOIN game_players
      ON game_players.player_id = players.id
      WHERE game_players.game_id = $1
      ORDER BY players.created_on
    `;
    const result: QueryResult<PlayerInterface> = await db.query(sqlQuery, [gameId]);
    // console.log("result rows of selecting game players:", result.rows);
    return result.rows;
  }

  /** Starts a game.
   * Initializes / resets game state and then calls startTurn
   * Throws error is there are insufficient players to start a game or game
   * doesn't exist
   * Returns undefined
  */
  static async start(gameId: string) {

    // verify game exists
    const queryGIResult: QueryResult<GameInterface> = await db.query(`
        SELECT
          height,
          width
        FROM games
        WHERE id = $1`, [gameId]);
    const game = queryGIResult.rows[0];
    if (!game) throw new NotFoundError(`No game with id: ${gameId}`);

    // verify 2 players minimum
    const queryCountResult: QueryResult<CountResultInterface> = await db.query(`
        SELECT COUNT(*)
        FROM game_players
        WHERE game_id = $1`, [gameId]
    );
    if (queryCountResult.rows[0].count < 2) {
      throw new TooFewPlayers(`Game (${gameId}) has too few players to be started.`);
    }

    // initialize the board and reset game state
    const board = Game.initializeNewBoard(game.height, game.width);
    await db.query(`
        UPDATE games
        SET
          board = $2,
          game_state = DEFAULT,
          placed_pieces = DEFAULT,
          winning_set = DEFAULT,
          curr_player_id = DEFAULT
        WHERE id = $1`, [gameId, board]
    );

    // start the next turn
    Game.startTurn(gameId);
    return undefined;
  }

  /**
   * Initializes a new turn for a given game; accepts the id of that game
   * Updates current player and if it's an AI, calls that player's aiTakeTurn()
   * Returns undefined
   */
  static async startTurn(gameId: string) {
    /**
     * Core Logic:
     * - determines current player
     * -- if current player is AI, calls that player's aiTakeTurn() callback
     * -- if current player is human, awaits that player's pieceDrop
     */
    let queryGIResult: QueryResult<GameInterface> = await db.query(`
      SELECT curr_player_id
      FROM games
      WHERE id = $1
    `, [gameId]
    );

    let currPlayerId = queryGIResult.rows[0].curr_player_id;
    let nextPlayerId: string;

    // check if there is a current player
    if (currPlayerId === null) {
      // there is not, so set turn order for all players

      // get an array of all player IDs
      const queryGPIResult: QueryResult<GamePlayersInterface> = await db.query(`
          SELECT player_id
          FROM game_players
          WHERE game_id = $1
      `, [gameId]
      );

      let playerIds: string[] = [];
      for (let row of queryGPIResult.rows) {
        playerIds.push(row.player_id);
      }
      console.log("playerIds after extracting them from query rows:", playerIds);

      // randomly sort the array () - Fisher Yates
      for (let i = playerIds.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * i);
        [playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]];
      }
      console.log("playerIds after randomly sorting:", playerIds);

      // build SQL statement from array
      let sqlQuery = 'UPDATE game_players SET play_order = CASE ';
      for (let i = 0; i < playerIds.length; i++) {
        sqlQuery += `WHEN player_id = '${playerIds[i]}' THEN ${i} `;
      }
      sqlQuery += `END WHERE game_id = $1`;
      console.log("completed sqlQuery for setting turns:", sqlQuery);

      // execute SQL statement to set play order
      await db.query(sqlQuery, [gameId]);

      // set curr_player to game_players player with play_order = 0
      await db.query(`
          UPDATE games
          SET curr_player_id = $2
          WHERE id = $1
      `, [gameId, playerIds[0]]);
    }

    // set the current player
    const queryGPIResult : QueryResult<GamePlayersInterface> = await db.query(`
        SELECT game_player.player_id, game_players.play_order, player.ai
        FROM game_players
        INNER JOIN players ON game_players.player_id = players.id
        WHERE game_players.game_id = $1
    `, [gameId]);

    // { player_id, game_id, play_order }
    const gamePlayers = queryGPIResult.rows;
    const currGamePlayerObject = gamePlayers.find(o => o.player_id === currPlayerId);

    if (currGamePlayerObject === undefined) {
      throw new Error("Unable to find current player.");
    }

    if (currGamePlayerObject.play_order === gamePlayers.length - 1) {
      // we are on the last player, go to the first player
      const turnZeroPlayer = gamePlayers.find(o => o.play_order === 0);
      if (turnZeroPlayer === undefined) {
        throw new Error("Unable to find turn zero player.");
      }
      nextPlayerId = turnZeroPlayer.player_id;
    } else {
      const currPlayerPlayOrder = currGamePlayerObject.play_order;
      if (currPlayerPlayOrder === null) {
        throw new Error("Player play order improperly initialized.");
      }
      const potentialNextPlayer = gamePlayers.find(o => o.play_order === currPlayerPlayOrder + 1)
      if (potentialNextPlayer === undefined) {
        throw new Error("Unable to find next player.");
      }
      nextPlayerId = potentialNextPlayer.player_id;
    }

    console.log("nextPlayerId found:", nextPlayerId);

    // set curr_player on game to nextPlayerId
    // if next player is ai player, call their callback

  }

  /**
   * Attempts to drop a piece on behalf of a player at a given column
   * Accepts a game ID, player ID and column to drop in
   * Returns true if the drop was successful, otherwise false   *
   */
  static async dropPiece(gameId: string, playerId: string, col: number) {
    /**
     * Core Logic:
     * - determine validity of drop
     * - place piece if valid (update board state)
     * - add game turn record
     * - check for end game:
     * -- if end game, update state accordingly and you're done
     * -- if game is not ended, call startTurn for provide gameId
     */
  }

  /** Initialized a new board upon creation of a new game
   * Fills in all cells with BoardCellFinalStates { player, validCoords }
   * Returns a newly created board (array of array of BoardCellFinalStates)
   */
  static initializeNewBoard(height: number, width: number) {

    interface BoardCellFinalStateInterface {
      player: PlayerInterface | null;
      validCoordSets: number[][][];

    }

    type BoardCellState = BoardCellFinalStateInterface | null;

    const boardState: BoardCellState[][] = [];

    _initializeMatrix();
    _populateBoardSpaces();

    return boardState;

    /** Initializes the valid boundaries of the board */
    function _initializeMatrix() {
      // console.log("_initializeMatrix() called.");
      for (let y = 0; y < height; y++) {
        const row = [];
        for (let x = 0; x < width; x++) {
          row.push(null);
        }
        boardState.push(row);
      }
      // console.log("Matrix initialized.")
    }

    function _populateBoardSpaces() {
      // console.log("_populateBoardSpaces() called.")
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          // console.log("attempting to set game board for xy:", y, x);
          boardState[y][x] = {
            player: null,
            validCoordSets: _populateValidCoordSets(y, x)
          };
        }
      }

      // console.log("Board spaces populated:", boardState);

      /** Accepts board coordinates and return array of valid coord sets */
      function _populateValidCoordSets(y: number, x: number) {
        // console.log("_populateValidCoordSets called with yx:", y, x);
        const vcs: number[][][] = [];
        let coordSet: number[][] = [];

        /**
         * check each direction to see if a valid set of coords exist.
         * since we can't lookup column values for rows which are undefined,
         * we will check if the row exists before checking anything else
        */

        // does a row existing 4 rows above?
        if (boardState[y - 3] !== undefined) {
          // check up and diagonals

          // check up
          if (boardState[y - 3][x] !== undefined) {
            coordSet = [];
            coordSet.push([y, x]);
            coordSet.push([y - 1, x]);
            coordSet.push([y - 2, x]);
            coordSet.push([y - 3, x]);
            vcs.push(coordSet);
          }

          // check upLeft
          if (boardState[y - 3][x - 3] !== undefined) {
            coordSet = [];
            coordSet.push([y, x]);
            coordSet.push([y - 1, x - 1]);
            coordSet.push([y - 2, x - 2]);
            coordSet.push([y - 3, x - 3]);
            vcs.push(coordSet);
          }

          // check upRight
          if (boardState[y - 3][x + 3] !== undefined) {
            coordSet = [];
            coordSet.push([y, x]);
            coordSet.push([y - 1, x + 1]);
            coordSet.push([y - 2, x + 2]);
            coordSet.push([y - 3, x + 3]);
            vcs.push(coordSet);
          }
        }

        // check left and right

        // check left
        if (boardState[y][x - 3] !== undefined) {
          coordSet = [];
          coordSet.push([y, x]);
          coordSet.push([y, x - 1]);
          coordSet.push([y, x - 2]);
          coordSet.push([y, x - 3]);
          vcs.push(coordSet);
        }

        // check right
        if (boardState[y][x + 3] !== undefined) {
          coordSet = [];
          coordSet.push([y, x]);
          coordSet.push([y, x + 1]);
          coordSet.push([y, x + 2]);
          coordSet.push([y, x + 3]);
          vcs.push(coordSet);
        }

        // console.log("Valid coord sets populated:", vcs)
        return vcs;
      }
    }

  }
}

export default Game;
