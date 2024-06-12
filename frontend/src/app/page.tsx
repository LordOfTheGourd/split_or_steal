"use client";

import { Label, Radio, RadioGroup, Transition } from "@headlessui/react";
import clsx from "clsx";
import WalletIcon from "./walletIcon";

import { Disclosure } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/solid";
import { useCallback, useEffect, useState } from "react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWalletMultiButton } from "@solana/wallet-adapter-base-ui";
import { WalletName } from "@solana/wallet-adapter-base";
import {
  Wallet,
  useWallet,
  useAnchorWallet,
  useConnection,
} from "@solana/wallet-adapter-react";

import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

import GameResultModal from "./components/GameResultModal";
import { Result } from "./components/GameResultModal";
import Footer from "./components/Footer";
import { WTF } from "./wtf";

import { useRef } from "react";
import MintProgress from "./components/MintProgress";
import { IDL as SplitOrStealIDL } from "./web_target/split_or_steal";
import { useChoiceStore } from "./useChoiceStore";

const SPLIT_OR_STEAL_PROGRAM_ID = new PublicKey(
  "SRSPsMqHaSLJjPNKEoQbTeF6TSvospw2PXGkfj4VzhD"
);
const TOKEN_MINT = new PublicKey("SoRSy2b5sbpCXzWSB999nQFzsgVxUBaymwpNu55Y7WY");

function truncateToOneDecimalPlace(number: number) {
  return Math.trunc(number * 10) / 10;
}

export interface ChoiceState {
  choice: Choice;
  setChoice: (choice: Choice) => void;
  amount: number | undefined;
  setAmount: (amount: number | undefined) => void;
  // Put into another store later maybe?
  splitCount: number;
  setSplitCount: (count: number) => void;
  stealCount: number;
  setStealCount: (count: number) => void;
  // Could also put info about the mint progress here
  initialTokens: number;
  setInitialTokens: (tokens: number) => void;
  mintRemaining: number;
  setMintRemaining: (tokens: number) => void;
  burnedAmount: number;
  setBurnedAmount: (tokens: number) => void;
}

export default function Home() {
  const [modalVisible, setModalVisible] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const mintProgressRef = useRef<HTMLDivElement>(null);
  const [hasShownSplitCard, setHasShownSplitCard] = useState(false);

  const { publicKey } = useWallet();
  const [userKnowsWhatsUp, setUserKnowsWhatsUp] = useState(false);

  const scrollToMintProgress = () => {
    if (mintProgressRef.current) {
      mintProgressRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <>
      <WTF />
      <main className="flex min-h-screen flex-col items-center">
        <Header onMintProgressClick={scrollToMintProgress} />
        <div className="w-full max-w-sm px-4 sm:px-0 py-[5vh] sm:py-[20vh] flex-1 flex flex-col">
          {!hasShownSplitCard && (
            <div className="w-full max-w-sm flex flex-col items-center overflow-visible h-0">
              <div
                className="text-white text-center font-bold text-xl pt-4"
                style={{
                  fontFamily: "Poppins, sans-serif",
                  textShadow: "1px 1px 3px rgba(0, 0, 0, 0.2)",
                }}
              >
                Split or Steal (SORS) is an <br /> experimental, fair launch
                meme coin <br /> where you play to mint tokens
              </div>
              <div className="p-4 sm:pt-6">
                <button
                  className="font-semibold bg-white mix-blend-lighten text-black px-2 rounded-lg sm:px-3 sm:py-1 shadow-[0px_0px_0px_0px_white] hover:shadow-[0px_0px_0px_3px_white] transition-shadow"
                  onClick={() => {
                    console.log("Enter button clicked");
                    setUserKnowsWhatsUp(true);
                  }}
                >
                  Enter
                </button>
              </div>
            </div>
          )}
          <Transition
            show={userKnowsWhatsUp || publicKey !== null}
            enter="transition-opacity duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            beforeEnter={() => setHasShownSplitCard(true)}
          >
            <div className="flex flex-col gap-4 flex-1">
              <SplitCard
                setModalVisible={setModalVisible}
                setResult={setResult}
              />
              <PayoutInfo />
              {modalVisible && result && (
                <GameResultModal
                  result={result}
                  onClose={() => setModalVisible(false)}
                />
              )}
              <div ref={mintProgressRef} className="justify-self-end">
                <MintProgress />
              </div>
            </div>
          </Transition>
        </div>
        <Footer />
      </main>
    </>
  );
}

type Choice = "split" | "steal";

function Header({ onMintProgressClick }: { onMintProgressClick: () => void }) {
  const [route, setRoute] = useState("play");

  return (
    <>
      <header className="w-full bg-transparent px-4 p-2 sm:pt-4 flex items-center absolute top-0">
        {/* <nav className="flex justify-center items-center gap-2 text-white text-md sm:text-lg font-bold sm:absolute sm:left-1/2 sm:transform sm:-translate-x-1/2">
        <div
          className={clsx("underlineo", {
            underlineOn: route === "play",
          })}
        >
          <button className="p-2" onClick={() => setRoute("play")}>
            Play
          </button>
          <div className="underlineActive" />
        </div>
        <div
          className={clsx("underlineo", {
            underlineOn: route === "progress",
          })}
        >
          <button
            className="p-2 whitespace-nowrap"
            onClick={() => {
              setRoute("progress");
              onMintProgressClick();
            }}
          >
            Mint Progress
          </button>
          <div className="underlineActive" />
        </div>
        <div
          className={clsx("underlineo", {
            underlineOn: route === "faq",
          })}
        >
          <button className="p-2" onClick={() => setRoute("faq")}>
            FAQ
          </button>
          <div className="underlineActive" />
        </div>
      </nav> */}
        <div className="flex-shrink-0 ml-auto">
          <CustomConnectButton />
        </div>
      </header>
      <div className="w-full bg-transparent px-4 p-2 sm:pt-4 text-md sm:text-lg flex items-center opacity-0 pointer-events-none">
        {"paul is dead"}
      </div>
    </>
  );
}

interface SplitCardProps {
  setModalVisible: (visible: boolean) => void;
  setResult: (result: Result | null) => void;
}

function SplitCard({ setModalVisible, setResult }: SplitCardProps) {
  const wallet = useAnchorWallet();
  const publicKey = wallet?.publicKey || null;
  const { connection } = useConnection();
  const {
    choice,
    setChoice,
    setSplitCount,
    setStealCount,
    setInitialTokens,
    setMintRemaining,
    setBurnedAmount,
  } = useChoiceStore((state) => state);
  const [walletBalance, setWalletBalance] = useState(0);
  const [isMintOver, setIsMintOver] = useState(false);

  const { setVisible } = useWalletModal();
  const { buttonState, onConnect, onDisconnect, onSelectWallet } =
    useWalletMultiButton({
      onSelectWallet: () => {},
    });

  const fetchGameVaultData = useCallback(async () => {
    if (!connection) {
      console.log("Connection not available");
      return;
    }

    try {
      const programId = SPLIT_OR_STEAL_PROGRAM_ID;
      const splitOrSteal = new anchor.Program(SplitOrStealIDL, programId, {
        connection,
      });

      const [gameVaultPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("lord of the gourd")],
        programId
      );

      const gameVaultAccount = await splitOrSteal.account.gameVault.fetch(
        gameVaultPDA
      );

      const divisor = new BN(1e9); // 1e9 decimal places stored in the
      setSplitCount(gameVaultAccount.numSplits);
      setStealCount(gameVaultAccount.numSteals);
      setInitialTokens(
        Math.floor(gameVaultAccount.initialTokens.div(divisor).toNumber())
      );
      const remainingTokens = Math.floor(
        gameVaultAccount.mintRemaining.div(divisor).toNumber()
      );
      setMintRemaining(remainingTokens);
      setBurnedAmount(
        Math.floor(gameVaultAccount.burnedAmount.div(divisor).toNumber())
      );

      if (remainingTokens <= 0) {
        setIsMintOver(true);
      }
    } catch (e) {
      console.error("Error fetching game vault data:", e);
    }
  }, [
    connection,
    setSplitCount,
    setStealCount,
    setInitialTokens,
    setMintRemaining,
    setBurnedAmount,
  ]);

  const getWalletBalance = useCallback(async () => {
    if (!publicKey) {
      console.log("wallet not connected");
      return;
    }
    let sorsBalance = 0;
    try {
      // Get the associated token account for the SORS token
      const playerTokenAccountPDA = token.getAssociatedTokenAddressSync(
        TOKEN_MINT,
        publicKey
      );
      const tokenAccountBalance = await connection.getTokenAccountBalance(
        playerTokenAccountPDA
      );
      sorsBalance = truncateToOneDecimalPlace(
        tokenAccountBalance.value.uiAmount ?? 0
      );
    } catch (e) {
      console.log("Error fetching balance:", e);
    }

    setWalletBalance(sorsBalance);
  }, [connection, publicKey]);

  const callPlayGame = useCallback(async () => {
    const { choice, amount } = useChoiceStore.getState();
    if (!wallet || !publicKey) {
      console.log("Wallet not connected");
      return;
    }
    const provider = new anchor.AnchorProvider(
      connection,
      wallet,
      anchor.AnchorProvider.defaultOptions()
    );
    anchor.setProvider(provider);

    const programId = SPLIT_OR_STEAL_PROGRAM_ID;
    const splitOrSteal = new anchor.Program(
      SplitOrStealIDL,
      programId,
      provider
    );

    const stakeAmount = new BN(amount || 0);
    const choiceObj = choice === "split" ? { split: {} } : { steal: {} }; // Use the current choice

    const [gameVaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("lord of the gourd")],
      programId
    );

    const playerTokenAccountPDA = token.getAssociatedTokenAddressSync(
      TOKEN_MINT,
      publicKey
    );

    const [playerProfilePDA] = PublicKey.findProgramAddressSync(
      [publicKey.toBuffer()],
      programId
    );

    const [gameVaultTokenAccountPDA] = PublicKey.findProgramAddressSync(
      [gameVaultPDA.toBuffer()],
      programId
    );

    let txSignature: string = "";
    try {
      txSignature = await splitOrSteal.methods
        .playGame(choiceObj, stakeAmount)
        .accounts({
          player: publicKey,
          playerProfile: playerProfilePDA,
          playerTokenAccount: playerTokenAccountPDA,
          gameVault: gameVaultPDA,
          gameVaultTokenAccount: gameVaultTokenAccountPDA,
          creator: wallet.publicKey,
          mint: TOKEN_MINT,
          slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
          instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .preInstructions([
          anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: 20_000,
          }),
          anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
            units: 140_000,
          }),
        ])
        .rpc({ skipPreflight: true });
      console.log("Game played successfully");
      // Fetch the transaction logs
      const tx = await connection.getTransaction(txSignature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      //   console.log("tx", tx);

      if (tx?.meta?.logMessages) {
        const logs = tx.meta.logMessages;
        let result: Result = {
          playerChoice: choice,
          opponentChoice: "",
          stakeAmount: 0,
          outcomeAmount: 0,
          timeout: 10000,
          //   transactionHash: txSignature,
        };

        // Parse the logs to extract numeric values
        logs.forEach((log) => {
          if (log.includes("Results:")) {
            const parts = log.match(/-?\d+(\.\d+)?/g);
            if (parts) {
              const [stakeAmount, outcomeAmount, mintRemaining] =
                parts.map(Number);
              // This match happens last so we need for it not to overwrite
              // the outcome amount when split bonuses happen
              if (!result.splitBonus) {
                result.outcomeAmount = truncateToOneDecimalPlace(
                  outcomeAmount / 1e9
                );
              }
              result.stakeAmount = truncateToOneDecimalPlace(stakeAmount / 1e9);

              //   console.log("Stake Amount:", stakeAmount);
              //   console.log("Outcome Amount:", outcomeAmount);
              //   console.log("Mint Remaining:", mintRemaining);
            }
            const choices = log.match(
              /Player Choice: (\w+), Opponent Choice: (\w+)/
            );
            if (choices) {
              result.opponentChoice = choices[2].toLowerCase();
            }
          }

          if (log.includes("Got the split bonus!")) {
            const parts = log.match(/-?\d+(\.\d+)?/g);
            if (parts) {
              const [splitBonus, regularSplitValue] = parts.map(Number);
              result.splitBonus = truncateToOneDecimalPlace(splitBonus / 1e9);
              result.outcomeAmount = truncateToOneDecimalPlace(
                regularSplitValue / 1e9
              );
              //   console.log("Split Bonus:", result.splitBonus);
              //   console.log("Regular Split Value:", result.outcomeAmount);
            }
          }
        });
        setResult(result);
        setModalVisible(true);
      } else {
        console.log("No transaction logs found");
        setResult({
          playerChoice: choice,
          opponentChoice: "",
          stakeAmount: 0,
          outcomeAmount: 0,
          splitBonus: undefined,
          timeout: 10000, // Shorter timeout for no transaction logs
          error:
            "Transaction completed but no logs were found. Please try again.",
          transactionHash: txSignature,
        });
        setModalVisible(true);
      }
    } catch (err) {
      console.error("Failed to play game:", err);
      // Extract error details
      let verboseErrorMessage = "Transaction failed for unknown reason";
      if (err instanceof anchor.AnchorError) {
        const errorCode = err.error.errorCode.code || "Unknown Code";
        const errorMessage = err.error.errorMessage || "Unknown Error Message";
        const programLogs = err.logs
          ? err.logs.join("\n")
          : "No program logs available";

        verboseErrorMessage = `
          Transaction failed. Please try again.
          Error Code: ${errorCode}
          Error Message: ${errorMessage}
      `;
      }
      setResult({
        playerChoice: choice,
        opponentChoice: "",
        stakeAmount: 0,
        outcomeAmount: 0,
        splitBonus: undefined,
        timeout: 10000, // Shorter timeout for transaction error
        error: verboseErrorMessage,
      });
      setModalVisible(true);
    }

    getWalletBalance();
    fetchGameVaultData();
  }, [
    connection,
    getWalletBalance,
    fetchGameVaultData,
    publicKey,
    setModalVisible,
    setResult,
    wallet,
  ]);

  // Fetch balance when wallet connects
  useEffect(() => {
    if (buttonState === "connected") {
      getWalletBalance();
      fetchGameVaultData();
    }
    if (buttonState == "no-wallet") {
      // Not sure where to put this function so it gets called once we have an RPC connection
      fetchGameVaultData();
    }
  }, [buttonState, getWalletBalance, fetchGameVaultData]);

  const handleSubmit = useCallback(() => {
    switch (buttonState) {
      case "connected":
        setResult({
          playerChoice: choice,
          waiting: true,
          opponentChoice: "",
          stakeAmount: 0,
          outcomeAmount: 0,
          timeout: 60000,
        });
        setModalVisible(true);
        callPlayGame();
      // return onDisconnect?.();
      case "connecting":
      case "disconnecting":
        break;
      case "has-wallet":
        return onConnect?.();
      case "no-wallet":
        setVisible(true);
        return onSelectWallet?.();
        break;
    }
  }, [
    buttonState,
    setResult,
    choice,
    setModalVisible,
    callPlayGame,
    onConnect,
    setVisible,
    onSelectWallet,
  ]);

  return (
    <div className="divide-y divide-gray-200 overflow-hidden rounded-xl bg-white shadow max-w-sm w-full">
      <div className="px-4 py-5 sm:p-6 w-full gap-4 flex flex-col">
        <div>
          <RadioGroup value={choice} onChange={setChoice} className="mt-2 ">
            <div className="grid grid-cols-2 gap-4">
              <Radio
                key={"split"}
                value={"split"}
                className={({ checked }) =>
                  clsx(
                    checked
                      ? "bg-nice-600 text-white hover:bg-nice-500"
                      : "ring-1 ring-inset ring-gray-300 bg-white text-gray-900 hover:bg-nice-50",
                    "cursor-pointer flex items-center justify-center rounded-lg py-3 px-3 text-sm font-semibold uppercase sm:flex-1"
                  )
                }
              >
                <Label as="span">{"split 😇"}</Label>
              </Radio>
              <Radio
                key={"steal"}
                value={"steal"}
                className={({ checked }) =>
                  clsx(
                    checked
                      ? "bg-naughty-600 text-white hover:bg-naughty-500"
                      : "ring-1 ring-inset ring-gray-300 bg-white text-gray-900 hover:bg-naughty-50",
                    "cursor-pointer flex items-center justify-center rounded-lg py-3 px-3 text-sm font-semibold uppercase sm:flex-1"
                  )
                }
              >
                <Label as="span">{"steal 😈"}</Label>
              </Radio>
            </div>
          </RadioGroup>
        </div>
        <StakeInput walletBalance={walletBalance} />
      </div>

      <div className="px-4 py-4 sm:px-6">
        <button
          type="button"
          className={clsx(
            "w-full rounded-lg px-3.5 py-2.5 text-sm font-semibold shadow-sm",
            isMintOver
              ? "bg-gray-400 cursor-not-allowed"
              : choice === "split"
              ? "bg-nice-600 hover:bg-nice-500"
              : "bg-naughty-600 hover:bg-naughty-500",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500",
            "text-white"
          )}
          onClick={!isMintOver ? handleSubmit : undefined}
          disabled={isMintOver}
        >
          {isMintOver
            ? "Mint Over"
            : wallet === null
            ? "Connect Wallet"
            : walletBalance > 1
            ? "Play!"
            : "Play to Mint!"}
        </button>
      </div>
    </div>
  );
}

const SUGGESTED_AMOUNTS = [0, 1, 10, 50, 100];

interface StakeInputProps {
  walletBalance: number;
}

function StakeInput({ walletBalance }: StakeInputProps) {
  const [showStakeInput, setShowStakeInput] = useState(false);
  const [hasShownStakeInput, setHasShownStakeInput] = useState(false);
  const { amount, setAmount, choice } = useChoiceStore((state) => state);
  // Use useEffect to set the amount whenever walletBalance changes
  useEffect(() => {
    if (walletBalance >= 1) {
      setShowStakeInput(true);
      setHasShownStakeInput(true);
    } else if (!hasShownStakeInput) {
      setShowStakeInput(false);
    }
    if (walletBalance < (amount || 0)) {
      setAmount(Math.min(Math.floor(walletBalance), 100));
    }
  }, [walletBalance, amount, setAmount, hasShownStakeInput]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue) || parsedValue < 0) {
      setAmount(0);
    } else if (parsedValue > 100) {
      setAmount(100);
    } else {
      setAmount(parsedValue);
    }
  };

  return (
    <>
      {showStakeInput && (
        <div
          className={`transform transition-all duration-500 ease-out ${
            showStakeInput
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-95 translate-y-10"
          }`}
        >
          <div className="flex justify-between">
            <label
              htmlFor="amount"
              className="block text-sm font-medium leading-6 text-gray-900"
            >
              How much will you stake?
            </label>
            <div className="flex items-center text-gray-400 text-xs gap-1 ">
              <WalletIcon /> <div>{walletBalance} SORS</div>
            </div>
          </div>
          <div className="relative mt-2 rounded-lg shadow-sm">
            <input
              disabled={walletBalance === 0}
              type="text"
              name="amount"
              id="amount"
              className="block w-full rounded-md border-0 py-1.5 pl-7 pr-12 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-${color}-600 sm:text-sm sm:leading-6"
              placeholder="0"
              aria-describedby="price-currency"
              value={amount}
              onChange={handleInputChange}
              //   onChange={(e) =>
              //     e.target.value === ""
              //       ? setAmount(undefined)
              //       : setAmount(Math.min(Number(e.target.value), 100))
              //   }
            />
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <span className="text-gray-500 sm:text-sm" id="price-currency">
                SORS
              </span>
            </div>
          </div>
          <div>
            <RadioGroup
              value={amount ?? 0}
              onChange={setAmount}
              className="mt-2"
            >
              <div className="grid grid-cols-5 gap-3">
                {SUGGESTED_AMOUNTS.map((option) => (
                  <Radio
                    key={option}
                    value={option}
                    className={({ checked }) =>
                      clsx(
                        walletBalance >= option
                          ? "cursor-pointer focus:outline-none"
                          : "cursor-not-allowed opacity-25",
                        checked
                          ? choice === "split"
                            ? "bg-nice-600 hover:bg-nice-500 text-white"
                            : "bg-naughty-600 hover:bg-naughty-500 text-white"
                          : choice === "split"
                          ? "hover:bg-nice-50 ring-1 ring-inset ring-gray-300 bg-white text-gray-900 "
                          : "hover:bg-naughty-50 ring-1 ring-inset ring-gray-300 bg-white text-gray-900 ",
                        "flex items-center justify-center rounded-lg py-2 px-2 text-sm font-semibold uppercase sm:flex-1"
                      )
                    }
                    disabled={walletBalance < option}
                  >
                    <Label as="span">{option}</Label>
                  </Radio>
                ))}
              </div>
            </RadioGroup>
          </div>
        </div>
      )}
    </>
  );
}

function PayoutInfo() {
  const { splitCount, stealCount } = useChoiceStore((state) => state);
  const amount = useChoiceStore((state) => state.amount);
  const totalChoices = splitCount + stealCount;
  const percentSplit = totalChoices
    ? Math.floor((splitCount / totalChoices) * 100)
    : 0;
  const percentSteal = 100 - percentSplit;

  const calculateOutcome = (them: Choice, you: Choice) => {
    const probSplit = splitCount / totalChoices;
    const stakeAmount = amount ?? 0;
    const splitValue =
      (stakeAmount + 1 + (1 - probSplit) * stakeAmount) / probSplit / 2;
    const stealValue = 2 * splitValue;

    if (you === "split" && them === "split") {
      return truncateToOneDecimalPlace(splitValue) + stakeAmount;
    } else if (you === "steal" && them === "split") {
      return truncateToOneDecimalPlace(stealValue) + stakeAmount;
    } else if (them === "steal") {
      return -stakeAmount;
    }
  };

  return (
    <div className="text-white text-xs sm:text-sm w-full max-w-sm flex flex-col gap-4 font-semibold">
      <Disclosure>
        {({ open }) => (
          <>
            <div className="flex justify-between items-end">
              <div>
                Current pool: {percentSplit}% 😇, {percentSteal}% 😈
              </div>
              <Disclosure.Button className="flex items-center hover:text-white">
                <div
                  className={`transform transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                >
                  <ChevronDownIcon className="h-5 w-5 text-gray-50" />
                </div>
                payout info estimate
              </Disclosure.Button>
            </div>
            <Transition
              show={open}
              enter="transition-opacity duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition-opacity duration-300"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="grid grid-cols-3">
                <div className="p-2 text-center border-b border-r border-gray-50 font-bold"></div>
                <div className="p-2 text-center border-b border-r border-gray-50 font-bold">
                  Them: Split
                </div>
                <div className="p-2 text-center border-b border-gray-50 font-bold">
                  Them: Steal
                </div>
                <div className="p-2 text-center border-r border-b border-gray-50 font-bold">
                  You: Split
                </div>
                <div className="p-2 text-center border-r border-b border-gray-50">
                  {calculateOutcome("split", "split")} + 🎁❓
                </div>
                <div className="p-2 text-center border-b border-gray-50">
                  {calculateOutcome("steal", "split")}
                </div>
                <div className="p-2 text-center border-r border-gray-50 font-bold">
                  You: Steal
                </div>
                <div className="p-2 text-center border-r border-gray-50">
                  {calculateOutcome("split", "steal")}
                </div>
                <div className="p-2 text-center">
                  {calculateOutcome("steal", "steal")}
                </div>
              </div>
            </Transition>
          </>
        )}
      </Disclosure>
    </div>
  );
}

function CustomConnectButton() {
  const { setVisible } = useWalletModal();
  const { publicKey } = useWallet();

  const [walletModalConfig, setWalletModalConfig] = useState<Readonly<{
    onSelectWallet(walletName: WalletName): void;
    wallets: Wallet[];
  }> | null>(null);
  const { buttonState, onConnect, onDisconnect, onSelectWallet } =
    useWalletMultiButton({
      onSelectWallet: setWalletModalConfig,
    });
  let label;
  switch (buttonState) {
    case "connected":
      label = publicKey
        ? publicKey.toString().slice(0, 4) + ".."
        : "Disconnect";
      break;
    case "connecting":
      label = "...";
      break;
    case "disconnecting":
      label = "...";
      break;
    case "has-wallet":
      label = "Connect";
      break;
    case "no-wallet":
      label = "Connect";
      break;
  }
  const handleClick = useCallback(() => {
    switch (buttonState) {
      case "connected":
        return onDisconnect?.();
      case "connecting":
      case "disconnecting":
        break;
      case "has-wallet":
        return onConnect?.();
      case "no-wallet":
        setVisible(true);
        return onSelectWallet?.();
        break;
    }
  }, [buttonState, onDisconnect, onConnect, setVisible, onSelectWallet]);
  return (
    <>
      <button
        className="font-semibold bg-white mix-blend-lighten text-black px-2 rounded-lg sm:px-3 sm:py-1 shadow-[0px_0px_0px_0px_white] hover:shadow-[0px_0px_0px_3px_white] transition-shadow"
        disabled={
          buttonState === "connecting" || buttonState === "disconnecting"
        }
        onClick={handleClick}
      >
        {label}
      </button>
    </>
  );
}
