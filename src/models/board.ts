import { SQLQueries } from "../utilities/sqlQueries";
import { CountResultInterface } from "../utilities/commonInterfaces";
import { v4 as uuidv4 } from "uuid";

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

    console.log("attempting to create new board");

    const result: QueryResult<BoardInterface> = await db.query(`
                INSERT INTO boards (
                  data,
                  height,
                  width
                )
                VALUES (
                  $1,
                  $2,
                  $3
                )
                RETURNING
                  id,
                  data,
                  height,
                  width`, [boardData, dimensions.height, dimensions.width],
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
    console.log("Board.update() called.");

    const result: QueryResult<BoardInterface> = await db.query(`
      UPDATE boards
      SET
        data = $2,
        height = $3,
        width = $4
      WHERE id = $1
      RETURNING *
    `,[boardId, boardData, boardData.length, boardData[0].length]
    );
    const board = result.rows[0];
    return board;
  }

  /**
   * Resets (re-initializes) the board data for a given game
   */
  static async reset(boardId: string) : Promise<undefined> {
    console.log("Board.reset() called.");

    const result: QueryResult<BoardDimensionsInterface> = await db.query(`
      SELECT
        width,
        height
      FROM boards
      WHERE id = $1
    `,[boardId]);

    const boardDimensions = {
      height: result.rows[0].height,
      width: result.rows[0].width
    };

    const boardData = Board.initializeBoardData(boardDimensions);

    await db.query(`
      UPDATE boards
      SET
        data = $2,
        height = $3,
        width = $4
      WHERE id = $1
      RETURNING *
    `,[boardId, boardData, boardDimensions.height, boardDimensions.width]
    );
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

  /**
   * Initializes a new board and populates board with data to meet
   * specified end game conditions.
   * Accepts:
   * - array of playerIds to simulate turns for (required)
   * - if a winner should exist, that player's id (optional)
   * - if the game should be a tie (true / false, optional)
   * - how many turns should be taken (optional)
   * Returns an BoardDataType with valid params
   */
  // static generateBoardState(
  //   boardDimensions: BoardDimensionsInterface,
  //   playerIds: string[],
  //   winnerId?: string,
  //   tie?: boolean,
  //   turns?: number
  // ): BoardDataType {
  //   // TODO: Add support for arbitrary number of turns in random order
  //   // TODO: Implement more realistic winning board state
  //   let board = Board.initializeBoardData(boardDimensions);
  //   let currPlayerId = playerIds[0];

  //   // see if we want to create a winning state
  //   if (winnerId !== undefined) {
  //     if (!playerIds.includes(winnerId)) {
  //       throw new Error("Specified winner player ID is not part of provided list of player IDs.");
  //     }
  //     // create four in a row for the winning player ID
  //     let counter = 0;
  //     while (counter <= 3) {
  //       board[boardDimensions.height - 1][counter].playerId = winnerId;
  //       counter++;
  //     }
  //     return board;
  //   }

  //   // see if we want to create a tie
  //   if (tie) {
  //     if (playerIds.length < 2) {
  //       throw new Error("In order to create a tie there must be 2 or more players.");
  //     }

  //     for (let y = 0; y < boardDimensions.height; y++) {
  //       for (let x = 0; x < boardDimensions.width; x++) {
  //         board[y][x].playerId = playerIds[0];
  //         _cyclePlayers();
  //       }
  //     }
  //     return board;
  //   }

  //   // fail safe if no desired end-game state is specified
  //   return board;

  //   function _cyclePlayers() {
  //     const currPlayerIndex = playerIds.indexOf(currPlayerId);
  //     if (currPlayerIndex === playerIds.length - 1) {
  //       currPlayerId = playerIds[0];
  //     } else {
  //       currPlayerId = playerIds[currPlayerIndex + 1];
  //     }
  //   }
  // }

  /**
 * Updates the provided BoardDataType to have pieces played by the provided
 * player ID at the bottom row in columns 1, 2, and 3 so that a piece can be
 * placed in column 0 and trigger a win. Should only be provided a fresh board.
 */
  static async setBoardDataNearlyWon(
    boardId : string,
    winningPlayerId : string
  ) : Promise<undefined> {

    const board = await Board.get(boardId);
    const boardData = board.data;
    boardData[boardData.length - 1][1].playerId = winningPlayerId;
    boardData[boardData.length - 1][2].playerId = winningPlayerId;
    boardData[boardData.length - 1][3].playerId = winningPlayerId;
    await Board.update(boardId, boardData);
  }

  /**
   * Updates the provided BoardDataType to have only one empty slot available
   * to drop a piece at the top of column 0. Uses a random GUID to represent
   * player IDs associated with every other played piece to avoid a potential
   * win.
   */
  static async setBoardDataNearlyTied(
    boardId : string,
    playerIds: string[]
  ) : Promise<undefined> {
    const board = await Board.get(boardId);
    const boardData = board.data;

    let playerIndex : number;
    let counter = 0;
    for (let y = 0; y < boardData.length; y++) {
      playerIndex = 0;
      if (counter > 1) {
        playerIndex = 1;
        if (counter > 3) {
          playerIndex = 0;
          counter = 0;
        }
      }
      for (let col of boardData[y]) {
        playerIndex = playerIndex === 0 ? 1 : 0;
        col.playerId = playerIds[playerIndex];
      }
      counter++;
    }

    boardData[0][0].playerId = null;
    await Board.update(boardId, boardData);
  }

  /** Retrieves the matrix of playerIds representing played pieces for a given
   *  board ID in the format (playerId | null)[][] */
  static async getGamePieces(boardId: string) : Promise<(string | null)[][]> {
    const board = await Board.get(boardId);
    const boardPieces = board.data.map(r => r.map(c => c.playerId));
    return boardPieces;
  }
}

