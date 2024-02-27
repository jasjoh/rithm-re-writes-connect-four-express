import db from "../db";
import { QueryResult } from "pg";

import {
  Game,
  GameInterface,
  InitializedBoardType
 } from "./game";

/**
 * Factory function for creating a new Game and setting it's state
 * Accepts an initial state as a matrix representing desired game state
 * Returns the newly created Game instance
 */
async function createGameWithBoardState(
    boardState: InitializedBoardType,
    currPlayerId: string
  ): Promise<GameInterface> {

  _validateBoardState();

  const boardDimensions = {
    height: boardState.length,
    width: boardState[0].length
  }

  // populate placedPieces based on boardState
  const placedPieces : number[][] = [];
  for (let y = 0; y < boardState.length; y++) {
    for (let x = 0; x < boardState[y].length; y++) {
      if (boardState[y][x].playerId !== null) {
        placedPieces.push([y, x]);
      }
    }
  }

  // determine game state
  const gameState = Game.checkForGameEnd({board: boardState, placedPieces: placedPieces});

  // create game in DB
  const result: QueryResult<GameInterface> = await db.query(`
                INSERT INTO games (
                                    height,
                                    width,
                                    game_state,
                                    placed_pieces,
                                    board,
                                    winning_set,
                                    curr_player_id
                                  )
                VALUES  (
                          $1, $2, $3, $4, $5, $6, $7
                        )
                RETURNING *`, [
      boardDimensions.height,
      boardDimensions.width,
      gameState.state,
      placedPieces,
      boardState,
      gameState.winningSet,
      currPlayerId
    ],
  );

  const game = result.rows[0];

  return game;

  function _validateBoardState() {
    for (let row of boardState) {
      if (!row.every(c => { c.playerId !== undefined })) {
        throw new Error("Invalid initial board state. Is not of type InitialBoardType.")
      }
    }
  }

}

export {
  createGameWithBoardState
}