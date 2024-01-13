import { ExpressError, NotFoundError, BadRequestError } from "../expressError";

import db from "../db";
import { PlayerInterface } from "./player";

// const { sqlForPartialUpdate } = require("../helpers/sql");

interface NewGameInterface {
  height: number;
  width: number;
}

class Game {
  /**
   * Instantiates a new game based on params and returns it.
   *
   * Params are optional, but should be { height, width }
   *
   * Returns { ... game object ... }
   * */

  static async create(newGame: NewGameInterface = { height: 7, width: 6}) {

    const board = Game.initializeNewBoard(newGame.height, newGame.width);

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
          newGame.height,
          newGame.width,
          board
        ],
    );

    const game = result.rows[0];
    console.log("TO BE TYPED: result.rows[0] in Game.create");

    return game;
  }

  /**
   * Retrieves an array of all games with summary information
   * Returns [{ id, gameState, createdOn }, ...]   *
   * */

  static async getAll() {

    const result = await db.query(`
        SELECT
          id,
          game_state AS "gameState",
          created_on AS "createdOn"
        FROM games
        ORDER BY created_on`
    );

    console.log("TO BE TYPED: result in Game.getAll");
    return result.rows;
  }

  /**
   * Given a game id, return data about game.
   *
   * Returns { ... game object ... }
   *
   * Throws NotFoundError if not found.
   **/

  static async get(id: string) {
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

  static async delete(id:string) {
    const result = await db.query(`
        DELETE
        FROM games
        WHERE id = $1
        RETURNING id`, [id]);
    const game = result.rows[0];

    if (!game) throw new NotFoundError(`No game: ${id}`);
  }

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

export default Game;
