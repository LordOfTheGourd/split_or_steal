// components/GameResultModal.js
import React from "react";
import { Dialog, Transition } from "@headlessui/react";

export interface Result {
  playerChoice: string;
  waiting?: boolean;
  opponentChoice: string;
  stakeAmount: number;
  outcomeAmount: number;
  splitBonus?: number;
  timeout: number;
  error?: string;
  transactionHash?: string;
}

interface GameResultModalProps {
  result: Result;
  onClose: () => void;
}

function GameResultModal({ result, onClose }: GameResultModalProps) {
  //   useEffect(() => {
  //     const timeoutId = setTimeout(onClose, result.timeout); // Auto dismiss after result.timeout milliseconds
  //     return () => clearTimeout(timeoutId);
  //   }, [onClose, result.timeout]);

  //   useEffect(() => {
  //     const handleKeyDown = (e: { key: string }) => {
  //       if (e.key === "Escape" && !result.waiting) {
  //         onClose();
  //       }
  //     };
  //     document.addEventListener("keydown", handleKeyDown);
  //     return () => document.removeEventListener("keydown", handleKeyDown);
  //   }, [onClose, result.waiting]);
  const getEmoji = (
    playerChoice: string,
    opponentChoice: string,
    splitBonus?: number
  ) => {
    if (splitBonus && splitBonus > 0) {
      return "🎉";
    } else if (playerChoice === "steal" && opponentChoice === "split") {
      return "😏";
    } else if (playerChoice === "steal" && opponentChoice === "steal") {
      return "😠";
    } else if (playerChoice === "split" && opponentChoice === "split") {
      return "😊";
    } else if (playerChoice === "split" && opponentChoice === "steal") {
      return "😢";
    }
    return "";
  };

  const playerEmoji = result.playerChoice === "split" ? "😇" : "😈";
  const opponentEmoji = result.waiting ? (
    <svg
      className="w-4 h-4 text-gray-300 animate-spin"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
    >
      <path
        d="M32 3C35.8083 3 39.5794 3.75011 43.0978 5.20749C46.6163 6.66488 49.8132 8.80101 52.5061 11.4939C55.199 14.1868 57.3351 17.3837 58.7925 20.9022C60.2499 24.4206 61 28.1917 61 32C61 35.8083 60.2499 39.5794 58.7925 43.0978C57.3351 46.6163 55.199 49.8132 52.5061 52.5061C49.8132 55.199 46.6163 57.3351 43.0978 58.7925C39.5794 60.2499 35.8083 61 32 61C28.1917 61 24.4206 60.2499 20.9022 58.7925C17.3837 57.3351 14.1868 55.199 11.4939 52.5061C8.801 49.8132 6.66487 46.6163 5.20749 43.0978C3.7501 39.5794 3 35.8083 3 32C3 28.1917 3.75011 24.4206 5.2075 20.9022C6.66489 17.3837 8.80101 14.1868 11.4939 11.4939C14.1868 8.80099 17.3838 6.66487 20.9022 5.20749C24.4206 3.7501 28.1917 3 32 3L32 3Z"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>
      <path
        d="M32 3C36.5778 3 41.0906 4.08374 45.1692 6.16256C49.2477 8.24138 52.7762 11.2562 55.466 14.9605C58.1558 18.6647 59.9304 22.9531 60.6448 27.4748C61.3591 31.9965 60.9928 36.6232 59.5759 40.9762"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-gray-900"
      ></path>
    </svg>
  ) : result.error ? (
    "❓"
  ) : result.opponentChoice === "split" ? (
    "😇"
  ) : (
    "😈"
  );

  const outcomeText = result.error
    ? result.error
    : result.waiting
    ? ""
    : result.outcomeAmount < 0
    ? `You lost ${Math.abs(result.outcomeAmount)} tokens`
    : result.outcomeAmount > 0
    ? `You won ${result.outcomeAmount + result.stakeAmount} tokens`
    : "You got nothing";

  const emoji = getEmoji(
    result.playerChoice,
    result.opponentChoice,
    result.splitBonus
  );

  return (
    <Transition appear show as={React.Fragment}>
      <Dialog
        as="div"
        className="relative z-10"
        onClose={result.waiting ? () => {} : onClose}
      >
        <Transition.Child
          as={React.Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-visible rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all relative">
                {/* <Transition
                  show={emoji !== ""}
                  enter="ease-out duration-300 transition-all"
                  enterFrom="opacity-0 scale-95 translate-y-80"
                  enterTo="opacity-100 scale-100 translate-y-0"
                >
                  <div className="text-[82px] absolute top-0 right-0 pr-2 animate-bounce z-50">
                    {emoji}
                  </div>
                </Transition> */}
                <div
                  className={`text-[82px] absolute top-0 right-0 pr-2 z-50 transform transition-all duration-300 ${
                    emoji
                      ? "opacity-100 scale-100 translate-y-0 animate-bounce"
                      : "opacity-0 scale-95 translate-y-80"
                  }`}
                >
                  {emoji}
                </div>

                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900"
                ></Dialog.Title>
                <div className="text-center">
                  <div
                    className={`text-lg text-gray-700 font-bold transition-transform duration-300 ${
                      emoji !== "" ? "translate-x-[-0px]" : "translate-x-0"
                    }`}
                  >
                    <p>
                      You played: {result.playerChoice} {playerEmoji}
                    </p>
                  </div>
                  <div
                    className={`text-lg text-gray-700 font-bold flex items-center justify-center gap-1 transition-transform duration-700 ${
                      emoji !== ""
                        ? result.playerChoice === "split"
                          ? result.opponentChoice === "split"
                            ? "translate-x-[-27px]"
                            : "translate-x-[-25px]"
                          : result.opponentChoice === "split"
                          ? "translate-x-[-30px]"
                          : "translate-x-[-28px]"
                        : "translate-x-0"
                    }`}
                  >
                    <div>Opponent played: {result.opponentChoice}</div>
                    <div>{opponentEmoji}</div>
                  </div>
                  <div className="flex justify-center">
                    <div
                      className={
                        `text-lg font-bold rounded px-2 ` +
                        (result.outcomeAmount > 0
                          ? "text-nice-800 bg-nice-100"
                          : "text-naughty-800 bg-naughty-100")
                        //   : result.outcomeAmount > 0
                        //   : "hidden")
                      }
                    >
                      {result.splitBonus ? (
                        <div className="text-lg font-bold rounded px-2 text-nice-800 bg-nice-100">
                          <div className="flex items-center">
                            🎉 Split Bonus Alert! 🎉
                          </div>
                          <div className="flex items-center">
                            You won{" "}
                            {result.stakeAmount +
                              result.outcomeAmount +
                              result.splitBonus}{" "}
                            tokens!
                          </div>
                        </div>
                      ) : (
                        outcomeText
                      )}
                    </div>
                  </div>

                  {result.transactionHash && (
                    <p className="text-lg text-gray-700">
                      Transaction:{" "}
                      <a
                        href={`https://solscan.io/tx/${result.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        Click here to see transaction
                      </a>
                    </p>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

export default GameResultModal;
