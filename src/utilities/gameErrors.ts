class TooFewPlayers extends Error {
  constructor (message: string) {
    super(message);
    this.name = 'TooFewPlayers'
  }
}

class PlayerAlreadyExists extends Error {
  constructor (message: string) {
    super(message);
    this.name = 'PlayerAlreadyExists'
  }
}

export { TooFewPlayers, PlayerAlreadyExists };