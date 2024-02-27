import db from "../db";
import { QueryResult } from "pg";

import {
  BoardCellFinalStateInterface,
  Game,
  GameInterface,
  InitializedBoardType,
  NewGameInterface
 } from "./game";

 import { PlayerInterface, NewPlayerInterface, Player } from "./player";

/**
 * Factory function for creating a new Game and setting it's state
 * Accepts an initial state as a matrix representing desired game state
 * Returns the newly created Game instance
 */
async function createGameWithBoardState(
    boardState: InitializedBoardType,
    currPlayerId: string
  ): Promise<GameInterface> {

  console.log("createGameWithBoardState factory function called");
  _validateBoardState();

  const boardDimensions = {
    height: boardState.length,
    width: boardState[0].length
  }

  // populate placedPieces based on boardState
  const placedPieces : number[][] = [];
  for (let y = 0; y < boardState.length; y++) {
    for (let x = 0; x < boardState[y].length; x++) {
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
                RETURNING
                  id,
                  height,
                  width,
                  game_state as "gameState",
                  placed_pieces as "placedPieces",
                  board,
                  winning_set as "winningSet",
                  curr_player_id as "currPlayerId",
                  created_on as "createdOn"
                  `, [
      boardDimensions.height,
      boardDimensions.width,
      gameState.state,
      placedPieces,
      boardState,
      gameState.winningSet,
      currPlayerId
    ],
  );
  console.log("SQL result from attempting to create a game:", result);

  const game = result.rows[0];

  return game;

  function _validateBoardState() {
    for (let row of boardState) {
      const allNotUndefined = row.every(c => c.playerId !== undefined );
      if (!allNotUndefined) {
        throw new Error("Invalid initial board state. Some playerId values were undefined.")
      }
    }
  }

}

/**
 * Factory function for creating one or more random players
 * Accepts an optional count for numbers of players to create (default 1)
 * Returns an array of player objects which have been created (PlayerInterface)
*/
async function createPlayers(count : number) : Promise<PlayerInterface[]> {
  const players : PlayerInterface[] = [];
  let counter = 1;
  while (counter <= count) {
    const playerData : NewPlayerInterface = {
      name: generateRandomName(),
      color: generateRandomHexColor(),
      ai: false
    }
    const player = await Player.create(playerData);
    players.push(player);
  }
  return players;
}

/** Generates a random hex color (for use in creating players) */
function generateRandomHexColor() : string {
  const red = Math.floor(Math.random() * 256);
  const green = Math.floor(Math.random() * 256);
  const blue = Math.floor(Math.random() * 256);

  const hexColor = `#
    ${red.toString(16).padStart(2, '0')}
    ${green.toString(16).padStart(2, '0')}
    ${blue.toString(16).padStart(2, '0')}
  `;

  return hexColor;
}

/** Generates a random all-caps string for use as a name
 * Accepts a number for the length of the string (defaults to 6)
 */
function generateRandomName(length : number = 6) : string {
  let name = '';
  let char = 1;
  while (char <= length) {
    name += String.fromCharCode(Math.floor(Math.random() * 26) + 65);
    char++;
  }
  return name;
}

export {
  createGameWithBoardState,
  createPlayers
}