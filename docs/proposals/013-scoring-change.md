# 013-scoring-change

## Word length

Minimum word length is 2 letters.

## Word finding directions

Words are found in **four orthogonal directions only**, up, down, left and right, from the coordinates of both swapped letters. If a letters were swapped between locations 2,4 and 7,3 then words are scanned up from 2,4, down from 2,4, left from 2,4 and right from 2,4 and up from 7,3, down from 7,3, left from 7,3 and right from 7,3.

All words that contain the location of the swapped letters are scored, meaning if there is one word vertical to the swapped letters, it is scored, and another word horizontal to the swapped letters, it is also scored. Also if there are two vertical words found in different directions, i.e. one up and one down, they are both scored.

## Scoring precedence within round by time of move

Scoring precedence within each round is that the first player to make a move has precedence 1, second player to make a move has precedence 2 and so on. All words found by player 1 are scored first, then all words found by player 2 and so on. Words found by player 1 are frozen immedeately as if they were scored in a previous round, meaning when player 2 make their move, words found are treated as if they were found in a board with frozen tiles from a previous round.

## Duplicate words are allowed

Duplicate words are allowed, no checks for duplicates. What constitutes a scored unique word is its coordinate set, i.e. the set of coordinates that the word occupies on the board. So if the same word is located is found in the board with different coordinates it should be scored a s new word.
