"use strict";

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");
// const { sqlForPartialUpdate } = require("../helpers/sql");

/** Related functions for games. */

class Game {
  /**
   * Instantiates a new game based on params and returns it.
   *
   * Params are optional, but should be { height, width }
   *
   * Returns { ... game object ... }
   * */

  static async create({ height = 7, width = 6 }) {

    const board = Game.initializeNewBoard(height, width);

    const result = await db.query(`
                INSERT INTO games (
                                    height,
                                    width,
                                    board
                                  )
                VALUES  (
                          $1,
                          $2,
                          $3
                        )
                RETURNING
                    id,
                    height,
                    width,
                    board,
                    game_state AS "gameState",
                    created_on AS "createdOn"`, [
          height,
          width,
          board
        ],
    );

    const game = result.rows[0];

    return game;
  }

  /**
   * Find all games
   * Returns [{ id, name, color, ai, createdOn }, ...]   *
   * */

  static async getAll() {

    const result = await db.query(`
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
        ORDER BY created_on`);

    return result.rows;
  }

  /**
   * Given a game id, return data about game.
   *
   * Returns { id, name, color, ai, createdOn }
   *
   * Throws NotFoundError if not found.
   **/

  static async get(id) {
    const result = await db.query(`
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
        ORDER BY created_on`, [id]);

    const game = result.rows[0];

    if (!game) throw new NotFoundError(`No game with id: ${id}`);

    return game;
  }

  /**
   * Delete given game from database; returns undefined.
   *
   * Throws NotFoundError if game not found.
   **/

  static async delete(id) {
    const result = await db.query(`
        DELETE
        FROM games
        WHERE id = $1
        RETURNING id`, [id]);
    const game = result.rows[0];

    if (!game) throw new NotFoundError(`No game: ${id}`);
  }

  static initializeNewBoard(height, width) {

    const boardState = [];

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
      function _populateValidCoordSets(y, x) {
        // console.log("_populateValidCoordSets called with yx:", y, x);
        const vcs = [];
        let coordSet = [];

        /**
         * check each direction to see if a valid set of coords exist.
         * since we can't lookup column values for rows which are undefined,
         * we will check if the row exists before checking anything else
        */

        // does a row existing 4 rows above?
        if (boardState[y-3] !== undefined) {
          // check up and diagonals

          // check up
          if (boardState[y-3][x] !== undefined) {
            coordSet = [];
            coordSet.push([y, x]);
            coordSet.push([y-1, x]);
            coordSet.push([y-2, x]);
            coordSet.push([y-3, x]);
            vcs.push(coordSet);
          }

          // check upLeft
          if (boardState[y-3][x-3] !== undefined) {
            coordSet = [];
            coordSet.push([y, x]);
            coordSet.push([y-1, x-1]);
            coordSet.push([y-2, x-2]);
            coordSet.push([y-3, x-3]);
            vcs.push(coordSet);
          }

          // check upRight
          if (boardState[y-3][x+3] !== undefined) {
            coordSet = [];
            coordSet.push([y, x]);
            coordSet.push([y-1, x+1]);
            coordSet.push([y-2, x+2]);
            coordSet.push([y-3, x+3]);
            vcs.push(coordSet);
          }
        }

        // check left and right

        // check left
        if (boardState[y][x-3] !== undefined) {
          coordSet = [];
          coordSet.push([y, x]);
          coordSet.push([y, x-1]);
          coordSet.push([y, x-2]);
          coordSet.push([y, x-3]);
          vcs.push(coordSet);
        }

        // check right
        if (boardState[y][x+3] !== undefined) {
          coordSet = [];
          coordSet.push([y, x]);
          coordSet.push([y, x+1]);
          coordSet.push([y, x+2]);
          coordSet.push([y, x+3]);
          vcs.push(coordSet);
        }

        // console.log("Valid coord sets populated:", vcs)
        return vcs;
      }
    }

  }
}

module.exports = Game;
