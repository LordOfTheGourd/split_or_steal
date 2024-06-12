import * as anchor from "@coral-xyz/anchor";
import { BN, SystemProgram } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { TOKEN_PROGRAM_ID, AuthorityType } from "@solana/spl-token";
const { PublicKey, Keypair } = anchor.web3;
import * as fs from "fs";
import { SplitOrSteal } from "../target/types/split_or_steal";
import { assert } from "chai";
const SplitOrStealIDL: SplitOrSteal = require("../target/idl/split_or_steal.json");

function loadKeypairFromFile(filePath: string): anchor.web3.Keypair {
  const secretKeyString = fs.readFileSync(filePath, "utf-8");
  const secretKeyArray = JSON.parse(secretKeyString) as number[];
  const secretKey = Uint8Array.from(secretKeyArray);
  return Keypair.fromSecretKey(secretKey);
}

async function revokeMintAndFreezeAuthorities(
  provider,
  mint,
  currentAuthority
) {
  try {
    const mintAccount = await token.getMint(provider.connection, mint);
    if (
      mintAccount.mintAuthority === null &&
      mintAccount.freezeAuthority === null
    ) {
      console.log("Authorities already revoked.");
      return;
    }
  } catch (e) {
    console.log("Failed to fetch mint account:", e);
    process.exit(1);
  }

  try {
    const tx = new anchor.web3.Transaction().add(
      anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 20_000,
      }),
      token.createSetAuthorityInstruction(
        mint,
        currentAuthority,
        AuthorityType.MintTokens,
        null,
        [],
        TOKEN_PROGRAM_ID
      ),
      token.createSetAuthorityInstruction(
        mint,
        currentAuthority,
        AuthorityType.FreezeAccount,
        null,
        [],
        TOKEN_PROGRAM_ID
      )
    );
    await provider.sendAndConfirm(tx, [], { commitment: "confirmed" });
    console.log("Mint authorities revoked");
  } catch (e) {
    console.log("Failed to revoke authorities:", e);
    process.exit(1);
  }
}

async function main() {
  const connection = new anchor.web3.Connection("...", "confirmed");
  const wallet = anchor.Wallet.local();
  const provider = new anchor.AnchorProvider(
    connection,
    wallet,
    anchor.AnchorProvider.defaultOptions()
  );
  anchor.setProvider(provider);

  const programId = new PublicKey(
    "SRSPsMqHaSLJjPNKEoQbTeF6TSvospw2PXGkfj4VzhD"
  );
  const splitOrSteal = new anchor.Program(SplitOrStealIDL, programId, provider);

  const payer = wallet.payer;
  const mintPublicKey = new PublicKey(
    "SoRSy2b5sbpCXzWSB999nQFzsgVxUBaymwpNu55Y7WY"
  ); // Replace with actual mint public key
  //   const creatorTokenAccount = new PublicKey("..."); // Replace with actual creator token account
  const creatorTokenAccount = await token.getAssociatedTokenAddress(
    mintPublicKey,
    payer.publicKey
  );

  const num_tokens = 1_000_000_000; // 1 billion tokens
  const nine_decimals = 1_000_000_000;
  const tokenAmount = new BN(num_tokens).mul(new BN(nine_decimals));

  const [gameVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("lord of the gourd")],
    programId
  );
  const [gameVaultTokenAccountPDA] = PublicKey.findProgramAddressSync(
    [gameVaultPDA.toBuffer()],
    programId
  );

  await revokeMintAndFreezeAuthorities(
    provider,
    mintPublicKey,
    payer.publicKey
  );

  try {
    const txSignature = await splitOrSteal.methods
      .initializeVault(tokenAmount)
      .accounts({
        creator: payer.publicKey,
        creatorTokenAccount,
        gameVault: gameVaultPDA,
        gameVaultTokenAccount: gameVaultTokenAccountPDA,
        mint: mintPublicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .preInstructions([
        anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
          units: 200_000,
        }),
        anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 20_000,
        }),
      ])
      .rpc();

    const tx = await connection.getTransaction(txSignature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    console.log(tx?.meta?.logMessages);
  } catch (e) {
    console.log("Failed to initialize vault:", e);
    process.exit(1);
  }

  console.log("done");

  const gameVaultAccount = await splitOrSteal.account.gameVault.fetch(
    gameVaultPDA
  );
  console.log(gameVaultAccount);
  assert.equal(
    gameVaultAccount.mintRemaining.toNumber(),
    tokenAmount.toNumber()
  );
  assert.equal(gameVaultAccount.creator.toBase58(), payer.publicKey.toBase58());

  const mintAccount = await token.getMint(provider.connection, mintPublicKey);
  assert(mintAccount.mintAuthority === null);
  assert(mintAccount.freezeAuthority === null);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
