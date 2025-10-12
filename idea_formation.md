# Wottle Idea Formation

## Game Description

- Wottle is a 2-player word game, played on a 16x16 board.
- The 16x16 grid initially filled with random letters. 
- Players take turns on switching two letters with the goal of finding words.
- The objective of the game is to find as many 3+ letter Icelandic nouns as possible

- Objective: Find as many 3+ letter words from a list of words provided by the game. 
- The word list can of different types with rules about what kind of words to find. 
- The initial first version uses a list of Icelandic nouns, but 
- The list can be changed for different game play goal, e.g. to a list of verbs in English or simply any type of list witgh theme, like words from the the script of Game of Thrones. 
### Rules: 
- Words must be in nominative case, singular, without articles 
- Gameplay: Take turns swapping two letters on an 8×8 grid
- Time Limit: 60 seconds per turn
- Game Length: 10 moves per player
- Scoring: Letter values × number of words formed in a single move

## Game Mechanics
- Grid: 16x16 board with weighted Icelandic letter distribution
- Word Validation: Uses comprehensive Icelandic dictionary
- Scoring System: Each letter has a point value, multiplied by word count
- Real-time: Instant move updates and live opponent interaction

## Playing the Game
- Enter your username on the landing page
- Wait for other players to join the lobby
- Click on a player's name to send a game invitation
- Accept/decline invitations to start playing
- Take turns swapping letters to form words
- Game ends after 10 moves each - highest score wins!

# Architecture

**Server-Side** (`ssserver.coffee`):
- Express HTTP server for static files
- Socket.IO WebSocket server for real-time communication
- Game session management and player matchmaking
- Turn-based timer system (60 seconds per turn)

**Game Logic**:
- `GameManager`: Handles multiple games and player management
- `Game`: Individual game state and turn management
- `Player`: Player data, scoring, and move validation
- `Dictionary`: Icelandic word validation and marking
- `Grid`: 8×8 letter grid with swap functionality

**Client-Side**:
- `index.html`: Login and lobby interface
- `game.html`: Main game board and UI
- `ssclient.coffee`: Game client logic and server communication
- `sslobby.coffee`: Lobby management and invitation system

### Communication Flow
```
Client ←→ Socket.IO ←→ Server
  ↓                    ↓
Login → Lobby → Invite → Game → Moves → Results → End