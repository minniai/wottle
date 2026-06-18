Improve scoring resolution visualization. 

Round and scoring resolution must be visually clearer in each round.
The current flow is as follows. When the first player makes a move in a round the following happens:

   1. Their board's tiles are greyed out. It is visually not appealing, but its purpose is to indicate to the player that they have made their move in this round and must wait for the opponent to make their move to advance to the next round.
   2. The swapped tiles are shown to both players. 
   3. The scoring resolution is activated and as soon as possible the scored words are shown to both players.
   4. Second player makes their swap.
   5. The tiles swapped by second player are shown to both players, and scoring resolution activated.
   6. The scored tiles of the second player are shown to both players.
   7. The round completes.

This is how it should be improved:
The visualization when you have made move and wait for the round to complete should be made much more visually appealing and provide better user experience. It should be shown without graying out the whole board, but rather with a visual indicator.

When a player makes a move, the swapped tiles are shown as before with animation, but they should only stay on screen for a few seconds or until the scored words are shown, such that if one of the swapped letters is not part of a scored word it should simply disappear from the board. If neither of the swapped tiles are part of a scored word both just dissapear when.

When scored tiles are shown for the current round should be shown distinctivly seperate from priviously scored tiles, so that the players see what words are scored in this round until the round is completed.


