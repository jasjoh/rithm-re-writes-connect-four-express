import db from "../db";
import { QueryResult } from "pg";

import {
  BoardCellFinalStateInterface,
  Game,
  GameInterface,
  GameUpdateInterface,
  BoardDimensionsInterface
 } from "./game";
 import { BoardDataType } from "./game";

 import { generateRandomHexColor, generateRandomName } from "../utilities/utils";

 import { PlayerInterface, NewPlayerInterface, Player } from "./player";
import { Board } from "./board";

/**
 * Factory function for creating a new Game and setting its state
 * Accepts an initial state as a matrix representing desired game state
 * Returns the newly created Game instance
 */
async function createGameWithBoardState(
    boardData: BoardDataType,
    currPlayerId: string
  ): Promise<GameInterface> {

  console.log("createGameWithBoardState factory function called");
  _validBoardData();

  const boardDimensions = {
    height: boardData.length,
    width: boardData[0].length
  }

  // populate placedPieces based on boardData
  const placedPieces : number[][] = [];
  for (let y = 0; y < boardData.length; y++) {
    for (let x = 0; x < boardData[y].length; x++) {
      if (boardData[y][x].playerId !== null) {
        placedPieces.push([y, x]);
      }
    }
  }

  let board = await Board.create(boardDimensions);
  board = await Board.update(board.id, boardData);

  let game = await Game.createWithBoard(board.id);
  // game = await Game.update()

  // determine game state
  // const gameState = Game.checkForGameEnd(gameToInsert);

  // update game in DB

  // console.log("SQL result from attempting to create a game:", result);

  return game;

  function _validBoardData() {
    for (let row of boardData) {
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
async function createPlayers(count : number = 1) : Promise<PlayerInterface[]> {
  console.log("createPlayers factory function called");
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
    counter++;
  }
  return players;
}

export {
  createGameWithBoardState,
  createPlayers
}