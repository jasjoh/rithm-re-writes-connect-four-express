import { SQLQueries } from "../utilities/sqlQueries";
import { CountResultInterface } from "../utilities/commonInterfaces";

import db from "../db";
import { PlayerInterface } from "./player";
import { QueryResult } from "pg";

// a board cell can be null if uninitialized or in a final state if initialized
type BoardCellInitialStateType = BoardCellFinalStateInterface | null;

// an initialized board cell has this interface
export interface BoardCellFinalStateInterface {
  playerId: string | null;
  validCoordSets: number[][][];
}

export type BoardDataType = BoardCellFinalStateInterface[][];

// an initialized board full of finalized board cells
export type BoardInterface = {
  id : string;
  data : BoardCellFinalStateInterface[][];
  width : number;
  height : number;
}

export interface BoardDimensionsInterface {
  height: number;
  width: number;
}

export class Board {

  /**
   * Creates and initializes a new board with the specified dimensions
   * If no dimensions are provided, default dimensions are used (7 x 6)
   * Returns the created (and initialized) board (BoardInterface)
   * */
  static async create(
    dimensions : BoardDimensionsInterface = { height: 7, width: 6 }
  ) : Promise<BoardInterface> {

    const boardData = this.initializeBoardData(dimensions);

    const result: QueryResult<BoardInterface> = await db.query(`
                INSERT INTO boards (
                  data
                )
                VALUES (
                  $1
                )
                RETURNING
                  id,
                  data,
                  height,
                  width`, [boardData],
    );

    const board = result.rows[0];

    return board;
  }

  /**
   * Given a board ID, returns the associated board (BoardInterface)
   **/
  static async get(boardId: string) : Promise<BoardInterface> {
    const result: QueryResult<BoardInterface> = await db.query(`
        SELECT
          id,
          data,
          width,
          height
        FROM boards
        WHERE id = $1
    `, [boardId]);

    const board = result.rows[0];
    // console.log("board found:", board);

    if (!board) throw new Error(`No board with id: ${boardId}`);

    return board;
  }

  /**
   * Updates (and overwrites) the board data with the provided data (BoardDataType)
   */
  static async update(boardId: string, boardData: BoardDataType) : Promise<BoardInterface> {
    const result: QueryResult<BoardInterface> = await db.query(`
      UPDATE boards
      SET
        board = $2
      WHERE id = $1
      RETURNING *
    `,[boardId, boardData]
    );
    const board = result.rows[0];
    return board;
  }

  /**
   * Delete given board from database
   **/
  static async delete(boardId: string) {
    const result: QueryResult<BoardInterface> = await db.query(`
        DELETE
        FROM boards
        WHERE id = $1
        RETURNING id`, [boardId]);
    const board = result.rows[0];

    if (!board) throw new Error(`No board: ${boardId}`);
  }

  /** Creates an initialized game board (full of cells in a final state)
   * Accepts dimensions for the board as a BoardDimensionsInterface
   * Returns the newly initialized boards as an BoardDataType
   */
  private static initializeBoardData(dimensions : BoardDimensionsInterface) : BoardDataType {

    const newBoardState: BoardCellInitialStateType[][] = [];

    _initializeMatrix();
    _populateBoardSpaces();

    return newBoardState as BoardDataType;

    /** Initializes the valid boundaries of the board */
    function _initializeMatrix() {
      // console.log("_initializeMatrix() called.");
      for (let y = 0; y < dimensions.height; y++) {
        const row = [];
        for (let x = 0; x < dimensions.width; x++) {
          row.push(null);
        }
        newBoardState.push(row);
      }
      // console.log("Matrix initialized.")
    }

    function _populateBoardSpaces() {
      // console.log("_populateBoardSpaces() called.")
      for (let y = 0; y < dimensions.height; y++) {
        for (let x = 0; x < dimensions.width; x++) {
          // console.log("attempting to set game board for xy:", y, x);
          newBoardState[y][x] = {
            playerId: null,
            validCoordSets: _populateValidCoordSets(y, x)
          };
        }
      }

      // console.log("Board spaces populated:", newBoardState);

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
        if (newBoardState[y - 3] !== undefined) {
          // check up and diagonals

          // check up
          if (newBoardState[y - 3][x] !== undefined) {
            coordSet = [];
            coordSet.push([y, x]);
            coordSet.push([y - 1, x]);
            coordSet.push([y - 2, x]);
            coordSet.push([y - 3, x]);
            vcs.push(coordSet);
          }

          // check upLeft
          if (newBoardState[y - 3][x - 3] !== undefined) {
            coordSet = [];
            coordSet.push([y, x]);
            coordSet.push([y - 1, x - 1]);
            coordSet.push([y - 2, x - 2]);
            coordSet.push([y - 3, x - 3]);
            vcs.push(coordSet);
          }

          // check upRight
          if (newBoardState[y - 3][x + 3] !== undefined) {
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
        if (newBoardState[y][x - 3] !== undefined) {
          coordSet = [];
          coordSet.push([y, x]);
          coordSet.push([y, x - 1]);
          coordSet.push([y, x - 2]);
          coordSet.push([y, x - 3]);
          vcs.push(coordSet);
        }

        // check right
        if (newBoardState[y][x + 3] !== undefined) {
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

