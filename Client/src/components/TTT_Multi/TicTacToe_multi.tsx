import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import styled from "styled-components";
import {
  PLAYER_X,
  PLAYER_O,
  SQUARE_DIMS,
  DRAW,
  GAME_STATES,
  DIMENSIONS,
} from "./constants";
import Board from "./Board";
import { switchPlayer } from "./utils";
import { ResultModal } from "./ResultModal";
import { border } from "./styles";
import gameOverSoundAsset from "../../assets/sounds/game_over.wav";
import clickSoundAsset from "../../assets/sounds/click.wav";
import boardImage from "../../assets/Images/board.png";

// Define the shape of userInfo based on your API response
interface UserInfo {
  game_played: number;
  wins: number;
  losses: number;
  draws: number;
  // Add other fields as necessary
}

// Define the type for error
type ErrorType = string | null;

const gameOverSound = new Audio(gameOverSoundAsset);
gameOverSound.volume = 0.2;
const clickSound = new Audio(clickSoundAsset);
clickSound.volume = 0.5;

const arr = new Array(DIMENSIONS ** 2).fill(null);
const board = new Board();

interface Props {
  squares?: Array<number | null>;
}
interface GameData {
  player: number;
  game_id: string;
}

interface MoveMessage {
  index: number;
  player: number;
}

const TicTacToe_multi = ({ squares = arr }: Props) => {
  const [players, setPlayers] = useState<Record<string, number | null>>({
    human: null,
    ai: null,
  });
  const navigate = useNavigate();
  const [gameState, setGameState] = useState(GAME_STATES.notStarted);
  const [grid, setGrid] = useState(squares);
  const [winner, setWinner] = useState<string | null>(null);
  const [nextMove, setNextMove] = useState<null | number>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [socket, setSocket] = useState<ReturnType<typeof io> | null>(null);
  const [gameid, setGameid] = useState<string | null>(null);

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [error, setError] = useState<ErrorType>(null);
  console.log(error || "NO errors");
  useEffect(() => {
    // Fetch user profile when the component mounts
    const fetchUserProfile = async () => {
      try {
        const response = await fetch("/api/user/profile", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            // Add other headers if needed, e.g., Authorization
          },
          credentials: "include", // Include credentials if your session management requires it
        });

        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const data = await response.json();
        setUserInfo(data);
        console.log(data);
      } catch (error) {
        if (error instanceof Error) {
          setError(error.message);
          console.log(error.message);
        } else {
          setError("An unknown error occurred");
          console.log("An unknown error occurred");
        }
      }
    };

    fetchUserProfile();
  }, []);

  useEffect(() => {
    const newSocket = io("/", {
      withCredentials: true, // Required for cross-origin socket events
    });

    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Socket connection established.");
      console.log("Socket ID:", newSocket.id); // Now socket.id should be defined
    });
    console.log("Socket connection established."); // printed twice use effect is fucked lamo fix it
    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (socket) {
      socket.emit("join_queue");
      console.log("joined queue waiting.....");
      console.log(socket.id);

      // socket.on('game_id', (data) => {
      //   console.log('GAME_ID', data);
      //   setGameid(data);
      // });

      socket.on("start_game", (data: GameData) => {
        console.log("Starting game.....", data);
        setPlayers({ human: data.player, ai: data.player === 1 ? 2 : 1 });
        setGameState(GAME_STATES.inProgress);
        console.log("STATTEEEEEE", gameState, GAME_STATES.inProgress); // see this line in console i set it to started but it's not started lol
        setNextMove(PLAYER_X);
        setGameid(data.game_id);
      });

      socket.on("move", (msg: MoveMessage) => {
        console.log("SOCKET", msg.index, msg, msg.player === 1 ? 2 : 1);
        move(msg.index, msg.player);
        setNextMove(msg.player === 1 ? 2 : 1);
      });

      console.log("Event listeners set up.");

      return () => {
        socket.off("start_game");
        socket.off("move");
      };
    }
  }, [socket]);

  /**
   * On every move, check if there is a winner. If yes, set game state to over and open result modal
   */
  useEffect(() => {
    const boardWinner = board.getWinner(grid);

    const declareWinner = (winner: number) => {
      let winnerStr;
      switch (winner) {
        case PLAYER_X:
          winnerStr = "Player X wins!";
          break;
        case PLAYER_O:
          winnerStr = "Player O wins!";
          break;
        case DRAW:
        default:
          winnerStr = "It's a draw";
      }
      setGameState(GAME_STATES.over);
      setWinner(winnerStr);
      // Slight delay for the modal so there is some time to see the last move
      setTimeout(() => setModalOpen(true), 300);
    };

    if (boardWinner !== null && gameState !== GAME_STATES.over) {
      declareWinner(boardWinner);
    }
  }, [gameState, grid, nextMove]);

  /**
   * Set the grid square with respective player that made the move. Only make a move when the game is in progress.
   * useCallback is necessary to prevent unnecessary recreation of the function, unless gameState changes, since it is
   * being tracked in useEffect
   * @type {Function}
   */
  const move = useCallback(
    (index: number, player: number | null) => {
      console.log("MOVE", index, player, gameState);
      if (player !== null || gameState === GAME_STATES.inProgress) {
        // changed to or to disable states check
        console.log("MOVE_VALIDDDDD", index, player);
        setGrid((grid) => {
          const gridCopy = grid.concat();
          gridCopy[index] = player;
          return gridCopy;
        });
      }
    },
    [gameState]
  );

  // useEffect(() => {
  //   if (socket) {
  //     const handleBackendAI = (msg: any) => {
  //       console.log('SOCKET', msg.index, msg);

  //       const index = msg.index;

  //       if (index !== null && !grid[index]) {
  //         if (players.ai !== null) {
  //           move(index, players.ai);
  //         }
  //         setNextMove(players.human);
  //       }
  //     };

  //     socket.on('backendAI', handleBackendAI);

  //     return () => {
  //       socket.off('backendAI', handleBackendAI);
  //     };
  //   }
  // }, [socket, grid, players.ai, players.human, move]);
  /**
   * Make AI move when it's AI's turn
   */
  // useEffect(() => {
  //   if (
  //     nextMove !== null &&
  //     nextMove === players.ai &&
  //     gameState !== GAME_STATES.over
  //   ) {
  //     // AI move will trigger socket move
  //     // No need to call socketMove here; it's handled in the useEffect above
  //   }
  // }, [nextMove, players.ai, gameState]);

  const humanMove = (index: number) => {
    if (!grid[index] && nextMove === players.human) {
      move(index, players.human);
      setNextMove(players.ai);
      console.log("HUMAN", index); // SEND TO SOCKETS // 1 is X,  0 is O
      const data = {
        player: players.human,
        index: index,
        game_id: gameid,
      };
      if (socket) {
        socket.emit("humanMove", data);
      }
    }
  };

  const choosePlayer = (option: number) => {
    setPlayers({ human: option, ai: switchPlayer(option) });
    setGameState(GAME_STATES.inProgress);
    setNextMove(PLAYER_X);
  };

  const startNewGame = () => {
    setGameState(GAME_STATES.notStarted);
    setGrid(arr);
    setModalOpen(false);
  };

  useEffect(() => {
    if (nextMove !== null) {
      clickSound.play();
    }
  }, [nextMove]);

  useEffect(() => {
    if (gameState !== GAME_STATES.inProgress) {
      gameOverSound.play();
    }
  }, [gameState]);

  const handleClose = () => {
    setModalOpen(false);
    navigate("/");
  };

  return gameState === GAME_STATES.notStarted ? (
    <div className="text-white font-newrocker">
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-lg font-semibold">Choose your player</p>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => choosePlayer(PLAYER_X)}
              className="bg-blue-500 text-white px-6 py-2 rounded-md font-bold hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              X
            </button>
            <p className="text-lg font-semibold">or</p>
            <button
              onClick={() => choosePlayer(PLAYER_O)}
              className="bg-red-500 text-white px-6 py-2 rounded-md font-bold hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              O
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : (
    <>
      {userInfo ? (
        <div className="flex justify-center items-center w-screen">
          <div className="absolute top-[2%] w-[35%] md:w-[70%] py-4 px-10 text-center grid grid-cols-2 gap-4 items-center justify-around bg-slate-700 rounded-md">
            <p className="font-bold text-white text-xl">
              Games Played: {userInfo.game_played}
            </p>
            <p className="font-bold text-white text-xl">
              Wins: {userInfo.wins}
            </p>
            <p className="font-bold text-white text-xl">
              Losses: {userInfo.losses}
            </p>
            <p className="font-bold text-white text-xl">
              Draws: {userInfo.draws}
            </p>
          </div>
        </div>
      ) : (
        <p>Loading user information...</p>
      )}
      <Container dims={DIMENSIONS}>
        {grid.map((value, index) => {
          const isActive = value !== null;

          return (
            <Square
              data-testid={`square_${index}`}
              key={index}
              onClick={() => humanMove(index)}
            >
              {isActive && <Marker>{value === PLAYER_X ? "X" : "O"}</Marker>}
            </Square>
          );
        })}
        <Strikethrough
          styles={
            gameState === GAME_STATES.over ? board.getStrikethroughStyles() : ""
          }
        />
        <ResultModal
          isOpen={modalOpen}
          winner={winner}
          close={handleClose}
          startNewGame={startNewGame}
        />
      </Container>
    </>
  );
};

const Container = styled.div<{ dims: number }>`
  display: flex;
  justify-content: center;
  width: ${({ dims }) => `${dims * (SQUARE_DIMS + 5)}px`};
  flex-flow: wrap;
  position: relative;
  font-family: "WoodCarving", sans-serif; /* Apply the font here */
  font-weight: bold;
  color: white;
  background-image: url(${boardImage});
  background-size: cover; /* Adjust based on your desired look */
  background-repeat: no-repeat;
  filter: brightness(0) invert(1);
  transform: scale(1.5);

  /* Media query for mobile screens */
  @media (max-width: 768px) {
    transform: scale(1);
  }
`;

const Square = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: ${SQUARE_DIMS}px;
  height: ${SQUARE_DIMS}px;
  ${border};

  &:hover {
    cursor: pointer;
  }
`;

Square.displayName = "Square";

const Marker = styled.p`
  font-size: 68px;
`;

const Strikethrough = styled.div<{ styles: string | null }>`
  position: absolute;
  ${({ styles }) => styles}
  background-color: indianred;
  height: 5px;
  width: ${({ styles }) => !styles && "0px"};
`;

export default TicTacToe_multi;
